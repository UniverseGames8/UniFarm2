/**
 * Скрипт для запуска приложения с принудительным использованием Neon DB
 * для использования в Replit Workflow
 */

// Загружаем переменные окружения из .env.neon
require('dotenv').config({ path: '.env.neon' });

// Устанавливаем критические переменные окружения для использования Neon DB
process.env.DATABASE_PROVIDER = 'neon';
process.env.FORCE_NEON_DB = 'true';
process.env.DISABLE_REPLIT_DB = 'true';
process.env.OVERRIDE_DB_PROVIDER = 'neon';
process.env.NODE_ENV = 'production';

console.log('🚀 Запуск UniFarm с принудительным использованием Neon DB');
console.log('📊 Настройки базы данных:');
console.log('  DATABASE_PROVIDER:', process.env.DATABASE_PROVIDER);
console.log('  FORCE_NEON_DB:', process.env.FORCE_NEON_DB);
console.log('  NODE_ENV:', process.env.NODE_ENV);

// Импортируем исходный сервер из dist
require('./dist/index.js');