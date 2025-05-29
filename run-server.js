/**
 * Надежный скрипт запуска UniFarm с автоматическим перезапуском
 * 
 * Разработан специально для запуска в Replit workflow
 * с поддержкой автоматического перезапуска при сбоях
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Конфигурация
const config = {
  // Максимальное количество перезапусков в час
  maxRestartsPerHour: 10,
  
  // Период охлаждения между перезапусками в секундах
  cooldownPeriodSec: 10,
  
  // Файл для записи логов
  logFile: './restart-log.txt',
  
  // Команда для запуска сервера
  startCommand: 'node',
  startArgs: ['dist/index.js'],
  
  // Переменные окружения
  env: {
    NODE_ENV: 'production',
    PORT: '3000',
    DATABASE_PROVIDER: 'neon',
    FORCE_NEON_DB: 'true',
    DISABLE_REPLIT_DB: 'true',
    OVERRIDE_DB_PROVIDER: 'neon',
    SKIP_PARTITION_CREATION: 'true',
    IGNORE_PARTITION_ERRORS: 'true'
  }
};

// Статистика перезапусков
const restartStats = {
  restarts: [],
  lastRestartTime: null,
  isInCooldown: false
};

// Запись в лог
function logMessage(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  console.log(message);
  
  try {
    fs.appendFileSync(config.logFile, logMessage);
  } catch (err) {
    console.error('Ошибка записи в лог:', err);
  }
}

// Проверка количества перезапусков
function checkRestartLimit() {
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000);
  
  // Удаляем старые перезапуски из статистики
  restartStats.restarts = restartStats.restarts.filter(time => time > oneHourAgo);
  
  // Проверяем количество перезапусков за последний час
  return restartStats.restarts.length < config.maxRestartsPerHour;
}

// Запуск сервера
function startServer() {
  logMessage('Запуск сервера...');
  
  // Объединяем переменные окружения
  const env = { ...process.env, ...config.env };
  
  // Вывод переменных для отладки
  logMessage('Запуск с переменными окружения:');
  Object.entries(config.env).forEach(([key, value]) => {
    logMessage(`${key} = ${value}`);
  });
  
  // Запускаем сервер
  const serverProcess = spawn(config.startCommand, config.startArgs, {
    env,
    stdio: 'pipe' // Перехватываем вывод для логирования
  });
  
  // Логируем PID
  logMessage(`Сервер запущен с PID: ${serverProcess.pid}`);
  
  // Обработка стандартного вывода
  serverProcess.stdout.on('data', (data) => {
    process.stdout.write(data);
  });
  
  // Обработка ошибок
  serverProcess.stderr.on('data', (data) => {
    process.stderr.write(data);
  });
  
  // Обработка завершения процесса
  serverProcess.on('close', (code) => {
    const exitTime = new Date().toISOString();
    
    if (code === 0) {
      logMessage(`[${exitTime}] Сервер завершил работу штатно с кодом 0`);
      logMessage('Запускаем сервер заново...');
      startServer(); // Даже при штатном завершении перезапускаем
    } else {
      logMessage(`[${exitTime}] Сервер завершил работу с кодом ${code}, требуется перезапуск`);
      
      // Проверяем возможность перезапуска
      if (checkRestartLimit()) {
        if (!restartStats.isInCooldown) {
          restartStats.isInCooldown = true;
          restartStats.lastRestartTime = Date.now();
          restartStats.restarts.push(Date.now());
          
          logMessage(`Ожидание ${config.cooldownPeriodSec} секунд перед перезапуском...`);
          
          // Ожидаем перед перезапуском
          setTimeout(() => {
            restartStats.isInCooldown = false;
            logMessage('🔄 Перезапуск сервера...');
            startServer();
          }, config.cooldownPeriodSec * 1000);
        }
      } else {
        logMessage(`⛔ Превышен лимит перезапусков (${config.maxRestartsPerHour} в час). Ждем час перед следующей попыткой.`);
        
        // Планируем перезапуск через час
        setTimeout(() => {
          logMessage('Прошел час после превышения лимита перезапусков. Пробуем снова.');
          restartStats.restarts = []; // Очищаем статистику
          startServer();
        }, 60 * 60 * 1000 + 1000); // Чуть больше часа
      }
    }
  });
  
  // Обработка ошибок процесса
  serverProcess.on('error', (err) => {
    logMessage(`⚠️ Ошибка процесса: ${err.message}`);
    
    // Перезапускаем при ошибке процесса
    if (checkRestartLimit()) {
      setTimeout(() => {
        logMessage('🔄 Перезапуск сервера после ошибки процесса...');
        startServer();
      }, config.cooldownPeriodSec * 1000);
    }
  });
  
  return serverProcess;
}

// Устанавливаем обработчики сигналов
process.on('SIGINT', () => {
  logMessage('Получен сигнал SIGINT. Завершение работы...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logMessage('Получен сигнал SIGTERM. Завершение работы...');
  process.exit(0);
});

// Предотвращаем падение при необработанных исключениях
process.on('uncaughtException', (err) => {
  logMessage(`Необработанное исключение: ${err.message}`);
  logMessage('Продолжаем работу...');
});

// Начинаем запуск
console.log('========================================================================');
console.log('  ЗАПУСК UNIFARM С АВТОМАТИЧЕСКИМ ПЕРЕЗАПУСКОМ');
console.log('========================================================================');
console.log('Дата запуска:', new Date().toISOString());
console.log('Максимальное количество перезапусков в час:', config.maxRestartsPerHour);
console.log('Период охлаждения между перезапусками:', config.cooldownPeriodSec, 'сек');
console.log('========================================================================');

// Записываем информацию о запуске в лог
logMessage('🚀 Запуск сервера UniFarm с автоматическим перезапуском');

// Запускаем сервер
startServer();