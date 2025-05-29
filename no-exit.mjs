/**
 * Специальный скрипт для запуска UniFarm с предотвращением завершения
 * 
 * Запускает сервер и держит его запущенным, предотвращая завершение процесса.
 * Использует простой способ - создает "бесконечный" интервал, блокирующий завершение.
 */

// Запускаем скрипт, фиксируя текущее время
const startTime = new Date();
console.log('====================================================================');
console.log('  ЗАПУСК UNIFARM БЕЗ АВТОМАТИЧЕСКОГО ЗАВЕРШЕНИЯ');
console.log('====================================================================');
console.log(`Время запуска: ${startTime.toISOString()}`);
console.log('====================================================================');

// Запускаем основной сервер через child_process
import { spawn } from 'child_process';

// Устанавливаем переменные окружения
process.env.NODE_ENV = 'production';
process.env.PORT = '3000';
process.env.DATABASE_PROVIDER = 'neon';
process.env.FORCE_NEON_DB = 'true';
process.env.DISABLE_REPLIT_DB = 'true';
process.env.OVERRIDE_DB_PROVIDER = 'neon';
process.env.SKIP_PARTITION_CREATION = 'true';
process.env.IGNORE_PARTITION_ERRORS = 'true';
process.env.KEEP_ALIVE = 'true';

// Запускаем сервер из start-unified.js
const serverProcess = spawn('node', ['start-unified.js'], {
  stdio: 'inherit',
  env: process.env
});

console.log(`Сервер запущен с PID: ${serverProcess.pid}`);

// Обработка завершения дочернего процесса
serverProcess.on('close', (code) => {
  console.log(`Сервер завершил работу с кодом: ${code}`);
  console.log('Перезапуск сервера через 3 секунды...');
  
  // Перезапускаем сервер через 3 секунды
  setTimeout(() => {
    console.log('Перезапуск сервера...');
    process.exit(0); // Завершаем текущий процесс, чтобы Replit автоматически перезапустил workflow
  }, 3000);
});

// Обработка ошибок дочернего процесса
serverProcess.on('error', (err) => {
  console.error(`Ошибка запуска сервера: ${err}`);
});

// Создаем "бесконечную" задачу, которая не дает процессу завершиться
// Это ключевой момент - Node.js не завершит процесс, пока есть активные таймеры или интервалы
const keepAliveInterval = setInterval(() => {
  const uptime = Math.floor((new Date() - startTime) / 1000);
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = uptime % 60;
  
  // Каждые 5 минут выводим информацию о работе
  if (uptime % 300 === 0) {
    console.log(`[KeepAlive] Сервер работает ${hours}ч ${minutes}м ${seconds}с`);
  }
}, 1000);

// Обрабатываем сигналы завершения
process.on('SIGINT', () => {
  console.log('Получен сигнал SIGINT, завершаем работу...');
  clearInterval(keepAliveInterval);
  serverProcess.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Получен сигнал SIGTERM, завершаем работу...');
  clearInterval(keepAliveInterval);
  serverProcess.kill();
  process.exit(0);
});

// Предотвращаем падение при необработанных исключениях
process.on('uncaughtException', (err) => {
  console.error(`Необработанное исключение: ${err}`);
  console.log('Продолжаем работу...');
});

// Сообщаем о запуске
console.log('Процесс no-exit.mjs успешно запущен и поддерживает работу сервера');

// Через 5 секунд после запуска проверяем статус
setTimeout(() => {
  if (serverProcess.killed) {
    console.log('Сервер был завершен. Перезапускаем...');
    process.exit(0); // Завершаем текущий процесс, чтобы Replit автоматически перезапустил workflow
  } else {
    console.log('✅ Сервер успешно запущен и работает');
  }
}, 5000);