/**
 * Интегратор исправлений для UniFarm
 * 
 * Этот модуль объединяет все созданные исправления и применяет их к приложению
 * Импортируется в начале файла server/index.ts или server/routes.ts
 */

// Применяем фиксы для базы данных сразу
require('./db-connection-fix');

// Импортируем модули исправлений
const corsMiddleware = require('./fixed-cors-middleware');
const sessionManager = require('./session-manager');
const telegramAuthUtils = require('./telegram-auth-utils');
const { Pool } = require('pg');

/**
 * Проверяет наличие необходимых переменных окружения
 * @returns {boolean} - Результат проверки
 */
function checkRequiredEnvVars() {
  const requiredVars = [
    'DATABASE_URL',
    'TELEGRAM_BOT_TOKEN'
  ];
  
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error(`[App Integrator] ❌ Отсутствуют необходимые переменные окружения: ${missingVars.join(', ')}`);
    return false;
  }
  
  return true;
}

/**
 * Применяет все исправления к приложению Express
 * @param {Object} app - Экземпляр приложения Express
 * @returns {Object} - Настроенное приложение Express
 */
function applyAllFixes(app) {
  if (!app) {
    throw new Error('[App Integrator] Не предоставлен экземпляр приложения Express');
  }
  
  console.log('[App Integrator] 🔧 Начало применения исправлений...');
  
  // Проверяем наличие необходимых переменных окружения
  checkRequiredEnvVars();
  
  // Создаем пул подключений к базе данных
  let pool = null;
  
  try {
    if (process.env.DATABASE_URL) {
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false // Для Neon DB
        },
        max: 20, // Ограничиваем размер пула
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000
      });
      
      console.log('[App Integrator] ✅ Пул подключений к базе данных создан');
    }
  } catch (error) {
    console.error(`[App Integrator] ❌ Ошибка при создании пула подключений: ${error.message}`);
  }
  
  // Применяем исправления
  try {
    // 1. Применяем улучшенный CORS middleware
    corsMiddleware(app);
    
    // 2. Настраиваем сессии
    sessionManager.setupSessionManager(app, pool);
    
    // 3. Настраиваем маршрут восстановления сессии
    try {
      // Пытаемся получить доступ к хранилищу данных
      let storage = null;
      
      // Импортируем хранилище, если оно существует
      try {
        storage = require('./server/storage').storage;
        console.log('[App Integrator] ✅ Хранилище данных импортировано успешно');
      } catch (error) {
        console.warn(`[App Integrator] ⚠️ Не удалось импортировать хранилище данных: ${error.message}`);
      }
      
      // Настраиваем маршрут восстановления сессии
      sessionManager.setupSessionRestoreRoute(app, storage);
    } catch (error) {
      console.error(`[App Integrator] ❌ Ошибка при настройке маршрута восстановления сессии: ${error.message}`);
    }
    
    // 4. Добавляем маршрут для проверки статуса подключения к БД
    app.get('/api/admin/db-status', async (req, res) => {
      try {
        if (!pool) {
          return res.status(500).json({
            success: false,
            error: 'Пул подключений к базе данных не инициализирован'
          });
        }
        
        // Получаем клиента из пула
        const client = await pool.connect();
        
        try {
          // Выполняем простой запрос
          const result = await client.query('SELECT NOW() as time');
          
          // Проверяем существование необходимых таблиц
          const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            AND table_name IN ('auth_users', 'sessions', 'transactions')
            ORDER BY table_name
          `);
          
          const tables = tablesResult.rows.map(row => row.table_name);
          
          return res.json({
            success: true,
            data: {
              serverTime: result.rows[0].time,
              database: 'PostgreSQL (Neon)',
              tables,
              connectionPool: {
                totalCount: pool.totalCount,
                idleCount: pool.idleCount,
                waitingCount: pool.waitingCount
              }
            }
          });
        } finally {
          client.release();
        }
      } catch (error) {
        console.error(`[App Integrator] ❌ Ошибка при проверке статуса БД: ${error.message}`);
        
        return res.status(500).json({
          success: false,
          error: `Ошибка подключения к базе данных: ${error.message}`
        });
      }
    });
    
    // 5. Добавляем маршрут для проверки статуса сессий
    app.get('/api/admin/session-status', (req, res) => {
      try {
        return res.json({
          success: true,
          data: {
            sessionEnabled: true,
            hasSessionId: !!req.session.id,
            isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : false,
            sessionUser: req.session.user ? {
              id: req.session.user.id,
              username: req.session.user.username
            } : null
          }
        });
      } catch (error) {
        console.error(`[App Integrator] ❌ Ошибка при проверке статуса сессий: ${error.message}`);
        
        return res.status(500).json({
          success: false,
          error: `Ошибка при проверке статуса сессий: ${error.message}`
        });
      }
    });
    
    console.log('[App Integrator] ✅ Все исправления успешно применены');
  } catch (error) {
    console.error(`[App Integrator] ❌ Критическая ошибка при применении исправлений: ${error.message}`);
  }
  
  return app;
}

// Экспортируем функцию для применения исправлений
module.exports = {
  applyAllFixes
};

// Если файл запущен напрямую, выводим информацию
if (require.main === module) {
  console.log(`
===================================================
 UniFarm - Интегратор исправлений для приложения
===================================================

Этот модуль объединяет все созданные исправления и 
применяет их к приложению. Для использования 
импортируйте этот файл в начале server/index.ts 
или server/routes.ts и вызовите функцию:

const integrator = require('./app-integrator');
integrator.applyAllFixes(app);

Где app - это экземпляр приложения Express.
===================================================
`);
}