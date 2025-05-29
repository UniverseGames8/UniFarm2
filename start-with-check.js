/**
 * Скрипт запуска UniFarm с активной проверкой Telegram WebApp
 * 
 * Запускает приложение в режиме с обязательной проверкой на Telegram-окружение
 */

// Устанавливаем переменные среды для правильной работы приложения
process.env.NODE_ENV = 'production';
process.env.PORT = 3000;
process.env.FORCE_NEON_DB = 'true';
process.env.OVERRIDE_DB_PROVIDER = 'neon';
process.env.TELEGRAM_CHECK_ENABLED = 'true';

console.log('===============================================');
console.log('UNIFARM STARTUP - С ПРОВЕРКОЙ TELEGRAM');
console.log('===============================================');
console.log('DATABASE_PROVIDER = neon');
console.log('FORCE_NEON_DB = true');
console.log('OVERRIDE_DB_PROVIDER = neon');
console.log('TELEGRAM_CHECK_ENABLED = true'); 
console.log('NODE_ENV = production');
console.log('PORT = 3000');
console.log('===============================================');

console.log('===================================================');
console.log('  ЗАПУСК UNIFARM С ОБЯЗАТЕЛЬНОЙ ПРОВЕРКОЙ TELEGRAM');
console.log('===================================================');
console.log('Start time:', new Date().toISOString());
console.log('Настройки запуска: Проверка Telegram ВКЛЮЧЕНА');
console.log('===================================================');

// Запускаем основное приложение
try {
  require('./start-unified.js');
} catch (error) {
  console.error('Ошибка запуска приложения:', error);
  process.exit(1);
}