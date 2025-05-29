/**
 * Скрипт для запуска UniFarm через workflow
 * Поддерживает приложение в рабочем состоянии постоянно
 */

const { spawn } = require('child_process');
const fs = require('fs');

// Константы
const KEEP_ALIVE_SCRIPT = 'keep-alive.cjs';
const LOG_FILE = 'workflow.log';

// Логирование
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[Workflow ${timestamp}] ${message}`);
  
  try {
    fs.appendFileSync(LOG_FILE, `[${timestamp}] ${message}\n`);
  } catch (err) {
    console.error('Ошибка записи в лог:', err);
  }
}

// Функция запуска keep-alive скрипта
function startKeepAlive() {
  log('Запуск UniFarm через keep-alive скрипт...');
  
  // Запускаем keep-alive скрипт
  const child = spawn('node', [KEEP_ALIVE_SCRIPT], {
    stdio: 'inherit' // Наследуем stdio для вывода в консоль workflow
  });
  
  // Обработка завершения
  child.on('close', (code) => {
    log(`Keep-alive скрипт завершился с кодом ${code}. Перезапуск через 5 секунд...`);
    
    // Перезапускаем через 5 секунд
    setTimeout(() => {
      startKeepAlive();
    }, 5000);
  });
  
  // Обработка ошибок
  child.on('error', (err) => {
    log(`Ошибка запуска keep-alive скрипта: ${err.message}. Перезапуск через 5 секунд...`);
    
    // Перезапускаем через 5 секунд
    setTimeout(() => {
      startKeepAlive();
    }, 5000);
  });
}

// Вывод информации о запуске
console.log('========================================================================');
console.log('  ЗАПУСК UNIFARM ЧЕРЕЗ WORKFLOW');
console.log('========================================================================');
console.log('Дата запуска:', new Date().toISOString());
console.log('Используется двойная защита от завершения');
console.log('========================================================================');

// Запускаем процесс
log('🚀 Запуск workflow для UniFarm');
startKeepAlive();