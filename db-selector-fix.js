/**
 * Фикс для выбора базы данных и настройки подключения
 * Этот модуль применяет исправления для стабильного подключения к Neon DB
 * 
 * Импортируется в начале server/index.ts перед другими импортами
 */

// Принудительно отключаем Unix сокеты для PostgreSQL
process.env.PGHOST = process.env.PGHOST || 'ep-misty-brook-a4dkea48.us-east-1.aws.neon.tech';
process.env.PGSSLMODE = 'prefer';
process.env.PGSOCKET = '';
process.env.PGCONNECT_TIMEOUT = '10';

// Принудительно переключаем на Neon DB
process.env.DATABASE_PROVIDER = 'neon';
process.env.FORCE_NEON_DB = 'true';
process.env.DISABLE_REPLIT_DB = 'true';
process.env.OVERRIDE_DB_PROVIDER = 'neon';

// Сообщаем об успешном применении фикса
console.log('[DB Selector Fix] ✅ Применены настройки для стабильного подключения к Neon DB');

// Экспортируем пустой объект для совместимости с ESM и CommonJS
module.exports = {};