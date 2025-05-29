/**
 * Универсальный адаптер для интеграции всех исправлений в UniFarm
 * 
 * Этот модуль обеспечивает:
 * 1. Стабильное подключение к Neon DB
 * 2. Корректную настройку CORS для работы с Telegram Mini App
 * 3. Правильную работу сессий с cookies
 * 4. Проверку и обработку данных авторизации Telegram
 * 
 * Вся функциональность реализована без изменения оригинального кода,
 * путем предоставления обертки над существующими компонентами.
 */

// Глобальная конфигурация для подключения к БД
require('./db-selector-fix');

// Импортируем утилиты для проверки Telegram initData
const telegramAuthUtils = require('./telegram-auth-utils');

// Импортируем middleware для корректной работы с cookies
const cookieParser = require('cookie-parser');

// Утилиты для интеграции маршрутов
const { applyRoutesImprovements } = require('./routes-integrator');

/**
 * Интегрирует исправления в запущенное Express-приложение UniFarm
 * @param {Object} app - Express-приложение
 * @returns {Object} - Express-приложение с примененными исправлениями
 */
function setupAdapter(app) {
  if (!app) {
    throw new Error('[Adapter] Не предоставлен экземпляр приложения Express');
  }
  
  console.log('[Adapter] 🛠️ Начинаем интеграцию исправлений в UniFarm...');
  
  // Применяем middleware для работы с cookies
  app.use(cookieParser());
  
  // Применяем улучшения для маршрутов
  applyRoutesImprovements(app);
  
  // Добавляем диагностические эндпоинты
  setupDiagnosticEndpoints(app);
  
  console.log('[Adapter] ✅ Интеграция исправлений успешно завершена');
  
  return app;
}

/**
 * Настраивает диагностические эндпоинты для проверки работы исправлений
 * @param {Object} app - Express-приложение
 */
function setupDiagnosticEndpoints(app) {
  // Эндпоинт для проверки работы сессий
  app.get('/api/diag/session-check', (req, res) => {
    const sessionInfo = {
      hasSession: !!req.session,
      sessionId: req.session ? req.session.id : null,
      user: req.session && req.session.user ? {
        id: req.session.user.id,
        username: req.session.user.username
      } : null,
      cookies: {
        hasCookies: Object.keys(req.cookies).length > 0,
        cookieCount: Object.keys(req.cookies).length,
        cookieNames: Object.keys(req.cookies)
      }
    };
    
    res.json({
      success: true,
      message: 'Диагностика сессий и cookies',
      data: sessionInfo
    });
  });
  
  // Эндпоинт для проверки работы CORS
  app.get('/api/diag/cors-check', (req, res) => {
    const corsHeaders = {
      allowOrigin: res.getHeader('Access-Control-Allow-Origin'),
      allowCredentials: res.getHeader('Access-Control-Allow-Credentials'),
      allowMethods: res.getHeader('Access-Control-Allow-Methods'),
      allowHeaders: res.getHeader('Access-Control-Allow-Headers')
    };
    
    res.json({
      success: true,
      message: 'Диагностика CORS',
      data: {
        corsHeaders,
        requestOrigin: req.headers.origin || 'не указан',
        requestMethod: req.method
      }
    });
  });
  
  // Эндпоинт для проверки работы Telegram Auth
  app.post('/api/diag/telegram-auth-check', (req, res) => {
    const initData = req.body.initData || req.headers['telegram-init-data'] || req.headers['x-telegram-init-data'];
    
    if (!initData) {
      return res.status(400).json({
        success: false,
        message: 'Отсутствует initData в запросе',
        error: 'MISSING_INIT_DATA'
      });
    }
    
    const telegramData = telegramAuthUtils.processTelegramInitData(initData);
    
    res.json({
      success: true,
      message: 'Диагностика Telegram Auth',
      data: {
        isValid: telegramData.isValid,
        error: telegramData.error,
        user: telegramData.user ? {
          telegramId: telegramData.user.telegramId,
          firstName: telegramData.user.firstName,
          username: telegramData.user.username
        } : null
      }
    });
  });
  
  // Эндпоинт для проверки подключения к базе данных
  app.get('/api/diag/db-check', async (req, res) => {
    try {
      const { Pool } = require('pg');
      
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
        message: 'Диагностика подключения к БД',
        data: {
          dbTime: result.rows[0].time,
          connectionString: process.env.DATABASE_URL ? 'установлен' : 'отсутствует',
          dbProvider: process.env.DATABASE_PROVIDER || 'не указан',
          forceNeonDb: process.env.FORCE_NEON_DB === 'true'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Ошибка при подключении к БД',
        error: error.message
      });
    }
  });
  
  console.log('[Adapter] ✅ Диагностические эндпоинты настроены');
}

// Экспортируем функцию для применения исправлений
module.exports = {
  setupAdapter
};