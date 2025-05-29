/**
 * Спеціальний скрипт для запуску UniFarm в якості Telegram Mini App
 * 
 * Цей скрипт виконує такі завдання:
 * 1. Запускає сервер в режимі in-memory
 * 2. Забезпечує стабільну роботу без залежності від БД
 * 3. Підтримує active keep-alive для запобігання відключенню
 */

// Підвантажуємо необхідні модулі
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

// Отримуємо поточний шлях до файлу
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Базові налаштування
const PORT = process.env.PORT || '3000';
const KEEP_ALIVE_INTERVAL = 30000; // 30 секунд
let keepAliveInterval = null;

// Встановлюємо змінні середовища для роботи в режимі memory storage
process.env.FORCE_MEMORY_STORAGE = 'true';
process.env.ALLOW_MEMORY_FALLBACK = 'true';
process.env.USE_MEMORY_SESSION = 'true';
process.env.IGNORE_DB_CONNECTION_ERRORS = 'true';
process.env.DATABASE_PROVIDER = 'memory';
process.env.SKIP_PARTITION_CREATION = 'true';
process.env.IGNORE_PARTITION_ERRORS = 'true';
process.env.SKIP_TELEGRAM_CHECK = 'true';
process.env.ALLOW_BROWSER_ACCESS = 'true';
process.env.NODE_ENV = 'production';

// Сервер
let serverProcess = null;

/**
 * Функція для запуску сервера
 */
function startServer() {
  console.log('===================================================');
  console.log('  UNIFARM TELEGRAM MINI APP WORKFLOW');
  console.log('===================================================');
  console.log(`Час запуску: ${new Date().toISOString()}`);
  console.log('Режим: In-Memory Storage');
  console.log('Порт: ' + PORT);
  console.log('===================================================');
  
  // Визначаємо файл для запуску
  let startupFile = './server/index.ts';
  let command = 'npx';
  let args = ['tsx', 'server/index.ts'];
  
  if (fs.existsSync('./dist/index.js')) {
    startupFile = './dist/index.js';
    command = 'node';
    args = ['dist/index.js'];
  } else if (fs.existsSync('./index.js')) {
    startupFile = './index.js';
    command = 'node';
    args = ['index.js'];
  }
  
  console.log(`Запуск файлу: ${startupFile}`);
  
  // Налаштовуємо середовище
  const env = {
    ...process.env,
    FORCE_MEMORY_STORAGE: 'true',
    ALLOW_MEMORY_FALLBACK: 'true',
    USE_MEMORY_SESSION: 'true',
    IGNORE_DB_CONNECTION_ERRORS: 'true',
    DATABASE_PROVIDER: 'memory',
    SKIP_PARTITION_CREATION: 'true',
    IGNORE_PARTITION_ERRORS: 'true'
  };
  
  // Запускаємо сервер
  serverProcess = spawn(command, args, {
    env,
    stdio: 'inherit'
  });
  
  // Обробники подій для перезапуску за потреби
  serverProcess.on('error', (error) => {
    console.error('Помилка запуску сервера:', error);
    restartServer();
  });
  
  serverProcess.on('exit', (code) => {
    console.log(`Сервер завершив роботу з кодом ${code}`);
    if (code !== 0) {
      restartServer();
    }
  });
  
  // Активуємо keep-alive
  setupKeepAlive();
}

/**
 * Функція для перезапуску сервера
 */
function restartServer() {
  console.log('Перезапуск сервера через 5 секунд...');
  clearInterval(keepAliveInterval);
  
  setTimeout(() => {
    console.log('Перезапуск сервера...');
    startServer();
  }, 5000);
}

/**
 * Функція для підтримки сервера активним
 */
function setupKeepAlive() {
  console.log('Активовано keep-alive');
  
  // Очищаємо попередній інтервал, якщо такий існує
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }
  
  // Встановлюємо новий інтервал
  keepAliveInterval = setInterval(() => {
    console.log(`[Keep-Alive] Сервер активний. Час: ${new Date().toISOString()}`);
  }, KEEP_ALIVE_INTERVAL);
}

// Запускаємо сервер
startServer();

// Обробники необроблених помилок
process.on('uncaughtException', (error) => {
  console.error('Необроблена помилка:', error);
  // Продовжуємо роботу
});

process.on('unhandledRejection', (reason) => {
  console.error('Необроблене відхилення Promise:', reason);
  // Продовжуємо роботу
});