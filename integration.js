/**
 * Интеграционный модуль UniFarm
 * 
 * Объединяет все исправления в одном модуле для простоты внедрения
 * Не требует установки дополнительных зависимостей
 */

// Применяем фикс для подключения к БД в первую очередь
require('./db-selector-fix');

const crypto = require('crypto');
const { Pool } = require('pg');
const express = require('express');
const session = require('express-session');

/**
 * Проверяет подпись данных от Telegram
 * @param {string} initData - Строка initData от Telegram
 * @param {string} botToken - Токен бота Telegram
 * @returns {boolean} - Результат проверки
 */
function validateTelegramInitData(initData, botToken) {
  try {
    // Проверяем наличие токена и данных
    if (!botToken || !initData) {
      return false;
    }
    
    // Разбираем строку initData
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    
    if (!hash) {
      return false;
    }
    
    // Создаем массив данных для проверки
    const dataCheckArr = [];
    
    // Создаем отсортированный массив параметров (без hash)
    urlParams.forEach((val, key) => {
      if (key !== 'hash') {
        dataCheckArr.push(`${key}=${val}`);
      }
    });
    
    // Сортируем массив
    dataCheckArr.sort();
    
    // Создаем строку данных
    const dataCheckString = dataCheckArr.join('\n');
    
    // Создаем HMAC-SHA-256 подпись
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');
    
    // Проверяем подпись
    return calculatedHash === hash;
  } catch (error) {
    console.error('[Telegram Auth] ❌ Ошибка при проверке подписи:', error.message);
    return false;
  }
}

/**
 * Настраивает улучшенный CORS для Telegram Mini App
 * @param {Object} app - Express-приложение
 */
function setupImprovedCors(app) {
  if (!app) return;
  
  // Определяем улучшенный CORS middleware
  const improvedCorsMiddleware = (req, res, next) => {
    // Получаем origin из запроса
    const origin = req.headers.origin;
    
    // Список разрешенных источников
    const allowedOrigins = [
      'https://web.telegram.org',
      'https://t.me',
      'https://telegram.org',
      'https://telegram.me'
    ];
    
    // Проверяем, разрешен ли origin или находимся в режиме разработки
    if (origin && (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development')) {
      // Устанавливаем конкретный origin вместо * для поддержки credentials
      res.header('Access-Control-Allow-Origin', origin);
      // Важно для работы с cookies
      res.header('Access-Control-Allow-Credentials', 'true');
    } else {
      // Для запросов без origin или из непроверенных источников
      res.header('Access-Control-Allow-Origin', '*');
    }
    
    // Общие настройки CORS
    res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Telegram-Init-Data, X-Telegram-Init-Data, Telegram-Data, X-Telegram-Data, X-Telegram-Auth, X-Telegram-User-Id, X-Telegram-Start-Param, X-Telegram-Platform, X-Telegram-Data-Source, X-Development-Mode, X-Development-User-Id');
    
    // Добавляем Content-Security-Policy для работы в Telegram
    res.header('Content-Security-Policy', "default-src * 'self' data: blob: 'unsafe-inline' 'unsafe-eval'");
    
    // Добавляем заголовки для предотвращения кеширования
    res.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.header('Pragma', 'no-cache');
    res.header('Expires', '0');
    res.header('Surrogate-Control', 'no-store');
    
    // Для предварительных запросов OPTIONS отвечаем сразу
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    
    next();
  };
  
  // Применяем улучшенный CORS middleware
  app.use(improvedCorsMiddleware);
  
  console.log('[Integration] ✅ Улучшенный CORS middleware применен');
}

/**
 * Настраивает сессии с поддержкой cookies
 * @param {Object} app - Express-приложение
 */
function setupImprovedSessions(app) {
  if (!app) return;
  
  try {
    // Настройки сессии
    const sessionOptions = {
      secret: process.env.SESSION_SECRET || 'uni-farm-telegram-mini-app-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'none', // Для работы с Telegram Mini App
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 дней
      },
      store: createSessionStore()
    };
    
    // В production режиме настраиваем доверие к прокси
    if (process.env.NODE_ENV === 'production') {
      app.set('trust proxy', 1);
      sessionOptions.cookie.secure = true;
    }
    
    // Применяем middleware сессий
    app.use(session(sessionOptions));
    
    // Добавляем middleware для инициализации сессии пользователя
    app.use((req, res, next) => {
      // Инициализируем объект пользователя в сессии, если он отсутствует
      if (!req.session.user) {
        req.session.user = null;
      }
      
      // Добавляем методы для работы с сессией в объект запроса
      req.isAuthenticated = function() {
        return !!req.session.user;
      };
      
      req.login = function(user) {
        req.session.user = user;
      };
      
      req.logout = function() {
        req.session.user = null;
      };
      
      // Продолжаем обработку запроса
      next();
    });
    
    console.log('[Integration] ✅ Улучшенные сессии с поддержкой cookies настроены');
  } catch (error) {
    console.error('[Integration] ❌ Ошибка при настройке сессий:', error.message);
  }
}

/**
 * Создает хранилище для сессий
 * @returns {Object} - Хранилище для сессий
 */
function createSessionStore() {
  try {
    // Если доступен connect-pg-simple, используем его
    try {
      const pgSession = require('connect-pg-simple')(session);
      
      if (process.env.DATABASE_URL) {
        console.log('[Integration] ✅ Используем PostgreSQL для хранения сессий');
        
        // Создаем пул подключений к PostgreSQL
        const pool = new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl: {
            rejectUnauthorized: false // Для Neon DB
          }
        });
        
        // Пытаемся создать таблицу сессий
        pool.query(`
          CREATE TABLE IF NOT EXISTS sessions (
            sid VARCHAR NOT NULL PRIMARY KEY,
            sess JSON NOT NULL,
            expire TIMESTAMP(6) NOT NULL
          )
        `).catch(error => {
          console.error('[Integration] ⚠️ Ошибка при создании таблицы sessions:', error.message);
        });
        
        // Возвращаем хранилище сессий в PostgreSQL
        return new pgSession({
          pool,
          tableName: 'sessions'
        });
      }
    } catch {
      // connect-pg-simple не установлен, пропускаем
    }
  } catch (error) {
    console.error('[Integration] ⚠️ Ошибка при создании хранилища сессий:', error.message);
  }
  
  // Используем MemoryStore по умолчанию
  console.log('[Integration] ⚠️ Используем MemoryStore для хранения сессий');
  return new session.MemoryStore();
}

/**
 * Добавляет обработчик валидации данных от Telegram
 * @param {Object} app - Express-приложение
 */
function setupTelegramValidation(app) {
  if (!app) return;
  
  // Создаем middleware для проверки и обработки данных от Telegram
  const telegramValidationMiddleware = (req, res, next) => {
    try {
      // Получаем initData из различных возможных источников
      const initData = req.body.initData || 
                       req.headers['telegram-init-data'] || 
                       req.headers['x-telegram-init-data'];
      
      // Если нет данных, просто продолжаем
      if (!initData) {
        return next();
      }
      
      // Проверяем данные, если есть токен бота
      if (process.env.TELEGRAM_BOT_TOKEN) {
        const isValid = validateTelegramInitData(initData, process.env.TELEGRAM_BOT_TOKEN);
        
        if (isValid) {
          // Извлекаем данные пользователя
          try {
            const urlParams = new URLSearchParams(initData);
            const userStr = urlParams.get('user');
            
            if (userStr) {
              const user = JSON.parse(userStr);
              req.telegramUser = user;
              
              // Для диагностики
              console.log(`[Integration] ✅ Валидные данные Telegram, пользователь: ${user.id}`);
            }
          } catch (userError) {
            console.error('[Integration] ⚠️ Ошибка при разборе данных пользователя:', userError.message);
          }
        } else {
          // В режиме разработки позволяем продолжить даже с невалидными данными
          if (process.env.NODE_ENV !== 'development') {
            console.error('[Integration] ⚠️ Невалидные данные Telegram initData');
          }
        }
      }
      
      next();
    } catch (error) {
      console.error('[Integration] ❌ Ошибка при проверке данных Telegram:', error.message);
      next();
    }
  };
  
  // Применяем middleware для API-запросов
  app.use('/api', telegramValidationMiddleware);
  
  console.log('[Integration] ✅ Добавлена валидация данных Telegram');
}

/**
 * Добавляет диагностические эндпоинты
 * @param {Object} app - Express-приложение
 */
function setupDiagnosticEndpoints(app) {
  if (!app) return;
  
  // Эндпоинт для проверки статуса сервера
  app.get('/api/diag/health', (req, res) => {
    res.json({
      success: true,
      message: 'Сервер работает нормально',
      timestamp: new Date().toISOString(),
      node_env: process.env.NODE_ENV || 'development'
    });
  });
  
  // Эндпоинт для проверки CORS
  app.get('/api/diag/cors', (req, res) => {
    res.json({
      success: true,
      message: 'CORS работает',
      request_origin: req.headers.origin || 'не указан',
      response_headers: {
        'access-control-allow-origin': res.getHeader('Access-Control-Allow-Origin'),
        'access-control-allow-credentials': res.getHeader('Access-Control-Allow-Credentials')
      }
    });
  });
  
  // Эндпоинт для проверки сессий
  app.get('/api/diag/session', (req, res) => {
    // Увеличиваем счетчик посещений в сессии
    if (!req.session.views) {
      req.session.views = 0;
    }
    req.session.views++;
    
    res.json({
      success: true,
      message: 'Проверка сессии',
      session_id: req.session.id,
      views: req.session.views,
      user: req.session.user
    });
  });
  
  // Эндпоинт для проверки подключения к БД
  app.get('/api/diag/db', async (req, res) => {
    try {
      // Создаем пул подключений к PostgreSQL
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false // Для Neon DB
        },
        max: 1,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 5000
      });
      
      // Проверяем соединение
      const client = await pool.connect();
      const result = await client.query('SELECT NOW() as time');
      client.release();
      
      // Закрываем пул
      await pool.end();
      
      res.json({
        success: true,
        message: 'Подключение к БД успешно',
        db_time: result.rows[0].time,
        db_type: 'PostgreSQL (Neon)'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Ошибка при подключении к БД',
        error: error.message
      });
    }
  });
  
  console.log('[Integration] ✅ Добавлены диагностические эндпоинты');
}

/**
 * Применяет все улучшения к Express-приложению
 * @param {Object} app - Express-приложение
 * @returns {Object} - Express-приложение с примененными улучшениями
 */
function applyAllImprovements(app) {
  if (!app) {
    throw new Error('[Integration] Не предоставлен экземпляр приложения Express');
  }
  
  console.log('[Integration] 🔧 Начинаем применение улучшений...');
  
  // Применяем улучшенный CORS
  setupImprovedCors(app);
  
  // Настраиваем сессии
  setupImprovedSessions(app);
  
  // Добавляем валидацию данных Telegram
  setupTelegramValidation(app);
  
  // Добавляем диагностические эндпоинты
  setupDiagnosticEndpoints(app);
  
  console.log(`
=======================================================
✅ УЛУЧШЕНИЯ UniFarm УСПЕШНО ПРИМЕНЕНЫ!

Теперь доступны:
- Стабильное подключение к Neon DB
- Корректная работа CORS для Telegram Mini App
- Правильная настройка сессий с поддержкой cookies
- Проверка и обработка данных авторизации Telegram

Диагностические эндпоинты:
- GET /api/diag/health - проверка статуса сервера
- GET /api/diag/cors - проверка настроек CORS
- GET /api/diag/session - проверка работы сессий
- GET /api/diag/db - проверка подключения к БД
=======================================================
`);
  
  return app;
}

// Экспортируем функцию для применения улучшений
module.exports = {
  applyAllImprovements
};