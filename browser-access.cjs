/**
 * Скрипт запуска UniFarm с отключенной проверкой Telegram WebApp
 * для прямого доступа через браузер
 */

// Устанавливаем переменные среды для правильной работы приложения
process.env.NODE_ENV = 'production';
process.env.PORT = 3000;
process.env.FORCE_NEON_DB = 'true';
process.env.OVERRIDE_DB_PROVIDER = 'neon';
process.env.SKIP_TELEGRAM_CHECK = 'true';
process.env.ALLOW_BROWSER_ACCESS = 'true';

console.log('===============================================');
console.log('UNIFARM STARTUP - ПРЯМОЙ ДОСТУП ЧЕРЕЗ БРАУЗЕР');
console.log('===============================================');
console.log('DATABASE_PROVIDER = neon');
console.log('FORCE_NEON_DB = true');
console.log('OVERRIDE_DB_PROVIDER = neon');
console.log('SKIP_TELEGRAM_CHECK = true'); 
console.log('ALLOW_BROWSER_ACCESS = true');
console.log('NODE_ENV = production');
console.log('PORT = 3000');
console.log('===============================================');

console.log('===================================================');
console.log('  ЗАПУСК UNIFARM С ДОСТУПОМ ЧЕРЕЗ БРАУЗЕР');
console.log('===================================================');
console.log('Start time:', new Date().toISOString());
console.log('Настройки запуска: Проверка Telegram ОТКЛЮЧЕНА');
console.log('===================================================');

// Запускаем основное приложение
try {
  require('./start-unified.cjs');
} catch (error) {
  console.error('Ошибка запуска приложения:', error);
  process.exit(1);
}