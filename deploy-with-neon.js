/**
 * Скрипт для деплоя UniFarm с принудительным использованием Neon DB
 * 
 * Заменяет .replit файл на .replit.neon
 * и запускает деплой с настройками Neon DB
 */

import fs from 'fs';
import { spawn } from 'child_process';
import { createRequire } from 'module';

// Создаем require функцию для использования в ES модулях
const require = createRequire(import.meta.url);

// ПРИНУДИТЕЛЬНО устанавливаем переменные окружения для Neon DB
process.env.DATABASE_PROVIDER = 'neon';
process.env.FORCE_NEON_DB = 'true';
process.env.DISABLE_REPLIT_DB = 'true';
process.env.OVERRIDE_DB_PROVIDER = 'neon'; 
process.env.NODE_ENV = 'production';
process.env.SKIP_PARTITION_CREATION = 'true';
process.env.IGNORE_PARTITION_ERRORS = 'true';
process.env.PGSSLMODE = 'prefer';
process.env.PGSOCKET = '';
process.env.PGCONNECT_TIMEOUT = '10';

console.log('==================================================');
console.log('НАЧАЛО ПРОЦЕССА ДЕПЛОЯ UNIFARM С NEON DB');
console.log('==================================================');

// Сохраняем оригинальный .replit файл
if (fs.existsSync('.replit')) {
  console.log('Сохранение оригинального .replit файла как .replit.backup...');
  try {
    if (fs.existsSync('.replit.backup')) {
      fs.unlinkSync('.replit.backup');
    }
    fs.copyFileSync('.replit', '.replit.backup');
    console.log('Резервная копия создана успешно.');
  } catch (error) {
    console.error('Ошибка при создании резервной копии:', error);
    process.exit(1);
  }
}

// Копируем .replit.neon в .replit
console.log('Настройка конфигурации для Neon DB...');
try {
  if (!fs.existsSync('.replit.neon')) {
    console.error('ОШИБКА: Файл .replit.neon не найден!');
    process.exit(1);
  }
  
  fs.copyFileSync('.replit.neon', '.replit');
  console.log('Конфигурация для Neon DB успешно применена.');
} catch (error) {
  console.error('Ошибка при настройке конфигурации Neon DB:', error);
  process.exit(1);
}

// Проверяем наличие стартового файла
if (!fs.existsSync('start-deployment.js')) {
  console.error('ОШИБКА: Файл start-deployment.js не найден!');
  process.exit(1);
}

console.log('Вызов деплоя с настройками Neon DB...');
console.log('==================================================');

// Запускаем деплой
const deployProcess = spawn('replit', ['deploy'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    DATABASE_PROVIDER: 'neon',
    FORCE_NEON_DB: 'true',
    DISABLE_REPLIT_DB: 'true',
    OVERRIDE_DB_PROVIDER: 'neon',
    NODE_ENV: 'production',
  }
});

deployProcess.on('close', (code) => {
  if (code === 0) {
    console.log('==================================================');
    console.log('ДЕПЛОЙ УСПЕШНО ЗАВЕРШЕН С NEON DB');
    console.log('==================================================');
  } else {
    console.error('Процесс деплоя завершился с ошибкой, код:', code);
  }
  
  // Восстанавливаем оригинальную конфигурацию
  if (fs.existsSync('.replit.backup')) {
    console.log('Восстановление оригинальной конфигурации...');
    fs.copyFileSync('.replit.backup', '.replit');
    console.log('Оригинальная конфигурация восстановлена.');
  }
});