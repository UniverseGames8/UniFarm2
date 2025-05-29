/**
 * Универсальный скрипт запуска UniFarm
 * 
 * Объединяет функциональность:
 * 1. Запуск сервера с автоматическим перезапуском
 * 2. Мониторинг состояния приложения
 * 3. Обработка сигналов завершения
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

// Конфигурация
const config = {
  // Основные настройки
  port: process.env.PORT || 3000,
  mode: process.env.NODE_ENV || 'production',
  dbProvider: process.env.DATABASE_PROVIDER || 'neon',
  
  // Настройки автоперезапуска
  maxRestarts: 10,
  cooldownPeriodSec: 10,
  
  // Мониторинг
  enableMonitoring: true,
  monitorCheckInterval: 60, // секунды
  
  // Логирование
  logDir: './logs',
  mainLogFile: 'unifarm.log',
  errorLogFile: 'error.log',
  monitorLogFile: 'monitor.log'
};

// Статистика для отслеживания
const stats = {
  startTime: new Date(),
  restarts: 0,
  lastRestartTime: null,
  errors: 0
};

// Процессы
let serverProcess = null;
let monitorProcess = null;

// Подготовка директории для логов
async function prepareLogDirectory() {
  try {
    await fs.mkdir(config.logDir, { recursive: true });
    console.log(`Директория для логов создана: ${config.logDir}`);
  } catch (err) {
    console.error(`Ошибка при создании директории для логов: ${err.message}`);
  }
}

// Запись в лог
async function logMessage(message, isError = false) {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] ${message}\n`;
  
  console.log(message);
  
  const logFile = path.join(config.logDir, isError ? config.errorLogFile : config.mainLogFile);
  
  try {
    await fs.appendFile(logFile, formattedMessage);
  } catch (err) {
    console.error(`Ошибка записи в лог ${logFile}: ${err.message}`);
  }
}

// Запуск сервера
async function startServer() {
  // Настраиваем переменные окружения
  const env = {
    ...process.env,
    NODE_ENV: config.mode,
    PORT: config.port.toString(),
    DATABASE_PROVIDER: config.dbProvider,
    FORCE_NEON_DB: 'true',
    DISABLE_REPLIT_DB: 'true',
    OVERRIDE_DB_PROVIDER: 'neon',
    SKIP_PARTITION_CREATION: 'true',
    IGNORE_PARTITION_ERRORS: 'true',
    AUTO_RESTART_ENABLED: 'true'
  };
  
  // Запускаем скрипт автоматического перезапуска
  serverProcess = spawn('node', ['auto-restart.mjs'], { 
    env,
    stdio: 'pipe' // Для перехвата вывода
  });
  
  // Обработка вывода
  serverProcess.stdout.on('data', (data) => {
    const output = data.toString().trim();
    if (output) {
      // Фильтруем повторяющиеся сообщения для уменьшения шума в логах
      if (!output.includes('heartbeat') && !output.includes('ping')) {
        logMessage(`[SERVER] ${output}`);
      }
    }
  });
  
  // Обработка ошибок
  serverProcess.stderr.on('data', (data) => {
    const errorOutput = data.toString().trim();
    if (errorOutput) {
      logMessage(`[SERVER ERROR] ${errorOutput}`, true);
      stats.errors++;
    }
  });
  
  // Обработка завершения
  serverProcess.on('close', async (code) => {
    const exitTime = new Date().toISOString();
    
    if (code === 0) {
      await logMessage(`[${exitTime}] Сервер завершил работу штатно с кодом 0`);
    } else {
      await logMessage(`[${exitTime}] Сервер завершил работу с кодом ${code}, запускаем заново...`, true);
      
      // Перезапускаем при неожиданном завершении, но с ограничением
      stats.restarts++;
      stats.lastRestartTime = new Date();
      
      if (stats.restarts <= config.maxRestarts) {
        await logMessage(`Перезапуск сервера (${stats.restarts}/${config.maxRestarts})...`);
        
        // Ожидаем перед перезапуском
        setTimeout(() => {
          startServer();
        }, config.cooldownPeriodSec * 1000);
      } else {
        await logMessage(`Превышено максимальное количество перезапусков (${config.maxRestarts}). Дальнейшие попытки остановлены.`, true);
      }
    }
  });
  
  await logMessage(`Сервер UniFarm запущен на порту ${config.port}, режим: ${config.mode}`);
  return serverProcess;
}

// Запуск мониторинга
async function startMonitoring() {
  if (!config.enableMonitoring) {
    await logMessage('Мониторинг отключен');
    return null;
  }
  
  // Устанавливаем переменные для монитора
  const env = {
    ...process.env,
    MONITOR_CHECK_INTERVAL: config.monitorCheckInterval.toString(),
    MONITOR_LOG_FILE: path.join(config.logDir, config.monitorLogFile)
  };
  
  // Запускаем монитор
  monitorProcess = spawn('node', ['monitor.js'], {
    env,
    stdio: 'pipe'
  });
  
  // Обработка вывода монитора
  monitorProcess.stdout.on('data', (data) => {
    const output = data.toString().trim();
    if (output) {
      logMessage(`[MONITOR] ${output}`);
    }
  });
  
  // Обработка ошибок монитора
  monitorProcess.stderr.on('data', (data) => {
    const errorOutput = data.toString().trim();
    if (errorOutput) {
      logMessage(`[MONITOR ERROR] ${errorOutput}`, true);
    }
  });
  
  // Обработка завершения монитора
  monitorProcess.on('close', async (code) => {
    await logMessage(`Монитор завершил работу с кодом ${code}`, code !== 0);
    
    // Автоматически перезапускаем монитор при сбое
    if (code !== 0 && config.enableMonitoring) {
      setTimeout(() => {
        startMonitoring();
      }, 5000);
    }
  });
  
  await logMessage('Мониторинг запущен');
  return monitorProcess;
}

// Обработка сигналов завершения
function setupSignalHandlers() {
  // Корректное завершение при получении сигнала
  process.on('SIGINT', async () => {
    await logMessage('Получен сигнал SIGINT, завершаем работу...');
    await shutdownGracefully();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    await logMessage('Получен сигнал SIGTERM, завершаем работу...');
    await shutdownGracefully();
    process.exit(0);
  });
  
  // Обработка необработанных исключений
  process.on('uncaughtException', async (err) => {
    await logMessage(`Необработанное исключение: ${err.message}\n${err.stack}`, true);
    await shutdownGracefully();
    process.exit(1);
  });
}

// Корректное завершение работы
async function shutdownGracefully() {
  await logMessage('Начинаем корректное завершение работы...');
  
  // Завершаем процесс мониторинга
  if (monitorProcess && !monitorProcess.killed) {
    monitorProcess.kill();
    await logMessage('Процесс мониторинга завершен');
  }
  
  // Завершаем серверный процесс
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
    await logMessage('Процесс сервера завершен');
  }
  
  await logMessage('Корректное завершение выполнено');
}

// Основная функция запуска
async function main() {
  try {
    console.log('========================================================================');
    console.log('  ЗАПУСК UNIFARM С АВТОМАТИЧЕСКИМ ПЕРЕЗАПУСКОМ И МОНИТОРИНГОМ');
    console.log('========================================================================');
    console.log('Дата запуска:', new Date().toISOString());
    console.log('Режим:', config.mode);
    console.log('Порт:', config.port);
    console.log('БД:', config.dbProvider);
    console.log('========================================================================');
    
    // Готовим директорию для логов
    await prepareLogDirectory();
    
    // Настраиваем обработчики сигналов
    setupSignalHandlers();
    
    // Запускаем сервер
    await startServer();
    
    // Запускаем мониторинг
    if (config.enableMonitoring) {
      await startMonitoring();
    }
    
    // Выводим информацию о запуске
    const uptime = () => {
      const now = new Date();
      const diff = (now - stats.startTime) / 1000;
      return `${Math.floor(diff / 3600)}ч ${Math.floor((diff % 3600) / 60)}м ${Math.floor(diff % 60)}с`;
    };
    
    // Периодически выводим статистику
    setInterval(async () => {
      await logMessage(`UniFarm работает ${uptime()}, перезапусков: ${stats.restarts}, ошибок: ${stats.errors}`);
    }, 30 * 60 * 1000); // каждые 30 минут
    
  } catch (err) {
    console.error('Критическая ошибка при запуске:', err);
    process.exit(1);
  }
}

// Запускаем
main().catch(err => {
  console.error('Критическая ошибка в main():', err);
  process.exit(1);
});