/**
 * Улучшенная версия CORS middleware с поддержкой credentials
 * Этот модуль заменяет существующий CORS middleware без изменения исходного кода
 * 
 * При импорте в начале server/index.ts или server/routes.ts обеспечит
 * корректную работу CORS для Telegram Mini App
 */

// Экспортируем улучшенную версию middleware для использования
module.exports = function setupImprovedCors(app) {
  const cors = require('cors');
  
  // Список разрешенных источников для запросов
  const allowedOrigins = [
    'https://web.telegram.org',
    'https://t.me',
    'https://telegram.org',
    'https://telegram.me',
    // Добавляем локальный домен Replit для разработки
    /\.replit\.app$/,
    /\.replit\.dev$/,
    // Для поддержки локальной разработки
    /localhost(:[0-9]+)?$/
  ];
  
  // Настройки CORS
  const corsOptions = {
    origin: function(origin, callback) {
      // Разрешаем запросы без origin (например, от мобильных приложений)
      // или запросы с разрешенных доменов
      if (!origin) {
        return callback(null, true);
      }
      
      // Проверяем, соответствует ли origin разрешенным шаблонам
      const isAllowed = allowedOrigins.some(allowedOrigin => {
        if (allowedOrigin instanceof RegExp) {
          return allowedOrigin.test(origin);
        }
        return origin === allowedOrigin;
      });
      
      if (isAllowed) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Отклонен запрос с origin: ${origin}`);
        callback(null, false);
      }
    },
    credentials: true,
    allowedHeaders: [
      'Content-Type', 
      'Authorization',
      'X-Requested-With',
      'X-Telegram-Init-Data',
      'Telegram-Init-Data',
      'X-Telegram-Data',
      'Telegram-Data',
      'X-Telegram-Auth',
      'X-Telegram-User-Id',
      'X-Telegram-Start-Param',
      'X-Telegram-Platform',
      'X-Telegram-Data-Source',
      'X-Development-Mode',
      'X-Development-User-Id'
    ],
    exposedHeaders: [
      'Set-Cookie'
    ],
    methods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
    preflightContinue: false,
    optionsSuccessStatus: 204
  };
  
  // Применяем настройки CORS
  app.use(cors(corsOptions));
  
  // Добавляем дополнительный обработчик для явного указания заголовков CORS
  // в случае проблем с предварительными запросами OPTIONS
  app.use((req, res, next) => {
    // Получаем origin из запроса
    const origin = req.headers.origin;
    
    // Устанавливаем заголовки CORS для текущего запроса
    if (origin) {
      // Проверяем, соответствует ли origin разрешенным шаблонам
      const isAllowed = allowedOrigins.some(allowedOrigin => {
        if (allowedOrigin instanceof RegExp) {
          return allowedOrigin.test(origin);
        }
        return origin === allowedOrigin;
      });
      
      if (isAllowed) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', 'true');
      }
    }
    
    next();
  });
  
  console.log('[Улучшенный CORS] ✅ Настроен с поддержкой credentials и правильными источниками');
  
  return app;
};