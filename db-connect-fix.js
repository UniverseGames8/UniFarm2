/**
 * Модуль для принудительного исправления подключения к базе данных
 * Избегает проблемы с подключением через UNIX socket вместо TCP/IP при нестандартных настройках
 * 
 * Этот модуль нужно подключать в начале приложения ДО импорта db.js или любого взаимодействия с БД
 */

// Отключаем UNIX socket подключение, чтобы принудительно использовать TCP/IP для PostgreSQL
process.env.PGHOST = process.env.PGHOST || 'localhost';  
process.env.PGSSLMODE = 'prefer';
process.env.PGSOCKET = ''; 
process.env.PGCONNECT_TIMEOUT = '10';

// Принудительно переключаем на Neon DB независимо от конфигурации .replit
process.env.DATABASE_PROVIDER = 'neon';
process.env.FORCE_NEON_DB = 'true';
process.env.DISABLE_REPLIT_DB = 'true';
process.env.OVERRIDE_DB_PROVIDER = 'neon';

// Логируем действие в консоль для контроля состояния
console.log('[db-connect-fix] Принудительное переключение на Neon DB и отключение UNIX socket подключения');