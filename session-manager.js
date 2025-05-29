/**
 * Менеджер сессий для приложения
 * Обеспечивает корректную настройку и работу с сессиями
 */

const session = require('express-session');
// Используем PG Store для хранения сессий
const pgSession = require('connect-pg-simple')(session);

/**
 * Настройка сессий для Express
 * @param {Object} app - Экземпляр приложения Express
 * @param {Object} pool - Пул подключений к PostgreSQL
 * @returns {Object} - Настроенное приложение Express
 */
function setupSessionManager(app, pool) {
  if (!app) {
    throw new Error('[Session Manager] Не предоставлен экземпляр приложения Express');
  }
  
  if (!pool && !process.env.DATABASE_URL) {
    console.warn('[Session Manager] ⚠️ Не предоставлен пул подключений и отсутствует DATABASE_URL, сессии будут храниться в памяти');
  }
  
  // Попытка создания таблицы сессий, если она отсутствует
  tryCreateSessionTable(pool);
  
  // Настройки хранилища сессий
  let store;
  
  if (pool) {
    try {
      // Используем PG Store для хранения сессий в PostgreSQL
      store = new pgSession({
        pool,
        tableName: 'sessions', // Имя таблицы для хранения сессий
        createTableIfMissing: true // Создаём таблицу, если отсутствует
      });
      
      console.log('[Session Manager] ✅ Настроено хранилище сессий в PostgreSQL');
    } catch (error) {
      console.error(`[Session Manager] ❌ Ошибка при настройке хранилища сессий: ${error.message}`);
      console.warn('[Session Manager] ⚠️ Использование хранилища сессий в памяти (не рекомендуется для production)');
      
      // В случае ошибки используем MemoryStore (не рекомендуется для production)
      store = new session.MemoryStore();
    }
  } else {
    // Если пул не предоставлен, используем MemoryStore
    store = new session.MemoryStore();
  }
  
  // Настройки сессии
  const sessionOptions = {
    store,
    secret: process.env.SESSION_SECRET || 'uni-farm-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // Только HTTPS в production
      httpOnly: true,
      sameSite: 'none', // Для работы с Telegram Mini App
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 дней
    }
  };
  
  // В production принудительно используем secure cookies
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1); // Доверяем первому прокси (например, Replit)
    sessionOptions.cookie.secure = true;
  }
  
  // Применяем middleware для сессий
  app.use(session(sessionOptions));
  
  // Добавляем middleware для инициализации сессии пользователя
  app.use(initializeUserSession);
  
  console.log('[Session Manager] ✅ Настройка сессий завершена');
  
  return app;
}

/**
 * Попытка создания таблицы сессий в базе данных
 * @param {Object} pool - Пул подключений к PostgreSQL
 */
async function tryCreateSessionTable(pool) {
  if (!pool) return;
  
  try {
    const client = await pool.connect();
    
    try {
      // Создаем таблицу сессий, если она не существует
      await client.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          sid VARCHAR NOT NULL PRIMARY KEY,
          sess JSON NOT NULL,
          expire TIMESTAMP(6) NOT NULL
        )
      `);
      
      // Создаем индекс для быстрого поиска по времени истечения
      await client.query(`
        CREATE INDEX IF NOT EXISTS IDX_sessions_expire ON sessions (expire)
      `);
      
      console.log('[Session Manager] ✅ Таблица сессий проверена/создана');
    } catch (error) {
      console.error(`[Session Manager] ❌ Ошибка при создании таблицы сессий: ${error.message}`);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(`[Session Manager] ❌ Ошибка при подключении к базе данных: ${error.message}`);
  }
}

/**
 * Middleware для инициализации сессии пользователя
 * @param {Object} req - Объект запроса
 * @param {Object} res - Объект ответа
 * @param {Function} next - Следующий middleware
 */
function initializeUserSession(req, res, next) {
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
}

/**
 * Middleware для проверки аутентификации
 * @param {Object} req - Объект запроса
 * @param {Object} res - Объект ответа
 * @param {Function} next - Следующий middleware
 */
function requireAuth(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ 
      success: false, 
      error: 'Требуется авторизация' 
    });
  }
  
  // Пользователь авторизован, продолжаем
  next();
}

/**
 * Создает маршрут для восстановления сессии через Telegram initData
 * @param {Object} app - Экземпляр приложения Express
 * @param {Object} storage - Хранилище данных приложения
 * @returns {Object} - Экземпляр приложения Express
 */
function setupSessionRestoreRoute(app, storage) {
  if (!app) {
    throw new Error('[Session Manager] Не предоставлен экземпляр приложения Express');
  }
  
  if (!storage) {
    console.warn('[Session Manager] ⚠️ Не предоставлено хранилище данных');
  }
  
  // Импортируем утилиты для работы с данными Telegram
  const telegramUtils = require('./telegram-auth-utils');
  
  // Маршрут для восстановления сессии
  app.post('/api/session/restore', async (req, res) => {
    try {
      // Получаем initData из различных возможных источников
      const initData = req.body.initData || 
                       req.headers['telegram-init-data'] || 
                       req.headers['x-telegram-init-data'];
      
      if (!initData) {
        return res.status(400).json({
          success: false,
          error: 'Не предоставлены данные initData от Telegram'
        });
      }
      
      // Обрабатываем данные от Telegram
      const telegramData = telegramUtils.processTelegramInitData(initData);
      
      if (!telegramData.isValid) {
        return res.status(403).json({
          success: false,
          error: telegramData.error || 'Недействительные данные Telegram'
        });
      }
      
      if (!telegramData.user) {
        return res.status(400).json({
          success: false,
          error: 'Не удалось извлечь данные пользователя из initData'
        });
      }
      
      // Ищем пользователя в базе по Telegram ID
      let user = null;
      
      if (storage) {
        try {
          // Пытаемся найти пользователя по Telegram ID
          user = await findUserByTelegramId(storage, telegramData.user.telegramId);
          
          // Если пользователь не найден, создаем нового
          if (!user) {
            user = await createUserFromTelegramData(storage, telegramData.user);
          }
        } catch (error) {
          console.error(`[Session Manager] ❌ Ошибка при поиске/создании пользователя: ${error.message}`);
        }
      }
      
      // Если не удалось найти/создать пользователя, создаем временного
      if (!user) {
        user = {
          id: 1, // Временный ID
          telegram_id: telegramData.user.telegramId,
          username: telegramData.user.username || `user_${telegramData.user.telegramId}`,
          is_temporary: true // Флаг временного пользователя
        };
      }
      
      // Сохраняем пользователя в сессии
      req.login(user);
      
      // Возвращаем успешный ответ
      return res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            username: user.username
          },
          is_temporary: user.is_temporary || false
        }
      });
    } catch (error) {
      console.error(`[Session Manager] ❌ Ошибка при восстановлении сессии: ${error.message}`);
      
      return res.status(500).json({
        success: false,
        error: 'Ошибка при восстановлении сессии'
      });
    }
  });
  
  console.log('[Session Manager] ✅ Маршрут восстановления сессии настроен');
  
  return app;
}

/**
 * Ищет пользователя по Telegram ID
 * @param {Object} storage - Хранилище данных приложения
 * @param {string} telegramId - ID пользователя в Telegram
 * @returns {Promise<Object|null>} - Найденный пользователь или null
 */
async function findUserByTelegramId(storage, telegramId) {
  if (!storage) return null;
  
  try {
    // Проверяем, есть ли метод getUserByTelegramId в хранилище
    if (typeof storage.getUserByTelegramId === 'function') {
      return await storage.getUserByTelegramId(telegramId);
    }
    
    // Если нет специального метода, пытаемся найти через getUserByUsername
    if (typeof storage.getUserByUsername === 'function') {
      // Пробуем найти по username, который может включать telegramId
      return await storage.getUserByUsername(`telegram_${telegramId}`);
    }
    
    return null;
  } catch (error) {
    console.error(`[Session Manager] ❌ Ошибка при поиске пользователя: ${error.message}`);
    return null;
  }
}

/**
 * Создает нового пользователя из данных Telegram
 * @param {Object} storage - Хранилище данных приложения
 * @param {Object} telegramUser - Данные пользователя из Telegram
 * @returns {Promise<Object|null>} - Созданный пользователь или null
 */
async function createUserFromTelegramData(storage, telegramUser) {
  if (!storage) return null;
  
  try {
    // Проверяем, есть ли метод createUser в хранилище
    if (typeof storage.createUser === 'function') {
      // Создаем нового пользователя с данными из Telegram
      const newUser = await storage.createUser({
        username: telegramUser.username || `telegram_${telegramUser.telegramId}`,
        // В зависимости от схемы, может потребоваться добавить другие поля
        telegram_id: telegramUser.telegramId.toString(),
        first_name: telegramUser.firstName,
        last_name: telegramUser.lastName || ''
      });
      
      return newUser;
    }
    
    return null;
  } catch (error) {
    console.error(`[Session Manager] ❌ Ошибка при создании пользователя: ${error.message}`);
    return null;
  }
}

// Экспортируем функции для использования в других модулях
module.exports = {
  setupSessionManager,
  setupSessionRestoreRoute,
  requireAuth
};