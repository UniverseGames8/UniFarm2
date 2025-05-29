// Скрипт для прямого запуска UniFarm без проверки Telegram
// Для использования в деплое Replit

// Импортируем модуль для запуска ESM модулей
import { spawn } from 'child_process';

// Устанавливаем переменные окружения для отключения проверки Telegram
process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || '3000';
process.env.FORCE_NEON_DB = 'true';
process.env.OVERRIDE_DB_PROVIDER = 'neon';
process.env.DATABASE_PROVIDER = 'neon';
process.env.SKIP_TELEGRAM_CHECK = 'true';
process.env.ALLOW_BROWSER_ACCESS = 'true';

console.log('=================================================');
console.log('  UniFarm с прямым доступом через браузер');
console.log('=================================================');
console.log(`DATABASE_PROVIDER = ${process.env.DATABASE_PROVIDER}`);
console.log(`FORCE_NEON_DB = ${process.env.FORCE_NEON_DB}`);
console.log(`OVERRIDE_DB_PROVIDER = ${process.env.OVERRIDE_DB_PROVIDER}`);
console.log(`SKIP_TELEGRAM_CHECK = ${process.env.SKIP_TELEGRAM_CHECK}`);
console.log(`ALLOW_BROWSER_ACCESS = ${process.env.ALLOW_BROWSER_ACCESS}`);
console.log(`PORT = ${process.env.PORT}`);
console.log('=================================================');
console.log(`Время запуска: ${new Date().toISOString()}`);
console.log('=================================================');

// Запускаем сервер с отключенной проверкой Telegram
const server = spawn('node', ['dist/index.js'], { 
  stdio: 'inherit',
  env: process.env
});

server.on('error', (err) => {
  console.error('Ошибка запуска сервера:', err);
  process.exit(1);
});

server.on('close', (code) => {
  console.log(`Сервер завершил работу с кодом ${code}`);
  process.exit(code);
});

// Обработка сигналов для корректного завершения
process.on('SIGINT', () => {
  console.log('Получен сигнал SIGINT, завершаем работу...');
  server.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('Получен сигнал SIGTERM, завершаем работу...');
  server.kill('SIGTERM');
});

console.log('Сервер запущен, ожидаем подключений...');