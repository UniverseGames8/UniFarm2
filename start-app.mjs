/**
 * Скрипт для запуска UniFarm с Neon DB (ES модуль)
 * 
 * Этот скрипт запускает UniFarm с принудительным использованием Neon DB
 * и отключенным созданием партиций для стабильной работы
 */

import { spawn } from 'child_process';

console.log('==========================================================');
console.log('  ЗАПУСК UNIFARM С NEON DB');
console.log('==========================================================');
console.log('Дата запуска:', new Date().toISOString());
console.log('==========================================================');

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
  IGNORE_PARTITION_ERRORS: 'true'
};

// Выводим настройки
Object.entries(env).forEach(([key, value]) => {
  if (key.includes('DB') || key === 'NODE_ENV' || key === 'PORT') {
    console.log(`${key} = ${value}`);
  }
});

// Запускаем основной скрипт
const startProcess = spawn('node', ['start-unified.js'], { 
  env,
  stdio: 'inherit'
});

startProcess.on('error', (err) => {
  console.error('Ошибка при запуске приложения:', err);
});

startProcess.on('close', (code) => {
  if (code !== 0) {
    console.log(`Процесс завершился с кодом ${code}`);
  }
});