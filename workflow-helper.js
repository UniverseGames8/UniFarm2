/**
 * Скрипт-помощник для запуска UniFarm с автоматическим перезапуском
 * 
 * Использует существующий workflow для запуска приложения,
 * добавляя функциональность автоматического перезапуска
 */

// Импортируем необходимые модули
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

// Конфигурация перезапуска
const config = {
  maxRestartsPerHour: 10,
  cooldownPeriodSec: 10,
  logFile: 'restart-log.txt',
  statusCheckIntervalSec: 30
};

// Статистика перезапусков
const restartStats = {
  restarts: [],
  lastRestartTime: null,
  isInCooldown: false
};

// История состояний
const statusHistory = [];

console.log('========================================================================');
console.log('  ЗАПУСК UNIFARM С АВТОМАТИЧЕСКИМ ПЕРЕЗАПУСКОМ');
console.log('========================================================================');
console.log('Дата запуска:', new Date().toISOString());
console.log('Максимальное количество перезапусков в час:', config.maxRestartsPerHour);
console.log('Период охлаждения между перезапусками:', config.cooldownPeriodSec, 'сек');
console.log('Интервал проверки состояния:', config.statusCheckIntervalSec, 'сек');
console.log('========================================================================');

// Функция записи в лог
async function logEvent(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  console.log(message);
  
  try {
    await fs.appendFile(config.logFile, logMessage);
  } catch (err) {
    console.error('Ошибка записи в лог:', err);
  }
}

// Функция проверки количества перезапусков
function checkRestartLimit() {
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000);
  
  // Удаляем старые перезапуски из статистики
  restartStats.restarts = restartStats.restarts.filter(time => time > oneHourAgo);
  
  // Проверяем количество перезапусков за последний час
  return restartStats.restarts.length < config.maxRestartsPerHour;
}

// Функция для записи статуса в журнал состояний
function recordStatus(status) {
  statusHistory.push({
    timestamp: Date.now(),
    status
  });
  
  // Ограничиваем размер истории
  if (statusHistory.length > 100) {
    statusHistory.shift();
  }
}

// Функция запуска приложения
function startApp() {
  // Настраиваем переменные окружения
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: '3000', 
    DATABASE_PROVIDER: 'neon',
    FORCE_NEON_DB: 'true',
    DISABLE_REPLIT_DB: 'true',
    OVERRIDE_DB_PROVIDER: 'neon',
    SKIP_PARTITION_CREATION: 'true',
    IGNORE_PARTITION_ERRORS: 'true',
    // Добавляем специальную переменную для отслеживания перезапусков
    AUTO_RESTART_ENABLED: 'true'
  };
  
  // Запускаем основной скрипт приложения
  const appProcess = spawn('node', ['start-unified.js'], { 
    env,
    stdio: 'pipe' // Используем pipe для мониторинга вывода
  });
  
  // Обработка стандартного вывода
  appProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(output);
    
    // Отслеживаем маркеры успешного запуска
    if (output.includes('[Server] Сервер запущен') || 
        output.includes('serving on port')) {
      recordStatus('running');
      logEvent('✅ Сервер успешно запущен');
    }
    
    // Отслеживаем проблемы с базой данных
    if (output.includes('ошибка базы данных') || 
        output.includes('database error')) {
      recordStatus('db_error');
    }
  });
  
  // Обработка ошибок
  appProcess.stderr.on('data', (data) => {
    const errorOutput = data.toString();
    console.error(errorOutput);
    
    // Отслеживаем критические ошибки
    if (errorOutput.includes('Error:') || 
        errorOutput.includes('Uncaught Exception')) {
      recordStatus('error');
    }
  });
  
  // Обработка завершения процесса
  appProcess.on('close', async (code) => {
    recordStatus('closed');
    
    const exitTime = new Date().toISOString();
    
    if (code === 0) {
      await logEvent(`[${exitTime}] Сервер завершил работу штатно с кодом 0`);
    } else {
      await logEvent(`[${exitTime}] ⚠️ Сервер завершил работу с кодом ${code}, требуется перезапуск`);
      
      // Проверяем возможность перезапуска
      if (checkRestartLimit()) {
        if (!restartStats.isInCooldown) {
          restartStats.isInCooldown = true;
          restartStats.lastRestartTime = Date.now();
          restartStats.restarts.push(Date.now());
          
          await logEvent(`Ожидание ${config.cooldownPeriodSec} секунд перед перезапуском...`);
          
          // Ожидаем перед перезапуском
          setTimeout(() => {
            restartStats.isInCooldown = false;
            logEvent('🔄 Перезапуск сервера...');
            startApp();
          }, config.cooldownPeriodSec * 1000);
        }
      } else {
        await logEvent(`⛔ Превышен лимит перезапусков (${config.maxRestartsPerHour} в час). Автоматический перезапуск отключен.`);
        await logEvent(`Для ручного перезапуска выполните команду: node workflow-helper.js`);
      }
    }
  });
  
  // Обработка ошибок процесса
  appProcess.on('error', async (err) => {
    recordStatus('process_error');
    await logEvent(`⚠️ Ошибка процесса: ${err.message}`);
  });
  
  return appProcess;
}

// Начальный запуск
(async function main() {
  await logEvent('🚀 Запуск сервера UniFarm с автоматическим перезапуском');
  startApp();

  // Периодическая проверка состояния
  setInterval(() => {
    // Анализируем последние статусы для выявления проблем
    const recentStatuses = statusHistory.slice(-5);
    
    // Простая диагностика на основе истории статусов
    if (recentStatuses.length > 0) {
      const lastStatus = recentStatuses[recentStatuses.length - 1];
      
      // Если последний статус был ошибкой и прошло больше 5 минут
      if (lastStatus.status === 'error' && 
          (Date.now() - lastStatus.timestamp) > 5 * 60 * 1000) {
        logEvent('🔍 Обнаружены признаки зависания. Проверка состояния сервера...');
      }
    }
  }, config.statusCheckIntervalSec * 1000);
})();