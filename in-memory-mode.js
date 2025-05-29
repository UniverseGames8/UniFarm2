/**
 * Скрипт для запуску UniFarm с принудительным использованием in-memory хранилища
 * 
 * Этот скрипт запускает приложение с настройками, которые игнорируют ошибки 
 * подключения к базе данных и используют только in-memory хранилище.
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createRequire } from 'module';
import fs from 'fs';

// Создаем require функцию
const require = createRequire(import.meta.url);

// Путь к текущему файлу
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Настройка переменных окружения для работы с in-memory хранилищем
process.env.FORCE_MEMORY_STORAGE = 'true';
process.env.ALLOW_MEMORY_FALLBACK = 'true';
process.env.USE_MEMORY_SESSION = 'true';
process.env.IGNORE_DB_CONNECTION_ERRORS = 'true';
process.env.DATABASE_PROVIDER = 'memory';
process.env.SKIP_PARTITION_CREATION = 'true';
process.env.IGNORE_PARTITION_ERRORS = 'true';
process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || '3000';
process.env.SKIP_TELEGRAM_CHECK = 'true';
process.env.ALLOW_BROWSER_ACCESS = 'true';

console.log('=================================================');
console.log('  ЗАПУСК UNIFARM В РЕЖИМЕ IN-MEMORY ХРАНИЛИЩА');
console.log('=================================================');
console.log('Время запуска:', new Date().toISOString());
console.log('DATABASE_PROVIDER =', process.env.DATABASE_PROVIDER);
console.log('FORCE_MEMORY_STORAGE =', process.env.FORCE_MEMORY_STORAGE);
console.log('=================================================');

// Функция для запуска процесса
async function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`Запуск команды: ${command} ${args.join(' ')}`);
    
    const childProcess = spawn(command, args, {
      stdio: 'inherit',
      ...options
    });

    childProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Процесс завершился с кодом: ${code}`));
      }
    });
    
    childProcess.on('error', (error) => {
      reject(error);
    });
  });
}

// Функция для определения файла запуска
async function findStartFile() {
  const possibleFiles = [
    { path: './dist/index.js', command: 'node dist/index.js' },
    { path: './server/index.js', command: 'node server/index.js' },
    { path: './server/index.ts', command: 'npx tsx server/index.ts' },
    { path: './index.js', command: 'node index.js' }
  ];
  
  for (const file of possibleFiles) {
    if (fs.existsSync(file.path)) {
      console.log(`Найден файл запуска: ${file.path}`);
      return file;
    }
  }
  
  throw new Error('Не найден файл для запуска приложения');
}

// Основная функция
async function main() {
  try {
    // Проверяем, собран ли проект
    if (!fs.existsSync('./dist/index.js')) {
      console.log('Собираем проект...');
      try {
        await runProcess('npm', ['run', 'build']);
        console.log('Сборка завершена успешно!');
      } catch (error) {
        console.error('Ошибка сборки:', error);
        console.log('Продолжаем с текущими файлами...');
      }
    }
    
    // Находим и запускаем файл
    const startFile = await findStartFile();
    const [command, ...args] = startFile.command.split(' ');
    
    // Запускаем приложение
    await runProcess(command, args, {
      env: {
        ...process.env,
        FORCE_MEMORY_STORAGE: 'true',
        ALLOW_MEMORY_FALLBACK: 'true',
        USE_MEMORY_SESSION: 'true',
        IGNORE_DB_CONNECTION_ERRORS: 'true',
        DATABASE_PROVIDER: 'memory',
        SKIP_PARTITION_CREATION: 'true',
        IGNORE_PARTITION_ERRORS: 'true'
      }
    });
  } catch (error) {
    console.error('Ошибка запуска:', error);
    process.exit(1);
  }
}

// Запускаем приложение
main().catch(error => {
  console.error('Критическая ошибка:', error);
  process.exit(1);
});