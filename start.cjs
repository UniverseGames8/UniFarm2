/**
 * Єдиний стабільний стартовий скрипт для UniFarm
 * Використовується для запуску через кнопку Run в Replit
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Встановлюємо абсолютні шляхи
const ROOT_DIR = process.cwd();
const RUN_SCRIPT = path.join(ROOT_DIR, 'run.js');

console.log('🚀 Запуск UniFarm через стабільний start.cjs');
console.log(`📅 Час запуску: ${new Date().toISOString()}`);
console.log(`📂 Директорія запуску: ${ROOT_DIR}`);
console.log(`📄 Скрипт запуску: ${RUN_SCRIPT}`);

// Перевірка існування файлу run.js
if (!fs.existsSync(RUN_SCRIPT)) {
  console.error(`❌ Помилка: Файл ${RUN_SCRIPT} не знайдено!`);
  process.exit(1);
}

// Встановлюємо необхідні змінні оточення для стабільної роботи
process.env.SKIP_TELEGRAM_CHECK = 'true';
process.env.ALLOW_BROWSER_ACCESS = 'true';
process.env.NODE_ENV = 'production';
process.env.PORT = '3000';
process.env.HOST = '0.0.0.0';
process.env.SKIP_PROCESS_EXIT = 'true';
process.env.ALLOW_MEMORY_FALLBACK = 'true';
process.env.DISABLE_PARTITION_CHECK = 'true';
process.env.IGNORE_DB_CONNECTION_ERRORS = 'true';

// Встановлюємо глобальну змінну для контролю стану Telegram бота
if (typeof global.telegramBotInitialized === 'undefined') {
  global.telegramBotInitialized = false;
}

console.log('🔄 Запуск сервера через run.js...');

// Запускаємо скрипт run.js у окремому процесі
const serverProcess = spawn('node', [RUN_SCRIPT], {
  stdio: 'inherit',
  detached: false,
  env: process.env
});

// Обробка сигналів для коректного завершення
process.on('SIGINT', () => {
  console.log('🛑 Отримано сигнал SIGINT, зупиняємо сервер...');
  serverProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('🛑 Отримано сигнал SIGTERM, зупиняємо сервер...');
  serverProcess.kill('SIGTERM');
});

// Обробка завершення процесу
serverProcess.on('exit', (code, signal) => {
  console.log(`⚠️ Процес сервера завершився з кодом ${code} та сигналом ${signal}`);
  
  if (code !== 0) {
    console.log('🔄 Автоматичний перезапуск через 3 секунди...');
    setTimeout(() => {
      console.log('🔄 Перезапуск сервера...');
      spawn('node', [__filename], { 
        stdio: 'inherit',
        detached: true
      });
    }, 3000);
  }
});

// Дотримуємо процес start.js активним
console.log('✅ Сервер запущено, моніторинг активний');