/**
 * Оптимізований сервер для роботи з Telegram Mini App
 * з підтримкою аварійного режиму in-memory
 */

import { spawn } from 'child_process';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import http from 'http';

// Отримуємо шлях до поточного файлу
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Налаштовуємо змінні оточення для роботи з in-memory сховищем
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
process.env.PORT = process.env.PORT || '3000';

// Константи
const PORT = process.env.PORT || 3000;
const MAX_RESTART_ATTEMPTS = 10;
const RESTART_DELAY_MS = 3000; // 3 секунди
const HEARTBEAT_INTERVAL_MS = 60000; // 1 хвилина

let restartCount = 0;
let serverProcess = null;
let heartbeatInterval = null;

console.log('==========================================================');
console.log('  UNIFARM TELEGRAM MINI APP - СТАБІЛЬНИЙ СЕРВЕР');
console.log('==========================================================');
console.log('Час запуску:', new Date().toISOString());
console.log('Режим: In-Memory Storage');
console.log('==========================================================');

/**
 * Знаходить головний файл для запуску сервера
 */
function findServerFile() {
  const possibleFiles = [
    { path: './dist/index.js', command: 'node', args: ['dist/index.js'] },
    { path: './server/index.ts', command: 'npx', args: ['tsx', 'server/index.ts'] },
    { path: './index.js', command: 'node', args: ['index.js'] }
  ];

  for (const file of possibleFiles) {
    if (fs.existsSync(file.path)) {
      console.log(`[Server] Знайдено файл запуску: ${file.path}`);
      return file;
    }
  }

  throw new Error('Жодного підходящого файлу для запуску сервера не знайдено');
}

/**
 * Створює HTTP-сервер для перевірки здоров'я та стабільності
 */
function startHealthServer() {
  const healthServer = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        restarts: restartCount,
        mode: 'memory-storage'
      }));
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  const healthPort = parseInt(PORT) + 1;
  healthServer.listen(healthPort, () => {
    console.log(`[Health] Health-check сервер запущено на порту ${healthPort}`);
  });

  healthServer.on('error', (err) => {
    console.error(`[Health] Помилка health-сервера: ${err.message}`);
  });
}

/**
 * Запускає сервер UniFarm
 */
function startServer() {
  try {
    const serverFile = findServerFile();
    
    console.log(`[Server] Запуск сервера командою: ${serverFile.command} ${serverFile.args.join(' ')}`);
    
    const env = {
      ...process.env,
      FORCE_MEMORY_STORAGE: 'true',
      ALLOW_MEMORY_FALLBACK: 'true',
      USE_MEMORY_SESSION: 'true',
      IGNORE_DB_CONNECTION_ERRORS: 'true',
      DATABASE_PROVIDER: 'memory',
      SKIP_PARTITION_CREATION: 'true',
      IGNORE_PARTITION_ERRORS: 'true',
      SKIP_TELEGRAM_CHECK: 'true', 
      ALLOW_BROWSER_ACCESS: 'true',
      NODE_ENV: 'production'
    };
    
    // Запускаємо сервер як дочірній процес
    serverProcess = spawn(serverFile.command, serverFile.args, {
      env,
      stdio: 'inherit'
    });
    
    // Обробники подій сервера
    serverProcess.on('exit', (code) => {
      console.log(`[Server] Сервер завершив роботу з кодом: ${code}`);
      handleServerExit(code);
    });
    
    serverProcess.on('error', (err) => {
      console.error(`[Server] Помилка сервера: ${err.message}`);
      handleServerExit(1);
    });
    
    // Запускаємо heartbeat для підтримки процесу
    startHeartbeat();
  } catch (error) {
    console.error(`[Server] Помилка запуску: ${error.message}`);
    handleServerExit(1);
  }
}

/**
 * Обробляє завершення роботи сервера
 */
function handleServerExit(code) {
  // Зупиняємо heartbeat
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  if (code !== 0) {
    restartCount++;
    
    if (restartCount <= MAX_RESTART_ATTEMPTS) {
      console.log(`[Server] Спроба перезапуску #${restartCount}/${MAX_RESTART_ATTEMPTS} через ${RESTART_DELAY_MS}ms...`);
      
      setTimeout(() => {
        startServer();
      }, RESTART_DELAY_MS);
    } else {
      console.error(`[Server] Перевищено ліміт перезапусків (${MAX_RESTART_ATTEMPTS}). Завершуємо роботу.`);
      process.exit(1);
    }
  }
}

/**
 * Запускає heartbeat для підтримки процесу
 */
function startHeartbeat() {
  heartbeatInterval = setInterval(() => {
    console.log(`[Heartbeat] Сервер працює (uptime: ${process.uptime().toFixed(2)}s, рестарти: ${restartCount})`);
  }, HEARTBEAT_INTERVAL_MS);
}

// Обробники необроблених помилок Node.js
process.on('uncaughtException', (err) => {
  console.error(`[Process] Необроблена помилка: ${err.message}`);
  console.error(err.stack);
  // Продовжуємо роботу, не завершуємо процес
});

process.on('unhandledRejection', (reason) => {
  console.error(`[Process] Необроблене відхилення Promise: ${reason}`);
  // Продовжуємо роботу, не завершуємо процес
});

// Запускаємо сервер та моніторинг
try {
  startHealthServer();
  startServer();
  
  console.log('[Server] Сервер запущено успішно');
} catch (error) {
  console.error(`[Startup] Критична помилка: ${error.message}`);
  process.exit(1);
}