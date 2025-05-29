// ВНИМАНИЕ: Этот проект работает строго по REDMAP.txt
// Перед любыми изменениями сверяйся с RedMap. Нарушения запрещены.
// 🎯 СПРОЩЕНЕ ПІДКЛЮЧЕННЯ: використовуємо тільки production базу
console.log('🎯 [SYSTEM] Налаштування PRODUCTION Neon DB: ep-lucky-boat-a463bggt');

// Загружаем переменные окружения из файла .env
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// ESM підтримка для __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Проверяем, существует ли файл .env
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  console.log('[Config] Loading environment variables from:', envPath);
  const result = dotenv.config({ path: envPath });
  
  if (result.error) {
    console.error('[Config] Error loading .env file:', result.error);
  } else {
    console.log('[Config] Environment variables loaded successfully');
  }
} else {
  console.error('[Config] .env file not found at:', envPath);
}

// Используем стабильный production URL для Telegram бота
if (!process.env.APP_URL) {
  process.env.APP_URL = 'https://uni-farm-connect-x-lukyanenkolawfa.replit.app';
  console.log('[Config] Setting APP_URL manually:', process.env.APP_URL);
}

if (!process.env.MINI_APP_URL) {
  process.env.MINI_APP_URL = 'https://uni-farm-connect-x-lukyanenkolawfa.replit.app';
  console.log('[Config] Setting MINI_APP_URL manually:', process.env.MINI_APP_URL);
}

if (!process.env.TELEGRAM_WEBHOOK_URL) {
  process.env.TELEGRAM_WEBHOOK_URL = `${process.env.APP_URL}/api/telegram/webhook`;
  console.log('[Config] Setting TELEGRAM_WEBHOOK_URL manually:', process.env.TELEGRAM_WEBHOOK_URL);
}

// Логируем важные настройки Telegram для отладки
console.log('[Telegram Config] APP_URL:', process.env.APP_URL);
console.log('[Telegram Config] MINI_APP_URL:', process.env.MINI_APP_URL);
console.log('[Telegram Config] TELEGRAM_WEBHOOK_URL:', process.env.TELEGRAM_WEBHOOK_URL);

// Устанавливаем переменные окружения для SSL
process.env.PGSSLMODE = 'require';

// Підключення до бази буде виконано через спрощений db-connect-unified.ts

// Принудительно устанавливаем Neon DB как провайдер базы данных
process.env.DATABASE_PROVIDER = 'neon';
process.env.FORCE_NEON_DB = 'true';
process.env.DISABLE_REPLIT_DB = 'true';
process.env.OVERRIDE_DB_PROVIDER = 'neon';
process.env.SKIP_PARTITION_CREATION = 'true';
process.env.IGNORE_PARTITION_ERRORS = 'true';

// Импорты для работы с Express и базовыми модулями
import express, { 
  type Request, 
  type Response, 
  type NextFunction, 
  Router,
  type RequestHandler,
  type ErrorRequestHandler 
} from "express";
import http from 'http';
import { WebSocketServer } from 'ws';

// Импорты для работы с базой данных
import { testConnection, db, queryWithRetry, dbType, pool } from './db-connect-unified';
// Видалено: import { DatabaseType } from "./db-config";

// Импорты middleware и обработчиков
import { databaseErrorHandler } from './middleware/databaseErrorHandler';
import { healthCheckMiddleware } from './middleware/health-check';
import { responseFormatter } from "./middleware/responseFormatter";
import { errorHandler } from "./middleware/errorHandler";

// Импорты для маршрутизации и статических файлов
import { registerNewRoutes } from "./routes-new";
import { setupVite, serveStatic, log } from "./vite";
// import { setupProductionStatic } from "./productionStatic"; // Временно отключено

// Импорты для фоновых задач и миграций
import { startBackgroundTasks } from "./background-tasks";
import { schedulePartitionCreation } from "./cron/partition-scheduler";
import { migrateRefCodes } from "./migrations/refCodeMigration";

// Импорт для настройки Telegram
import { setupTelegramHook } from './telegram/setup-hook';

// Импорты для логирования
import logger from './utils/logger';

// Импорты для сессий
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import memoryStore from 'memorystore';

// Переопределяем обработчик необработанных исключений
process.on('uncaughtException', (error: Error) => {
  // Игнорируем ошибки партиционирования
  if (error.message && (
      error.message.includes('partitioned') || 
      error.message.includes('partition') ||
      error.message.includes('Failed to create partitions')
    )) {
    logger.warn('[Server] Игнорируем ошибку партиционирования:', error.message);
    return; // Не завершаем процесс при ошибке партиционирования
  }

  logger.error('[Server] Необработанное исключение:', error);
});

// Глобальный обработчик необработанных отказов промисов
process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  logger.error('[SERVER] Необработанный отказ промиса:', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
    timestamp: new Date().toISOString()
  });
  
  // Логируем более подробную информацию для отладки
  if (reason instanceof Error) {
    logger.error('[SERVER] Детали ошибки:', {
      name: reason.name,
      message: reason.message,
      stack: reason.stack,
      time: new Date().toISOString()
    });
  }
});

/**
 * Основная функция для запуска сервера
 */
async function startServer(): Promise<void> {
  logger.info('[Server] 🔄 Запуск сервера...');

  // Проверяем подключение к базе данных перед запуском сервера
  logger.info('[Server] 🔄 Проверка подключения к базе данных...');
  const isDbConnected = await testConnection();

  if (!isDbConnected) {
    logger.error('[Server] ❌ КРИТИЧЕСКАЯ ОШИБКА: Не удалось подключиться к базе данных!');
    logger.info('[Server] 🔄 Попытка переподключения...');

    // Пробуем повторно подключиться с ожиданием
    const reconnected = await new Promise<boolean>(resolve => {
      setTimeout(async () => {
        try {
          const result = await testConnection();
          resolve(result);
        } catch (error) {
          logger.error('[Server] ❌ Ошибка при повторном подключении:', error);
          resolve(false);
        }
      }, 3000);
    });

    if (!reconnected) {
      logger.error('[Server] ❌ КРИТИЧЕСКАЯ ОШИБКА: Не удалось подключиться к базе данных после повторных попыток!');
      logger.warn('[Server] ⚠️ Сервер продолжит запуск, но возможны ошибки в работе API!');
    } else {
      logger.info('[Server] ✅ Подключение к базе данных восстановлено');
    }
  } else {
    logger.info('[Server] ✅ Подключение к базе данных успешно установлено');
  }

  // Создаем Express приложение
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // Создаем хранилище сессий
  const MemoryStore = memoryStore(session);
  const PgStore = connectPgSimple(session);
  
  // Настраиваем сессионный middleware
  app.use(session({
    store: process.env.USE_MEMORY_SESSION === 'true' 
      ? new MemoryStore({
          checkPeriod: 86400000 // Очистка устаревших сессий каждые 24 часа
        }) 
      : new PgStore({
          pool: pool as any, // Временное приведение типа для совместимости с connect-pg-simple
          tableName: 'session',
          createTableIfMissing: true
        }),
    secret: process.env.SESSION_SECRET || 'UniFarm_secret_key_change_in_production',
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 дней
      httpOnly: true,
      sameSite: 'lax'
    }
  }));

  // Регистрируем middleware для проверки подключения к БД
  app.use(databaseErrorHandler as unknown as RequestHandler);
  
  // Регистрируем middleware для проверки здоровья приложения
  app.use(healthCheckMiddleware as express.RequestHandler);
  
  // Регистрируем middleware для стандартизации ответов API
  app.use(responseFormatter as any);

  // Middleware для логирования API запросов
  const apiLoggingMiddleware: RequestHandler = (req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson: any) {
      capturedJsonResponse = bodyJson;
      return originalResJson.call(res, bodyJson);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }

        if (logLine.length > 80) {
          logLine = logLine.slice(0, 79) + "…";
        }

        log(logLine);
      }
    });

    next();
  };
  
  app.use('/api', apiLoggingMiddleware);

  // Дополнительные логи отладки запросов
  if (process.env.DEBUG_API_REQUESTS === 'true') {
    const debugMiddleware: RequestHandler = (req, _res, next) => {
      if (req.path.startsWith('/api/')) {
        logger.debug('[АУДИТ] [' + new Date().toISOString() + '] Request to ' + req.method + ' ' + req.url);
        logger.debug('[АУДИТ] Headers:', JSON.stringify(req.headers, null, 2));
      }
      next();
    };
    
    app.use('/api', debugMiddleware);
  }

  // Создаем отдельный роутер для маршрутов здоровья
  const healthRouter = Router();

  // Добавляем специальный маршрут для проверки здоровья
  const healthHandler = (req: Request, res: Response): Response => {
    logger.debug('[Health Check] Запрос к /health эндпоинту');
    return res.status(200).send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  };
  
  healthRouter.get('/health', healthHandler as any);

  // Добавляем обработчик корневого маршрута для проверки здоровья
  const rootHealthHandler = (req: Request, res: Response) => {
    logger.debug('[Health Check] Запрос к корневому маршруту');
    
    // Если это запрос для проверки здоровья от Replit
    if (req.query.health === 'check' || 
        req.headers['user-agent']?.includes('Replit') || 
        req.headers['x-replit-deployment-check']) {
      logger.info('[Health Check] Replit проверка здоровья обнаружена');
      return res.status(200).send('OK');
    }
    
    // Отдаем фронтенд приложение
    const indexPath = path.join(__dirname, '../dist/public/index.html');
    
    // Проверяем существование файла
    if (fs.existsSync(indexPath)) {
      logger.debug('[Frontend] Отдаем index.html фронтенда');
      return res.sendFile(indexPath);
    }
    
    // Fallback если dist не найден - отдаем базовый HTML для Mini App
    logger.debug('[Frontend] dist/index.html не найден, возвращаем базовую страницу');
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>UniFarm</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
          <meta name="telegram-web-app-ready" content="true" />
          <meta name="format-detection" content="telephone=no" />
          <meta name="color-scheme" content="light dark" />
        </head>
        <body>
          <div id="root">
            <div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: Arial, sans-serif;">
              <div style="text-align: center;">
                <h1>🌾 UniFarm</h1>
                <p>Загрузка приложения...</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
  };
  
  healthRouter.get('/', rootHealthHandler as any);

  // Подключаем роутер с маршрутами здоровья
  app.use('/', healthRouter);

  // Добавление обработчика для Telegram WebApp параметров
  const telegramWebAppMiddleware: RequestHandler = (req, res, next) => {
    // Получаем источник запроса
    const origin = req.headers.origin || '*';

    // Добавляем специальные заголовки для корректной работы в Telegram Mini App с поддержкой cookies
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, x-telegram-data, x-telegram-user-id");

    // Модифицированная политика безопасности для Telegram
    res.header("Content-Security-Policy", "default-src * 'self' data: blob: 'unsafe-inline' 'unsafe-eval'");

    // Для запросов OPTIONS возвращаем 200 OK
    if (req.method === 'OPTIONS') {
      return res.status(200).send();
    }

    // Логирование параметров Telegram
    const telegramParams = ['tgWebAppData', 'tgWebAppVersion', 'tgWebAppPlatform', 'tgWebAppStartParam']
      .filter(param => req.query[param])
      .reduce((acc, param) => {
        acc[param] = req.query[param];
        return acc;
      }, {} as Record<string, any>);

    if (Object.keys(telegramParams).length > 0) {
      logger.debug('[TelegramWebApp] Параметры в URL:', telegramParams);
    }

    next();
  };
  
  app.use(telegramWebAppMiddleware);

  // Создаем HTTP сервер на основе Express приложения
  const server = http.createServer(app);
  
  // Настройка WebSocket сервера для real-time обновлений
  const wss = new WebSocketServer({ server });
  
  wss.on('connection', (ws, req) => {
    logger.info('[WebSocket] Новое подключение установлено');
    
    // Отправляем приветственное сообщение
    ws.send(JSON.stringify({
      type: 'connection',
      status: 'connected',
      timestamp: new Date().toISOString()
    }));
    
    // Обработка входящих сообщений
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        logger.info('[WebSocket] Получено сообщение:', message);
        
        // Эхо-ответ для подтверждения
        ws.send(JSON.stringify({
          type: 'echo',
          originalMessage: message,
          timestamp: new Date().toISOString()
        }));
      } catch (error) {
        logger.error('[WebSocket] Ошибка парсинга сообщения:', error);
      }
    });
    
    // Обработка закрытия соединения
    ws.on('close', (code, reason) => {
      logger.info(`[WebSocket] Соединение закрыто: ${code} - ${reason}`);
    });
    
    // Улучшенная обработка ошибок
    ws.on('error', (error) => {
      logger.error(`[WebSocket] Ошибка соединения:`, error.message);
      // Не закрываем соединение принудительно - позволяем клиенту переподключиться
    });
    
    // Heartbeat для поддержания соединения
    const heartbeat = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        ws.ping();
      } else {
        clearInterval(heartbeat);
      }
    }, 30000); // ping каждые 30 секунд
    
    ws.on('pong', () => {
      logger.debug('[WebSocket] Pong получен');
    });
  });
  
  // === API v1 → v2 MAPPING СИСТЕМА ===
  // Универсальная система обратной совместимости для фронтенда
  
  // Маппинг для TON Farming эндпоинтов
  app.get('/api/ton-farming/info', (req, res, next) => {
    logger.info('[API MAP] /api/ton-farming/info → /api/v2/ton-farming/info');
    req.url = '/api/v2/ton-farming/info';
    next();
  });
  
  app.get('/api/ton-farming/boosts', (req, res, next) => {
    logger.info('[API MAP] /api/ton-farming/boosts → /api/v2/ton-farming/boosts');
    req.url = '/api/v2/ton-farming/boosts';
    next();
  });
  
  app.get('/api/ton-farming/active', (req, res, next) => {
    logger.info('[API MAP] /api/ton-farming/active → /api/v2/ton-farming/active');
    req.url = '/api/v2/ton-farming/active';
    next();
  });
  
  app.post('/api/ton-farming/purchase', (req, res, next) => {
    logger.info('[API MAP] /api/ton-farming/purchase → /api/v2/ton-farming/purchase');
    req.url = '/api/v2/ton-farming/purchase';
    next();
  });
  
  app.post('/api/ton-farming/confirm-payment', (req, res, next) => {
    logger.info('[API MAP] /api/ton-farming/confirm-payment → /api/v2/ton-farming/confirm-payment');
    req.url = '/api/v2/ton-farming/confirm-payment';
    next();
  });
  
  app.post('/api/ton-farming/update', (req, res, next) => {
    logger.info('[API MAP] /api/ton-farming/update → /api/v2/ton-farming/update');
    req.url = '/api/v2/ton-farming/update';
    next();
  });
  
  // Маппинг для UniPool Farming эндпоинтов
  app.get('/api/uni-farming/status', (req, res, next) => {
    logger.info('[API MAP] /api/uni-farming/status → /api/v2/uni-farming/status');
    req.url = '/api/v2/uni-farming/status';
    next();
  });
  
  app.post('/api/uni-farming/purchase', (req, res, next) => {
    logger.info('[API MAP] /api/uni-farming/purchase → /api/v2/uni-farming/purchase');
    req.url = '/api/v2/uni-farming/purchase';
    next();
  });
  
  app.post('/api/uni-farming/withdraw', (req, res, next) => {
    logger.info('[API MAP] /api/uni-farming/withdraw → /api/v2/uni-farming/withdraw');
    req.url = '/api/v2/uni-farming/withdraw';
    next();
  });
  
  // Маппинг для Wallet эндпоинтов
  app.get('/api/wallet/balance', (req, res, next) => {
    logger.info('[API MAP] /api/wallet/balance → /api/v2/wallet/balance');
    req.url = '/api/v2/wallet/balance';
    next();
  });
  
  app.post('/api/wallet/connect', (req, res, next) => {
    logger.info('[API MAP] /api/wallet/connect → /api/v2/wallet/connect');
    req.url = '/api/v2/wallet/connect';
    next();
  });
  
  app.post('/api/wallet/disconnect', (req, res, next) => {
    logger.info('[API MAP] /api/wallet/disconnect → /api/v2/wallet/disconnect');
    req.url = '/api/v2/wallet/disconnect';
    next();
  });
  
  app.get('/api/wallet/transactions', (req, res, next) => {
    logger.info('[API MAP] /api/wallet/transactions → /api/v2/wallet/transactions');
    req.url = '/api/v2/wallet/transactions';
    next();
  });
  
  app.post('/api/wallet/withdraw', (req, res, next) => {
    logger.info('[API MAP] /api/wallet/withdraw → /api/v2/wallet/withdraw');
    req.url = '/api/v2/wallet/withdraw';
    next();
  });
  
  // Маппинг для Boosts эндпоинтов
  app.get('/api/boosts', (req, res, next) => {
    logger.info('[API MAP] /api/boosts → /api/v2/boosts');
    req.url = '/api/v2/boosts';
    next();
  });
  
  app.get('/api/boosts/active', (req, res, next) => {
    logger.info('[API MAP] /api/boosts/active → /api/v2/boosts/active');
    req.url = '/api/v2/boosts/active';
    next();
  });
  
  app.post('/api/boosts/purchase', (req, res, next) => {
    logger.info('[API MAP] /api/boosts/purchase → /api/v2/boosts/purchase');
    req.url = '/api/v2/boosts/purchase';
    next();
  });
  
  // Маппинг для Missions эндпоинтов
  app.get('/api/missions/active', (req, res, next) => {
    logger.info('[API MAP] /api/missions/active → /api/v2/missions/active');
    req.url = '/api/v2/missions/active';
    next();
  });
  
  app.get('/api/user-missions', (req, res, next) => {
    logger.info('[API MAP] /api/user-missions → /api/v2/user-missions');
    req.url = '/api/v2/user-missions';
    next();
  });
  
  app.get('/api/missions/with-completion', (req, res, next) => {
    logger.info('[API MAP] /api/missions/with-completion → /api/v2/missions/with-completion');
    req.url = '/api/v2/missions/with-completion';
    next();
  });
  
  app.post('/api/missions/complete', (req, res, next) => {
    logger.info('[API MAP] /api/missions/complete → /api/v2/missions/complete');
    req.url = '/api/v2/missions/complete';
    next();
  });
  
  // КРИТИЧНИЙ МАРШРУТ: перенаправляємо відсутній endpoint на робочий
  app.get('/api/v2/missions/user-completed', (req, res, next) => {
    logger.info('[API MAP] /api/v2/missions/user-completed → /api/v2/user-missions');
    req.url = '/api/v2/user-missions';
    next();
  });
  

  
  // Маппинг для Referrals эндпоинтов
  app.get('/api/referrals/tree', (req, res, next) => {
    logger.info('[API MAP] /api/referrals/tree → /api/v2/referrals/tree');
    req.url = '/api/v2/referrals/tree';
    next();
  });
  
  app.get('/api/referrals/stats', (req, res, next) => {
    logger.info('[API MAP] /api/referrals/stats → /api/v2/referrals/stats');
    req.url = '/api/v2/referrals/stats';
    next();
  });
  
  app.post('/api/referrals/apply', (req, res, next) => {
    logger.info('[API MAP] /api/referrals/apply → /api/v2/referrals/apply');
    req.url = '/api/v2/referrals/apply';
    next();
  });
  
  // Маппинг для Daily Bonus эндпоинтов
  app.get('/api/daily-bonus/status', (req, res, next) => {
    logger.info('[API MAP] /api/daily-bonus/status → /api/v2/daily-bonus/status');
    req.url = '/api/v2/daily-bonus/status';
    next();
  });
  
  app.post('/api/daily-bonus/claim', (req, res, next) => {
    logger.info('[API MAP] /api/daily-bonus/claim → /api/v2/daily-bonus/claim');
    req.url = '/api/v2/daily-bonus/claim';
    next();
  });
  
  app.get('/api/daily-bonus/streak-info', (req, res, next) => {
    logger.info('[API MAP] /api/daily-bonus/streak-info → /api/v2/daily-bonus/streak-info');
    req.url = '/api/v2/daily-bonus/streak-info';
    next();
  });
  
  // Маппинг для Session эндпоинтов
  app.post('/api/session/restore', (req, res, next) => {
    logger.info('[API MAP] /api/session/restore → /api/v2/session/restore');
    req.url = '/api/v2/session/restore';
    next();
  });
  
  // Маппинг для Users эндпоинтов
  app.get('/api/users/:id', (req, res, next) => {
    logger.info('[API MAP] /api/users/:id → /api/v2/users/:id');
    req.url = '/api/v2/users/' + req.params.id;
    next();
  });
  
  app.get('/api/users/:userId/transactions', (req, res, next) => {
    logger.info('[API MAP] /api/users/:userId/transactions → /api/v2/users/:userId/transactions');
    req.url = '/api/v2/users/' + req.params.userId + '/transactions';
    next();
  });

  // Универсальный fallback маппинг для любых оставшихся v1 маршрутов
  // Должен быть ПОСЛЕДНИМ перед регистрацией v2 маршрутов
  app.use('/api/', (req, res, next) => {
    // Пропускаем уже обработанные v2 маршруты и специальные эндпоинты
    if (req.url.startsWith('/v2/') || 
        req.url.startsWith('/health') || 
        req.url.startsWith('/db/') || 
        req.url.startsWith('/telegram/') || 
        req.url.startsWith('/admin/')) {
      return next();
    }
    
    // Перенаправляем все остальные /api/* запросы на /api/v2/*
    const originalUrl = req.url;
    req.url = '/v2' + req.url;
    logger.info(`[API MAP FALLBACK] /api${originalUrl} → /api/v2${originalUrl}`);
    next();
  });

  // Регистрируем Telegram routes и webhook
  try {
    const { default: telegramRouter } = await import('./telegram/routes');
    app.use('/api/telegram', telegramRouter);

  // Тестові маршрути для прямого підключення до production бази
  const { getProductionDbStatus, testTelegramRegistration, checkUser } = require('./api/test-production-db');
  app.get('/api/test/production-db', getProductionDbStatus);
  app.post('/api/test/telegram-register', testTelegramRegistration);
  app.get('/api/test/user/:user_id', checkUser);
  
  logger.info('[Server] ✅ Telegram маршруты зарегистрированы: /api/telegram/*');
  } catch (error) {
    logger.error('[Server] ❌ Ошибка при регистрации Telegram маршрутов:', error);
  }

  // Регистрируем консолидированные маршруты API
  try {
    // Регистрируем консолидированные маршруты
    registerNewRoutes(app);
    
    // КРИТИЧНО: Підключаємо простий робочий маршрут для місій
    const simpleMissionsRouter = await import('./routes/simple-missions.js');
    app.use('/', simpleMissionsRouter.default);
    logger.info('[Server] ✅ Простий маршрут місій підключено');
    
    // КРИТИЧНО: Підключаємо простий робочий маршрут для бустів
    const simpleBoostsRouter = await import('./routes/simple-boosts.js');
    app.use('/', simpleBoostsRouter.default);
    logger.info('[Server] ✅ Простий маршрут бустів підключено');
    
    // Настраиваем базовый URL для API
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? (process.env.PRODUCTION_URL || 'https://uni-farm.app') 
      : 'https://uni-farm-connect-2.osadchukdmitro2.replit.app';
      
    logger.info('[Server] ✅ API маршруты успешно настроены');
  } catch (error) {
    logger.error('[Server] ❌ Ошибка при настройке маршрутов API:', 
      error instanceof Error ? error.message : String(error));
  }

  // Регистрируем централизованный обработчик ошибок
  app.use((err: any, req: any, res: any, next: any) => {
    errorHandler(err, req, res, next);
  });

  // Добавляем health check endpoint перед статическими файлами
  app.get('/health', (req: any, res: any) => {
    logger.debug('[Health Check] Запрос к health endpoint');
    return res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
  });

  // КРИТИЧНО: Швидкий тестовий ендпоінт для місій з реальними даними з БД
  app.get('/api/v2/missions/active', async (req: any, res: any) => {
    try {
      console.log('[QUICK FIX] 🔍 Запрос активных миссий через прямое подключение к БД');
      
      // Импортируем функцию для подключения к БД
      const { getSingleDbConnection } = await import('./single-db-connection.js');
      const { missions } = await import('../shared/schema.js');
      const { eq } = await import('drizzle-orm');
      
      const db = await getSingleDbConnection();
      
      const activeMissions = await db
        .select()
        .from(missions)
        .where(eq(missions.is_active, true));
      
      console.log('[QUICK FIX] ✅ Знайдено місій:', activeMissions.length);
      
      res.status(200).json({
        success: true,
        data: activeMissions,
        message: 'Активные миссии получены из БД'
      });
    } catch (error) {
      console.error('[QUICK FIX] ❌ Ошибка:', error);
      res.status(500).json({
        success: false,
        error: 'Ошибка получения миссий',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Настраиваем обработку статических файлов в зависимости от окружения
  if (app.get("env") === "development") {
    logger.info('[Server] 🔧 Запуск в режиме разработки (development), используем Vite middleware');
    await setupVite(app, server);
  } else {
    logger.info('[Server] 🚀 Запуск в production режиме, используем оптимизированную обработку статических файлов');
    // setupProductionStatic(app); // Отключено - используем express.static ниже
  }
  
  // Еще раз регистрируем централизованный обработчик ошибок
  app.use((err: any, req: any, res: any, next: any) => {
    errorHandler(err, req, res, next);
  });

  // Статичні файли для frontend (CSS, JS, assets)
  app.use(express.static(path.join(__dirname, '../dist/public')));

  // Добавляем SPA fallback ТОЛЬКО для не-API маршрутов
  app.use('*', (req: any, res: any) => {
    // НЕ обрабатываем API запросы - они должны идти через API роуты
    if (req.originalUrl.startsWith('/api/')) {
      logger.debug('[SPA Fallback] Пропускаем API запрос:', req.originalUrl);
      return res.status(404).json({ success: false, error: 'API endpoint not found' });
    }
    
    const indexPath = path.join(__dirname, '../dist/public/index.html');
    
    if (fs.existsSync(indexPath)) {
      logger.debug('[SPA Fallback] Отдаем index.html для SPA маршрута:', req.originalUrl);
      return res.sendFile(indexPath);
    }
    
    // Fallback если dist не найден
    logger.debug('[SPA Fallback] dist/index.html не найден, возвращаем 404');
    res.status(404).send('Page not found');
  });

  // В Replit при деплое необходимо слушать порт, указанный в переменной окружения PORT
  const port = parseInt(process.env.PORT || "3000", 10);
  logger.info(`[Server] Starting on port ${port} in ${process.env.NODE_ENV || 'development'} mode`);

  // Запускаем сервер
  server.listen(port, "0.0.0.0", () => {
    logger.info(`[Server] 🚀 Сервер успешно запущен на порту ${port}`);
    
    // После запуска сервера автоматически настраиваем Telegram вебхук
    if (process.env.TELEGRAM_BOT_TOKEN) {
      logger.info('[Server] Запуск автоматической настройки Telegram бота...');
      const webhookUrl = `https://${process.env.REPLIT_DEV_DOMAIN || 'localhost:3000'}/api/telegram/webhook`;
      setupTelegramHook(webhookUrl).catch(error => {
        logger.error('[Server] Ошибка при настройке Telegram вебхука:', error);
        logger.info('[Server] Настройку Telegram бота можно выполнить вручную через /api/telegram/setup');
      });
    } else {
      logger.warn('[Server] TELEGRAM_BOT_TOKEN не найден, автоматическая настройка вебхука пропущена');
    }
    
    // Инициализируем фоновые сервисы
    initBackgroundServices();
  });
}

/**
 * Инициализирует фоновые сервисы
 */
function initBackgroundServices(): void {
  // Задержка инициализации тяжелых сервисов для обеспечения быстрого запуска
  setTimeout(() => {
    // Инициализация системы автоматического восстановления соединения с БД
    try {
      const { initDbAutoRecovery } = require('./utils/db-auto-recovery');
      initDbAutoRecovery({
        initialBackoff: 5000,         // 5 секунд начальная задержка
        maxBackoff: 300000,           // Максимум 5 минут между попытками
        backoffFactor: 1.5,           // Увеличение задержки в 1.5 раза при каждой неудаче
        resetThreshold: 600000,       // Сброс счетчика неудач после 10 минут успешной работы
        maxConsecutiveFailures: 5     // Максимум 5 последовательных неудач
      });
      logger.info('[Server] ✅ Система автоматического восстановления БД инициализирована');
    } catch (error) {
      logger.error('[Server] ❌ Ошибка при инициализации системы автоматического восстановления БД:', 
        error instanceof Error ? error.message : String(error));
    }

    // Запуск фоновых задач
    startBackgroundTasks();

    // Запуск cron-задач для обслуживания базы данных
    try {
      // Импортируем и инициализируем модуль cron-задач после старта сервера
      import('./scripts/cron_scheduler.js')
        .then(module => {
          module.setupCronJobs();
          logger.info('[Server] Cron-задачи успешно инициализированы');
        })
        .catch(error => {
          logger.error('[Server] Ошибка при инициализации cron-задач:', error);
        });
    } catch (error) {
      logger.error('[Server] Ошибка при импорте модуля cron-задач:', error);
    }

    // Запуск планировщика партиций
    try {
      if (process.env.SKIP_PARTITION_CREATION !== 'true') {
        logger.info('[Server] Инициализация планировщика партиций...');
        schedulePartitionCreation();
        logger.info('[Server] Планировщик партиций успешно инициализирован');
      } else {
        logger.info('[Server] Планировщик партиций пропущен (SKIP_PARTITION_CREATION=true)');
      }
    } catch (error) {
      logger.error('[Server] Ошибка при инициализации планировщика партиций:', error);
    }

    // Обновление реферальных кодов
    try {
      migrateRefCodes()
        .then((result) => {
          logger.info(`[Server] Миграция реферальных кодов завершена: ${result.total} обработано, ${result.updated} обновлено`);
        })
        .catch((error) => {
          logger.error('[Server] Ошибка при миграции реферальных кодов:', error);
        });
    } catch (error) {
      logger.error('[Server] Ошибка при запуске миграции реферальных кодов:', error);
    }
  }, 5000);
}

// Запускаем сервер
startServer().catch(error => {
  logger.error('[Server] Критическая ошибка при запуске сервера:', error);
  // Логируем ошибку, но не завершаем процесс
  logger.info('[Server] Сервер продолжит работу, несмотря на ошибку при инициализации');
});

// Создаем интервал, чтобы процесс не завершался
setInterval(() => {
  logger.debug('[Server] Heartbeat check - server is still running');
}, 1000 * 60 * 5); // Проверка каждые 5 минут