/**
 * Специальный скрипт для автоматического запуска через Replit
 * 
 * Этот файл запускается через кнопку Run в интерфейсе Replit
 */

'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Информация о запуске
console.log('🚀 UniFarm - Запуск через кнопку Run');
console.log('⏱️ Время запуска:', new Date().toISOString());

// Создаем директорию для логов
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Файл для логов
const logFile = path.join(logsDir, `replit-run-${Date.now()}.log`);
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

// Функция для удобного логирования
function log(message) {
  const timestamp = new Date().toISOString();
  const formattedMsg = `[${timestamp}] ${message}`;
  console.log(formattedMsg);
  logStream.write(formattedMsg + '\n');
}

log('Инициализация запуска сервера UniFarm...');

// Запускаем наш основной скрипт сервера
const serverProcess = spawn('node', ['start.cjs'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    REPLIT_RUN: 'true' // Маркер запуска через Replit
  }
});

// Обрабатываем события сервера
serverProcess.on('close', (code) => {
  log(`⚠️ Процесс сервера завершился с кодом ${code}`);
  log('🔄 Автоматический перезапуск через 3 секунды...');
  
  // Перезапуск с небольшой задержкой
  setTimeout(() => {
    log('🔄 Перезапуск процесса сервера...');
    
    const newProcess = spawn('node', ['start.cjs'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        REPLIT_RUN: 'true',
        RESTART_COUNT: process.env.RESTART_COUNT ? 
          (parseInt(process.env.RESTART_COUNT) + 1).toString() : '1'
      }
    });
    
    // Сохраняем новый процесс
    serverProcess = newProcess;
    
    // Обработка событий нового процесса
    setupProcessHandlers(newProcess);
  }, 3000);
});

// Настройка обработчиков для процесса
function setupProcessHandlers(proc) {
  proc.on('error', (err) => {
    log(`❌ Ошибка процесса сервера: ${err.message}`);
  });
}

// Обрабатываем сигналы
process.on('SIGINT', () => {
  log('⚠️ Получен сигнал SIGINT, игнорируем');
});

process.on('SIGTERM', () => {
  log('⚠️ Получен сигнал SIGTERM, игнорируем');
});

// Обрабатываем необработанные исключения
process.on('uncaughtException', (err) => {
  log(`❌ Необработанное исключение: ${err.message}`);
  log('✅ Продолжаем работу процесса запуска');
});

// Держим процесс активным
setInterval(() => {}, 1000);

log('✅ Скрипт запуска инициализирован успешно!');