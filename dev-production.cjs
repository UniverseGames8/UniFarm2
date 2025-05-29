/**
 * Скрипт для запуска приложения в режиме разработки, но с переменными окружения из production.
 * Это позволяет тестировать в локальной среде с настройками, аналогичными производственным.
 * 
 * Запуск: node dev-production.cjs
 */

// Устанавливаем переменные окружения перед импортом других модулей
process.env.NODE_ENV = 'production';

// Запускаем сервер с помощью tsx (TypeScript с поддержкой ESModules)
const { spawn } = require('child_process');

console.log('[DEV-PRODUCTION] 🚀 Запуск приложения в режиме production...');
console.log('[DEV-PRODUCTION] 🔧 NODE_ENV = production');

// Запускаем сервер с помощью tsx
const server = spawn('npx', ['tsx', 'server/index.ts'], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' }
});

// Обработка событий процесса
server.on('error', (error) => {
  console.error('[DEV-PRODUCTION] ❌ Ошибка запуска сервера:', error);
});

server.on('close', (code) => {
  console.log(`[DEV-PRODUCTION] 🛑 Сервер остановлен с кодом: ${code}`);
});

// Обработка завершения скрипта
process.on('SIGINT', () => {
  console.log('[DEV-PRODUCTION] 🛑 Завершение работы по запросу пользователя...');
  server.kill();
  process.exit(0);
});