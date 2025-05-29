/**
 * Скрипт постоянного поддержания работы UniFarm
 * Предотвращает самопроизвольное завершение приложения
 */

const { spawn } = require('child_process');
const fs = require('fs');

// Конфигурация
const config = {
  // Максимальное количество перезапусков в час
  maxRestartsPerHour: 20,
  
  // Период ожидания между перезапусками в секундах
  cooldownPeriodSec: 3,
  
  // Файл для записи логов
  logFile: 'keep-alive.log',
  
  // Команда для запуска
  command: 'node',
  args: ['start-unified.js'],
  
  // Дополнительные переменные окружения
  env: {
    NODE_ENV: 'production',
    PORT: '3000',
    DATABASE_PROVIDER: 'neon',
    FORCE_NEON_DB: 'true',
    DISABLE_REPLIT_DB: 'true',
    OVERRIDE_DB_PROVIDER: 'neon',
    SKIP_PARTITION_CREATION: 'true',
    IGNORE_PARTITION_ERRORS: 'true',
    KEEP_PROCESS_ALIVE: 'true' // Специальный флаг для скрипта
  }
};

// Статистика перезапусков
const stats = {
  startTime: new Date(),
  restarts: 0,
  recentRestarts: [],
  consecutiveNormalExits: 0
};

// Логирование в файл и консоль
function log(message) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  
  console.log(`[KeepAlive] ${message}`);
  
  try {
    fs.appendFileSync(config.logFile, logEntry);
  } catch (error) {
    console.error(`Ошибка записи в лог: ${error.message}`);
  }
}

// Проверка лимита перезапусков
function checkRestartLimit() {
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000);
  
  // Очистка старых записей о перезапусках
  stats.recentRestarts = stats.recentRestarts.filter(time => time > oneHourAgo);
  
  // Проверка количества перезапусков за последний час
  return stats.recentRestarts.length < config.maxRestartsPerHour;
}

// Запуск процесса
function startProcess() {
  // Объединяем переменные окружения
  const env = { ...process.env, ...config.env };
  
  log(`Запуск процесса: ${config.command} ${config.args.join(' ')}`);
  
  // Создаем процесс
  const child = spawn(config.command, config.args, {
    env,
    stdio: 'pipe' // Перехватываем вывод для логирования
  });
  
  // ID процесса
  const pid = child.pid;
  log(`Процесс запущен с PID: ${pid}`);
  
  // Обработка вывода
  child.stdout.on('data', (data) => {
    // Перенаправляем вывод в консоль
    process.stdout.write(data);
    
    // Проверяем маркеры успешного запуска
    const output = data.toString();
    if (output.includes('[Server] Starting on port') || 
        output.includes('serving on port')) {
      log(`✅ Сервер успешно запущен на порту 3000`);
    }
  });
  
  // Обработка ошибок
  child.stderr.on('data', (data) => {
    // Перенаправляем ошибки в консоль
    process.stderr.write(data);
  });
  
  // Обработка завершения процесса
  child.on('close', (code) => {
    stats.restarts++;
    stats.recentRestarts.push(Date.now());
    
    if (code === 0) {
      stats.consecutiveNormalExits++;
      log(`Процесс завершился с кодом 0 (нормальное завершение). Это ${stats.consecutiveNormalExits}-й раз подряд.`);
      
      // Если процесс постоянно завершается штатно, возможно, есть проблема с логикой завершения
      if (stats.consecutiveNormalExits >= 3) {
        log(`⚠️ Обнаружено ${stats.consecutiveNormalExits} подряд штатных завершений. Возможно, в коде есть проблема.`);
      }
    } else {
      stats.consecutiveNormalExits = 0;
      log(`⚠️ Процесс завершился с кодом ${code}. Требуется перезапуск.`);
    }
    
    // Проверяем, не превышен ли лимит перезапусков
    if (checkRestartLimit()) {
      log(`Ожидаем ${config.cooldownPeriodSec} секунд перед перезапуском...`);
      
      // Перезапускаем процесс после небольшой задержки
      setTimeout(() => {
        log(`🔄 Перезапуск процесса (${stats.restarts} с момента запуска)...`);
        startProcess();
      }, config.cooldownPeriodSec * 1000);
    } else {
      log(`⛔ Превышен лимит перезапусков (${config.maxRestartsPerHour} за час). Ждем час.`);
      
      // Ждем час и пробуем снова
      setTimeout(() => {
        log(`Прошел час после превышения лимита. Пробуем снова.`);
        stats.recentRestarts = []; // Очищаем счетчик
        startProcess();
      }, 60 * 60 * 1000);
    }
  });
  
  // Обработка ошибок при создании процесса
  child.on('error', (error) => {
    log(`❌ Ошибка при запуске процесса: ${error.message}`);
    
    // Перезапускаем через короткий интервал
    setTimeout(() => {
      log(`🔄 Повторная попытка запуска после ошибки...`);
      startProcess();
    }, 5000);
  });
  
  return child;
}

// Обработка сигналов завершения для keep-alive скрипта
process.on('SIGINT', () => {
  log('Получен сигнал SIGINT. Завершаем работу...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('Получен сигнал SIGTERM. Завершаем работу...');
  process.exit(0);
});

// Обрабатываем необработанные исключения
process.on('uncaughtException', (error) => {
  log(`❌ Необработанное исключение: ${error.message}`);
  log(error.stack);
  log('Продолжаем работу keep-alive скрипта...');
});

// Выводим информацию о запуске
console.log('========================================================================');
console.log('  ЗАПУСК UNIFARM С ЗАЩИТОЙ ОТ ЗАВЕРШЕНИЯ');
console.log('========================================================================');
console.log('Дата запуска:', new Date().toISOString());
console.log('Защита от неожиданного завершения активирована');
console.log('Максимум перезапусков в час:', config.maxRestartsPerHour);
console.log('Задержка между перезапусками:', config.cooldownPeriodSec, 'сек');
console.log('========================================================================');

// Запускаем процесс
log('🚀 Запуск UniFarm с защитой от завершения');
startProcess();