/**
 * Скрипт для запуска приложения с PostgreSQL на Replit
 * 
 * Этот скрипт выполняет следующие действия:
 * 1. Проверяет и настраивает переменные окружения
 * 2. Проверяет, запущен ли PostgreSQL на Replit
 * 3. Запускает PostgreSQL, если он не запущен
 * 4. Проверяет структуру базы данных и создает схему при необходимости
 * 5. Запускает приложение
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

// Функция для проверки, запущен ли PostgreSQL
async function isPostgresRunning() {
  try {
    await execAsync('pg_isready -h localhost');
    console.log('✅ PostgreSQL уже запущен');
    return true;
  } catch (error) {
    console.log('⚠️ PostgreSQL не запущен:', error.message);
    return false;
  }
}

// Функция для запуска PostgreSQL
async function startPostgres() {
  try {
    const pgDir = path.join(process.env.HOME, '.pg');
    const dataDir = path.join(pgDir, 'data');
    const runDir = path.join(pgDir, 'run');
    const logDir = path.join(pgDir, 'logs');
    
    // Создаем необходимые директории
    if (!fs.existsSync(pgDir)) fs.mkdirSync(pgDir, { recursive: true });
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(runDir)) fs.mkdirSync(runDir, { recursive: true });
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    
    // Проверяем, инициализирована ли база данных
    if (!fs.existsSync(path.join(dataDir, 'PG_VERSION'))) {
      console.log('🔧 Инициализируем PostgreSQL...');
      await execAsync(`initdb -D "${dataDir}" -U runner`);
      
      // Настраиваем PostgreSQL
      fs.appendFileSync(path.join(dataDir, 'postgresql.conf'), `
listen_addresses = '*'
port = 5432
unix_socket_directories = '${runDir}'
`);
      
      // Настраиваем авторизацию
      fs.writeFileSync(path.join(dataDir, 'pg_hba.conf'), `
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             all                                     trust
host    all             all             127.0.0.1/32            trust
host    all             all             ::1/128                 trust
`);
      
      console.log('✅ PostgreSQL успешно инициализирован');
    }
    
    // Запускаем PostgreSQL
    console.log('🚀 Запускаем PostgreSQL...');
    const logFile = path.join(logDir, 'postgresql.log');
    await execAsync(`pg_ctl -D "${dataDir}" -l "${logFile}" -o "-p 5432" start`);
    
    // Проверяем, что PostgreSQL запущен
    let maxRetries = 10;
    let isRunning = false;
    
    while (maxRetries > 0 && !isRunning) {
      try {
        await execAsync('pg_isready -h localhost');
        isRunning = true;
      } catch (error) {
        maxRetries--;
        if (maxRetries === 0) {
          throw new Error('PostgreSQL не удалось запустить после нескольких попыток');
        }
        console.log(`⏳ Ждем запуска PostgreSQL... (осталось попыток: ${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log('✅ PostgreSQL успешно запущен');
    return true;
  } catch (error) {
    console.error('❌ Ошибка запуска PostgreSQL:', error);
    return false;
  }
}

// Функция для настройки переменных окружения
async function setupEnvironment() {
  // Устанавливаем переменные окружения для PostgreSQL
  process.env.PGHOST = 'localhost';
  process.env.PGPORT = '5432';
  process.env.PGUSER = 'runner';
  process.env.PGPASSWORD = '';
  process.env.PGDATABASE = 'postgres';
  process.env.DATABASE_URL = 'postgresql://runner@localhost:5432/postgres';
  process.env.USE_LOCAL_DB_ONLY = 'true';
  
  // Проверяем существование базы данных postgres
  try {
    await execAsync('createdb -h localhost -U runner postgres 2>/dev/null || echo "База данных уже существует"');
    console.log('✅ База данных postgres проверена');
    return true;
  } catch (error) {
    console.error('⚠️ Ошибка проверки/создания базы данных:', error.message);
    return false;
  }
}

// Функция для запуска скрипта инициализации базы данных
async function initializeDatabase() {
  try {
    console.log('📦 Запускаем инициализацию базы данных...');
    await execAsync('node initialize-replit-db.mjs');
    console.log('✅ База данных успешно инициализирована');
    return true;
  } catch (error) {
    console.error('⚠️ Ошибка инициализации базы данных:', error.message);
    // Продолжаем выполнение даже в случае ошибки
    return false;
  }
}

// Функция для запуска приложения
function startApplication() {
  console.log('🚀 Запускаем приложение...');
  
  // Создаем процесс для запуска приложения
  const appProcess = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit',
    env: process.env
  });
  
  // Обрабатываем выход из процесса
  appProcess.on('close', (code) => {
    console.log(`⚠️ Приложение завершилось с кодом ${code}`);
    process.exit(code);
  });
  
  // Обрабатываем ошибки
  appProcess.on('error', (error) => {
    console.error('❌ Ошибка запуска приложения:', error);
    process.exit(1);
  });
  
  // Обрабатываем сигналы для корректного завершения
  process.on('SIGINT', () => {
    console.log('⚠️ Получен сигнал SIGINT, завершаем работу...');
    appProcess.kill('SIGINT');
  });
  
  process.on('SIGTERM', () => {
    console.log('⚠️ Получен сигнал SIGTERM, завершаем работу...');
    appProcess.kill('SIGTERM');
  });
}

// Основная функция
async function main() {
  console.log('🚀 Запуск приложения с PostgreSQL на Replit...');
  
  // Настраиваем переменные окружения
  const envSetup = await setupEnvironment();
  if (!envSetup) {
    console.error('❌ Не удалось настроить переменные окружения');
    process.exit(1);
  }
  
  // Проверяем и запускаем PostgreSQL
  let isRunning = await isPostgresRunning();
  if (!isRunning) {
    console.log('🔧 Пытаемся запустить PostgreSQL...');
    isRunning = await startPostgres();
    
    if (!isRunning) {
      console.error('❌ Не удалось запустить PostgreSQL');
      process.exit(1);
    }
  }
  
  // Инициализируем базу данных
  await initializeDatabase();
  
  // Запускаем приложение
  startApplication();
}

// Запускаем основную функцию
main().catch(error => {
  console.error('❌ Критическая ошибка:', error);
  process.exit(1);
});