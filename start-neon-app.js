/**
 * Скрипт для запуска приложения с принудительным использованием Neon DB
 * 
 * Этот скрипт устанавливает необходимые переменные окружения и
 * запускает приложение с настройками Neon DB
 */

// Устанавливаем переменные окружения для Neon DB
process.env.DATABASE_PROVIDER = 'neon';
process.env.FORCE_NEON_DB = 'true';
process.env.DISABLE_REPLIT_DB = 'true';
process.env.OVERRIDE_DB_PROVIDER = 'neon';
process.env.NODE_ENV = 'production';

// Запускаем приложение
console.log('🚀 Запуск приложения с принудительным использованием Neon DB');
console.log('🔍 Используемые настройки:');
console.log('  - DATABASE_PROVIDER =', process.env.DATABASE_PROVIDER);
console.log('  - FORCE_NEON_DB =', process.env.FORCE_NEON_DB);
console.log('  - DISABLE_REPLIT_DB =', process.env.DISABLE_REPLIT_DB);
console.log('  - NODE_ENV =', process.env.NODE_ENV);

// Импортируем и запускаем основной файл приложения
require('./dist/index.js');