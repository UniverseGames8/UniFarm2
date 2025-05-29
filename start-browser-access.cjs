/**
 * Скрипт запуска UniFarm для прямого доступа через браузер без проверки Telegram
 * Использовать для деплоя в Replit
 */

// Устанавливаем переменные среды для правильной работы приложения
process.env.NODE_ENV = 'production';
process.env.PORT = 3000;
process.env.FORCE_NEON_DB = 'true';
process.env.OVERRIDE_DB_PROVIDER = 'neon';
process.env.DISABLE_REPLIT_DB = 'true';
process.env.SKIP_TELEGRAM_CHECK = 'true';
process.env.ALLOW_BROWSER_ACCESS = 'true';

console.log('===============================================');
console.log('UNIFARM ЗАПУСК С ДОСТУПОМ ЧЕРЕЗ БРАУЗЕР');
console.log('===============================================');
console.log('DATABASE_PROVIDER = neon');
console.log('FORCE_NEON_DB = true');
console.log('DISABLE_REPLIT_DB = true');
console.log('OVERRIDE_DB_PROVIDER = neon');
console.log('SKIP_TELEGRAM_CHECK = true'); 
console.log('ALLOW_BROWSER_ACCESS = true');
console.log('NODE_ENV = production');
console.log('PORT = 3000');
console.log('===============================================');

console.log('===================================================');
console.log('  ЗАПУСК UNIFARM БЕЗ ПРОВЕРКИ TELEGRAM');
console.log('===================================================');
console.log('Start time:', new Date().toISOString());
console.log('Database settings: NEON DB');
console.log('===================================================');

// Определяем, какой файл запуска использовать
let startupFilePath = './dist/index.js';
const fs = require('fs');

// Проверяем наличие файла
if (fs.existsSync(startupFilePath)) {
  console.log(`Found ${startupFilePath}, starting application...`);
  console.log('Starting with environment variables:');
  console.log('DATABASE_PROVIDER =', process.env.DATABASE_PROVIDER);
  console.log('FORCE_NEON_DB =', process.env.FORCE_NEON_DB);
  console.log('DISABLE_REPLIT_DB =', process.env.DISABLE_REPLIT_DB);
  console.log('OVERRIDE_DB_PROVIDER =', process.env.OVERRIDE_DB_PROVIDER);
  
  // Явно меняем переменную окружения для отключения проверки Telegram
  console.log('Running: node dist/index.js');
  
  // Запускаем приложение через отдельный процесс
  const { execSync } = require('child_process');
  try {
    execSync('node dist/index.js', { stdio: 'inherit' });
  } catch (error) {
    console.error('Ошибка при запуске приложения:', error);
    process.exit(1);
  }
} else {
  console.error(`Error: Startup file ${startupFilePath} not found!`);
  console.error('Current directory:', process.cwd());
  console.error('Files in current directory:', fs.readdirSync('.').join(', '));
  process.exit(1);
}