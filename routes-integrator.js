/**
 * Интегратор улучшений для маршрутов Express
 * Этот модуль применяет исправления для CORS и сессий без изменения оригинального кода
 * 
 * Импортируется в начале server/routes.ts перед регистрацией маршрутов
 */

// Импортируем необходимые модули
const session = require('express-session');
const { Pool } = require('pg');
const crypto = require('crypto');

/**
 * Применяет улучшенный CORS middleware к приложению Express
 * @param {Object} app - Экземпляр приложения Express
 * @returns {Object} - Экземпляр приложения Express с примененными улучшениями
 */
function applyRoutesImprovements(app) {
  if (!app) {
    throw new Error('[Routes Integrator] Не предоставлен экземпляр приложения Express');
  }
  
  console.log('[Routes Integrator] 🔧 Применение улучшений для маршрутов...');
  
  // Применяем улучшенный CORS middleware
  applyCorsImprovements(app);
  
  // Применяем улучшенную настройку сессий
  applySessionImprovements(app);
  
  // Добавляем улучшенный маршрут для восстановления сессии
  // Это важно для работы с Telegram Mini App
  // Примечание: не заменяет существующий маршрут, а дополняет его
  applyAuthorizationImprovements(app);
  
  console.log('[Routes Integrator] ✅ Улучшения для маршрутов успешно применены');
  
  return app;
}

/**
 * Применяет улучшенный CORS middleware
 * @param {Object} app - Экземпляр приложения Express
 */
function applyCorsImprovements(app) {
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
    
    // Проверяем, разрешен ли origin
    if (origin) {
      // Если origin в списке разрешенных или режим разработки
      if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
        // Устанавливаем конкретный origin вместо * для поддержки credentials
        res.header('Access-Control-Allow-Origin', origin);
        // Важно для работы с cookies
        res.header('Access-Control-Allow-Credentials', 'true');
      } else {
        // В production разрешаем любой origin через wildcard
        // но без credentials (согласно требованиям безопасности)
        res.header('Access-Control-Allow-Origin', '*');
      }
    } else {
      // Для запросов без origin (например, от мобильных приложений)
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
      return res.status(204).end();
    }
    
    next();
  };
  
  // Применяем улучшенный CORS middleware перед другими маршрутами
  app.use(improvedCorsMiddleware);
  
  console.log('[Routes Integrator] ✅ Улучшенный CORS middleware применен');
}

/**
 * Применяет улучшения для сессий
 * @param {Object} app - Экземпляр приложения Express
 */
function applySessionImprovements(app) {
  try {
    // Проверяем наличие DATABASE_URL для использования PostgreSQL как хранилища сессий
    if (!process.env.DATABASE_URL) {
      console.warn('[Routes Integrator] ⚠️ DATABASE_URL не найден, используем MemoryStore для сессий');
      
      // Используем MemoryStore, если нет подключения к базе данных
      const sessionOptions = {
        secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
        resave: false,
        saveUninitialized: false,
        cookie: {
          secure: process.env.NODE_ENV === 'production',
          httpOnly: true,
          sameSite: 'none', // Для работы с Telegram Mini App
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 дней
        }
      };
      
      // В production режиме настраиваем доверие к прокси
      if (process.env.NODE_ENV === 'production') {
        app.set('trust proxy', 1);
        sessionOptions.cookie.secure = true;
      }
      
      // Применяем middleware сессий
      app.use(session(sessionOptions));
      console.log('[Routes Integrator] ✅ Применен middleware сессий с MemoryStore');
    } else {
      // Импортируем модуль для хранения сессий в PostgreSQL
      const pgSession = require('connect-pg-simple')(session);
      
      // Создаем пул подключений к PostgreSQL
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false // Для Neon DB
        }
      });
      
      // Пытаемся создать таблицу сессий, если она не существует
      pool.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          sid VARCHAR NOT NULL PRIMARY KEY,
          sess JSON NOT NULL,
          expire TIMESTAMP(6) NOT NULL
        )
      `).then(() => {
        console.log('[Routes Integrator] ✅ Таблица sessions проверена/создана');
        
        // Создаем индекс для быстрого поиска по времени истечения
        return pool.query(`
          CREATE INDEX IF NOT EXISTS IDX_sessions_expire ON sessions (expire)
        `);
      }).then(() => {
        console.log('[Routes Integrator] ✅ Индекс для таблицы sessions проверен/создан');
      }).catch(error => {
        console.error('[Routes Integrator] ❌ Ошибка при создании таблицы sessions:', error.message);
      });
      
      // Настройки сессии с хранилищем в PostgreSQL
      const sessionOptions = {
        store: new pgSession({
          pool,
          tableName: 'sessions' // Имя таблицы для хранения сессий
        }),
        secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
        resave: false,
        saveUninitialized: false,
        cookie: {
          secure: process.env.NODE_ENV === 'production',
          httpOnly: true,
          sameSite: 'none', // Для работы с Telegram Mini App
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 дней
        }
      };
      
      // В production режиме настраиваем доверие к прокси
      if (process.env.NODE_ENV === 'production') {
        app.set('trust proxy', 1);
        sessionOptions.cookie.secure = true;
      }
      
      // Применяем middleware сессий
      app.use(session(sessionOptions));
      console.log('[Routes Integrator] ✅ Применен middleware сессий с хранилищем в PostgreSQL');
    }
    
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
    
  } catch (error) {
    console.error('[Routes Integrator] ❌ Ошибка при настройке сессий:', error.message);
  }
}

/**
 * Применяет улучшения для авторизации Telegram
 * @param {Object} app - Экземпляр приложения Express
 */
function applyAuthorizationImprovements(app) {
  // Создаем middleware для проверки подписи данных от Telegram
  const validateTelegramInitData = (req, res, next) => {
    try {
      // Получаем initData из различных возможных источников
      const initData = req.body.initData || 
                       req.headers['telegram-init-data'] || 
                       req.headers['x-telegram-init-data'];
      
      // Если нет данных, просто продолжаем
      if (!initData) {
        return next();
      }
      
      // Проверяем наличие токена бота
      if (!process.env.TELEGRAM_BOT_TOKEN) {
        console.warn('[Routes Integrator] ⚠️ TELEGRAM_BOT_TOKEN не установлен, пропускаем проверку подписи');
        return next();
      }
      
      // Разбираем строку initData
      const urlParams = new URLSearchParams(initData);
      const hash = urlParams.get('hash');
      
      if (!hash) {
        console.error('[Routes Integrator] ⚠️ Отсутствует hash в initData');
        return next();
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
      const secretKey = crypto.createHmac('sha256', 'WebAppData').update(process.env.TELEGRAM_BOT_TOKEN).digest();
      const calculatedHash = crypto.createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');
      
      // Проверяем подпись
      const isValid = calculatedHash === hash;
      
      if (!isValid) {
        console.error('[Routes Integrator] ⚠️ Неверная подпись initData');
        console.error(`[Routes Integrator] Вычисленный хеш: ${calculatedHash}`);
        console.error(`[Routes Integrator] Полученный хеш: ${hash}`);
        
        // В разработке позволяем продолжить даже с неверной подписью
        if (process.env.NODE_ENV === 'development') {
          console.log('[Routes Integrator] Режим разработки: пропускаем невалидную подпись');
          return next();
        }
        
        return res.status(403).json({
          success: false,
          error: 'Неверная подпись данных Telegram'
        });
      }
      
      // Подпись верна, сохраняем данные пользователя в запросе
      const userStr = urlParams.get('user');
      
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          req.telegramUser = user;
          console.log(`[Routes Integrator] ✅ Подпись данных Telegram верна, пользователь: ${user.id}`);
        } catch (error) {
          console.error('[Routes Integrator] ❌ Ошибка при разборе данных пользователя:', error.message);
        }
      }
      
      next();
    } catch (error) {
      console.error('[Routes Integrator] ❌ Ошибка при проверке подписи Telegram:', error.message);
      next();
    }
  };
  
  // Применяем middleware для проверки подписи Telegram для всех API-запросов
  app.use('/api', validateTelegramInitData);
  
  console.log('[Routes Integrator] ✅ Применены улучшения для авторизации Telegram');
}

// Экспортируем функцию для применения улучшений
module.exports = {
  applyRoutesImprovements
};