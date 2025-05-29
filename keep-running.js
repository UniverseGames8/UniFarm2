/**
 * Модифицированный скрипт запуска UniFarm
 * Предотвращает завершение процесса сервера
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import { createRequire } from 'module';

// Создаем require функцию, которая может использоваться внутри ES модуля
const require = createRequire(import.meta.url);

// Set environment variables to ENSURE Neon DB usage with highest priority
process.env.DATABASE_PROVIDER = 'neon';
process.env.FORCE_NEON_DB = 'true';
process.env.DISABLE_REPLIT_DB = 'true';
process.env.OVERRIDE_DB_PROVIDER = 'neon'; 
process.env.NODE_ENV = 'production';
process.env.SKIP_PARTITION_CREATION = 'true';
process.env.IGNORE_PARTITION_ERRORS = 'true';
process.env.SKIP_TELEGRAM_CHECK = 'true';
process.env.ALLOW_BROWSER_ACCESS = 'true';

// Log early DB configuration to verify settings
console.log('===============================================');
console.log('UNIFARM STARTUP - FORCED NEON DB CONFIGURATION');
console.log('===============================================');
console.log('DATABASE_PROVIDER =', process.env.DATABASE_PROVIDER);
console.log('FORCE_NEON_DB =', process.env.FORCE_NEON_DB);
console.log('DISABLE_REPLIT_DB =', process.env.DISABLE_REPLIT_DB);
console.log('OVERRIDE_DB_PROVIDER =', process.env.OVERRIDE_DB_PROVIDER);
console.log('NODE_ENV =', process.env.NODE_ENV);
console.log('PORT =', process.env.PORT);
console.log('SKIP_PARTITION_CREATION =', process.env.SKIP_PARTITION_CREATION);
console.log('IGNORE_PARTITION_ERRORS =', process.env.IGNORE_PARTITION_ERRORS);
console.log('===============================================');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Статистика перезапусков
const restartStats = {
  totalRestarts: 0,
  lastRestart: null,
  restartsLastHour: []
};

/**
 * Проверяет количество перезапусков за последний час
 * @returns {boolean} Можно ли выполнить перезапуск
 */
function canRestart() {
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000);
  
  // Очищаем старые записи
  restartStats.restartsLastHour = restartStats.restartsLastHour.filter(
    time => time > oneHourAgo
  );
  
  // Проверяем лимит
  return restartStats.restartsLastHour.length < 20; // максимум 20 рестартов в час
}

/**
 * Запускает процесс сервера и перезапускает его при необходимости
 */
function startServerWithAutoRestart() {
  console.log('===================================================');
  console.log('  ЗАПУСК UNIFARM C АВТОМАТИЧЕСКИМ ПЕРЕЗАПУСКОМ');
  console.log('===================================================');
  console.log('Время запуска:', new Date().toISOString());
  console.log('Перезапусков с момента старта:', restartStats.totalRestarts);
  console.log('===================================================');
  
  // Определяем порт
  const port = parseInt(process.env.PORT || '3000', 10);
  console.log(`Используем порт ${port} для приложения...`);
  
  // Убедимся, что приложение собрано
  if (!fs.existsSync('./dist/index.js')) {
    console.error('Ошибка: Не найден собранный файл ./dist/index.js');
    process.exit(1);
  }
  
  console.log('Запускаем приложение...');
  
  // Подготавливаем переменные окружения
  const env = {
    ...process.env,
    DATABASE_PROVIDER: 'neon',
    FORCE_NEON_DB: 'true',
    DISABLE_REPLIT_DB: 'true',
    OVERRIDE_DB_PROVIDER: 'neon',
    NODE_ENV: 'production',
    PORT: port.toString(),
    SKIP_PARTITION_CREATION: 'true',
    IGNORE_PARTITION_ERRORS: 'true',
    SKIP_TELEGRAM_CHECK: 'true',
    ALLOW_BROWSER_ACCESS: 'true',
    KEEP_ALIVE: 'true'
  };
  
  // Запускаем сервер с наследованием ввода-вывода
  const serverProcess = spawn('node', ['dist/index.js'], {
    env,
    stdio: 'inherit'
  });
  
  // Обрабатываем завершение процесса
  serverProcess.on('close', (code) => {
    const now = Date.now();
    
    restartStats.totalRestarts++;
    restartStats.lastRestart = now;
    restartStats.restartsLastHour.push(now);
    
    console.log(`Сервер завершил работу с кодом ${code} в ${new Date().toISOString()}`);
    
    // Проверяем возможность перезапуска
    if (canRestart()) {
      console.log('Ожидаем 5 секунд перед перезапуском...');
      
      // Ждем 5 секунд и перезапускаем
      setTimeout(() => {
        console.log('Перезапуск сервера...');
        startServerWithAutoRestart();
      }, 5000);
    } else {
      console.log('Превышен лимит перезапусков (20 в час). Ожидаем 10 минут...');
      
      // Ждем 10 минут и пробуем снова
      setTimeout(() => {
        console.log('Возобновляем работу после паузы...');
        restartStats.restartsLastHour = []; // Очищаем счетчик
        startServerWithAutoRestart();
      }, 10 * 60 * 1000);
    }
  });
  
  // Обрабатываем ошибки запуска
  serverProcess.on('error', (err) => {
    console.error('Ошибка запуска сервера:', err);
    
    if (canRestart()) {
      console.log('Пробуем перезапустить через 5 секунд...');
      setTimeout(startServerWithAutoRestart, 5000);
    }
  });
}

// Обрабатываем необработанные исключения для стабильности скрипта
process.on('uncaughtException', (err) => {
  console.error('Необработанное исключение в скрипте запуска:', err);
  console.log('Продолжаем работу...');
});

// Обрабатываем необработанные отклонения промисов
process.on('unhandledRejection', (reason, promise) => {
  console.error('Необработанное отклонение промиса в скрипте запуска:', reason);
  console.log('Продолжаем работу...');
});

// Запускаем сервер
startServerWithAutoRestart();