/**
 * Скрипт для запуска UniFarm полностью в режиме in-memory хранилища
 * Игнорирует все ошибки БД и принудительно использует только memory storage
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Находим путь к серверу
const serverPath = fs.existsSync('./server/index.ts') 
  ? './server/index.ts'
  : fs.existsSync('./dist/index.js')
    ? './dist/index.js'
    : './index.js';

console.log(`[Memory Mode] Запуск приложения из: ${serverPath}`);

// Среда запуска с полностью отключенной базой данных
const env = {
  ...process.env,
  // Принудительно используем memory storage
  FORCE_MEMORY_STORAGE: "true",
  DATABASE_PROVIDER: "memory",  
  ALLOW_MEMORY_FALLBACK: "true",
  USE_MEMORY_SESSION: "true",
  
  // Игнорируем все ошибки с БД
  IGNORE_DB_CONNECTION_ERRORS: "true",
  BYPASS_DB_CHECK: "true",
  SKIP_DB_CONNECTION: "true",
  
  // Пропускаем создание партиций и миграций
  SKIP_PARTITION_CREATION: "true",
  IGNORE_PARTITION_ERRORS: "true",
  SKIP_MIGRATIONS: "true",
  
  // Настройки для доступа через браузер
  SKIP_TELEGRAM_CHECK: "true",
  ALLOW_BROWSER_ACCESS: "true",
  
  // Настройки для production
  NODE_ENV: "production",
  PORT: "3000"
};

// Функция для поддержания процесса активным
function keepAlive() {
  setInterval(() => {
    console.log("[Memory Mode] Поддерживаем процесс активным...");
  }, 60000);
}

// Запускаем приложение
console.log('====================================================');
console.log('  UNIFARM - ПРИНУДИТЕЛЬНЫЙ РЕЖИМ IN-MEMORY STORAGE');
console.log('====================================================');
console.log('Время запуска:', new Date().toISOString());
console.log('Переменные окружения:');
console.log(' - DATABASE_PROVIDER:', env.DATABASE_PROVIDER);
console.log(' - FORCE_MEMORY_STORAGE:', env.FORCE_MEMORY_STORAGE);
console.log(' - IGNORE_DB_CONNECTION_ERRORS:', env.IGNORE_DB_CONNECTION_ERRORS);
console.log('====================================================');

// Определяем, как запускать приложение
let command = 'node';
let args = [];

if (serverPath.endsWith('.ts')) {
  // Запуск TypeScript с tsx
  command = 'npx';
  args = ['tsx', serverPath];
} else {
  // Запуск JavaScript с node
  args = [serverPath];
}

// Запускаем сервер как дочерний процесс
const server = spawn(command, args, { 
  env,
  stdio: 'inherit'
});

// Обработчик завершения
server.on('close', (code) => {
  console.log(`[Memory Mode] Процесс завершен с кодом: ${code}`);
  if (code !== 0) {
    console.log('[Memory Mode] Перезапуск через 5 секунд...');
    setTimeout(() => {
      console.log('[Memory Mode] Перезапуск приложения...');
      // Рекурсивно перезапускаем этот скрипт
      const restart = spawn('node', [__filename], { 
        stdio: 'inherit',
        detached: true 
      });
      process.exit(0);
    }, 5000);
  }
});

server.on('error', (err) => {
  console.error('[Memory Mode] Ошибка процесса:', err);
  console.log('[Memory Mode] Перезапуск через 5 секунд...');
  setTimeout(() => {
    console.log('[Memory Mode] Перезапуск приложения...');
    // Рекурсивно перезапускаем этот скрипт при ошибке
    const restart = spawn('node', [__filename], { 
      stdio: 'inherit',
      detached: true 
    });
    process.exit(1);
  }, 5000);
});

// Поддерживаем процесс активным
keepAlive();

// Обработчики ошибок node.js
process.on('uncaughtException', (err) => {
  console.error('[Memory Mode] Необработанное исключение:', err);
  // Процесс продолжит работу
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Memory Mode] Необработанное отклонение обещания:', reason);
  // Процесс продолжит работу
});