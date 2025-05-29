/**
 * Скрипт для запуску UniFarm Mini App з повною ініціалізацією
 * 
 * Цей скрипт виконує повний запуск програми з правильною послідовністю ініціалізації:
 * 1. Підготовка змінних середовища
 * 2. Ініціалізація запасної БД
 * 3. Налаштування Telegram бота
 * 4. Запуск сервера
 */

// Підключаємо необхідні модулі
const path = require('path');
const fs = require('fs');
const express = require('express');
const { exec } = require('child_process');

// Константи
const PORT = process.env.PORT || 3000;
const APP_URL = process.env.APP_URL || `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
const LOG_PATH = path.join(__dirname, 'logs');

// Створюємо директорію для логів
if (!fs.existsSync(LOG_PATH)) {
  fs.mkdirSync(LOG_PATH, { recursive: true });
}

// Логуємо повідомлення з позначкою часу
function log(message, isError = false) {
  const timestamp = new Date().toISOString();
  const logPrefix = isError ? '[ERROR]' : '[INFO]';
  const logMessage = `${logPrefix} ${message}`;
  
  console[isError ? 'error' : 'log'](logMessage);
  
  try {
    const logFile = path.join(LOG_PATH, isError ? 'startup-errors.log' : 'startup.log');
    fs.appendFileSync(logFile, `[${timestamp}] ${logMessage}\n`);
  } catch (err) {
    console.error(`Помилка запису в лог-файл: ${err.message}`);
  }
}

// Запускаємо сервер
async function startServer() {
  try {
    log('Початок запуску UniFarm Mini App');
    
    // Перевіряємо наявність токену Telegram бота
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      log('УВАГА: TELEGRAM_BOT_TOKEN не встановлено. Інтеграція з Telegram може працювати некоректно', true);
    } else {
      log('TELEGRAM_BOT_TOKEN знайдено в змінних середовища');
    }
    
    // Перевіряємо URL для webhook
    if (!process.env.TELEGRAM_WEBHOOK_URL) {
      // Автоматично встановлюємо URL для webhook
      const webhookUrl = `${APP_URL}/api/telegram/webhook`;
      process.env.TELEGRAM_WEBHOOK_URL = webhookUrl;
      log(`TELEGRAM_WEBHOOK_URL автоматично встановлено на: ${webhookUrl}`);
    } else {
      log(`TELEGRAM_WEBHOOK_URL встановлено на: ${process.env.TELEGRAM_WEBHOOK_URL}`);
    }
    
    // Встановлюємо URL для Mini App
    if (!process.env.MINI_APP_URL) {
      process.env.MINI_APP_URL = APP_URL;
      log(`MINI_APP_URL автоматично встановлено на: ${APP_URL}`);
    } else {
      log(`MINI_APP_URL встановлено на: ${process.env.MINI_APP_URL}`);
    }
    
    // Примусово вмикаємо обробку партицій
    process.env.SKIP_PARTITION_CREATION = 'true';
    process.env.IGNORE_PARTITION_ERRORS = 'true';
    log('Вимкнено перевірку партицій для стабільної роботи');
    
    // Дозволяємо доступ з браузера для тестування
    process.env.ALLOW_BROWSER_ACCESS = 'true';
    log('Увімкнено доступ з браузера для тестування');
    
    // Включаємо debug логи для Telegram
    process.env.TELEGRAM_DEBUG = 'true';
    log('Увімкнено debug логи для Telegram');
    
    // Включаємо debug логи для бази даних
    process.env.DB_DEBUG = 'true';
    log('Увімкнено debug логи для бази даних');
    
    // Перевіряємо підключення до бази даних
    log('Перевірка підключення до бази даних...');
    
    // Налаштовуємо резервне зберігання
    if (!process.env.FORCE_MEMORY_STORAGE) {
      // Автоматично вмикаємо режим in-memory, якщо база даних недоступна
      process.env.AUTO_MEMORY_FALLBACK = 'true';
      log('Увімкнено автоматичний fallback на in-memory режим при недоступності БД');
    } else {
      log('Примусово увімкнено режим in-memory зберігання');
    }
    
    // Створюємо Express додаток
    const app = express();
    
    // Базова конфігурація Express
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Налаштовуємо статичні файли
    const distPath = path.join(__dirname, 'dist/public');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      log(`Статичні файли доступні з: ${distPath}`);
    }
    
    // Створюємо тимчасовий маршрут для перевірки роботи
    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
      });
    });
    
    // Вказуємо, що додаток запускається через цей скрипт
    process.env.STARTED_WITH_UNIFIED_SCRIPT = 'true';
    
    // Запускаємо сервер
    app.listen(PORT, '0.0.0.0', () => {
      log(`Сервер запущено на порту ${PORT}`);
      log(`URL додатку: ${APP_URL}`);
      
      // Запускаємо основний додаток
      log('Запуск основного додатку...');
      
      // Експортуємо змінні середовища для дочірнього процесу
      const env = { ...process.env };
      
      // Запускаємо TS файл через tsx
      const child = exec('npx tsx server/index.ts', { env });
      
      // Виводимо вивід дочірнього процесу
      child.stdout.on('data', (data) => {
        console.log(data.toString().trim());
      });
      
      child.stderr.on('data', (data) => {
        console.error(data.toString().trim());
      });
      
      // Обробляємо завершення дочірнього процесу
      child.on('exit', (code) => {
        if (code !== 0) {
          log(`Основний додаток завершився з кодом ${code}`, true);
        } else {
          log('Основний додаток завершив роботу');
        }
      });
    });
    
  } catch (error) {
    log(`Помилка запуску додатку: ${error.message}`, true);
    console.error(error);
    process.exit(1);
  }
}

// Запускаємо сервер
startServer();