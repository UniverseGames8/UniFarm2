/**
 * Скрипт для миграции схемы базы данных на Replit PostgreSQL
 * 
 * Этот скрипт выполняет следующие действия:
 * 1. Проверяет наличие необходимых переменных окружения
 * 2. Устанавливает соединение с базой данных Replit
 * 3. Создает необходимые таблицы и индексы с помощью Drizzle
 * 
 * Использование:
 * node migrate-replit-db.mjs
 */

import { exec, execSync } from 'child_process';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Цвета для консоли
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

/**
 * Выводит сообщение в консоль с цветом
 */
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

/**
 * Проверяет наличие необходимых переменных окружения
 */
function checkEnvironmentVariables() {
  log('Проверка переменных окружения...', colors.cyan);
  
  const requiredVars = ['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE', 'DATABASE_URL'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    log(`Отсутствуют необходимые переменные окружения: ${missingVars.join(', ')}`, colors.red);
    log('Для создания базы данных PostgreSQL:', colors.yellow);
    log('1. Используйте инструмент create_postgresql_database_tool', colors.yellow);
    log('2. Или добавьте необходимые переменные в секреты Replit', colors.yellow);
    return false;
  }
  
  log(`PGHOST: ${process.env.PGHOST}`, colors.green);
  log(`PGPORT: ${process.env.PGPORT}`, colors.green);
  log(`PGUSER: ${process.env.PGUSER}`, colors.green);
  log(`PGDATABASE: ${process.env.PGDATABASE}`, colors.green);
  log('Все необходимые переменные окружения найдены', colors.green);
  return true;
}

/**
 * Проверяет соединение с базой данных
 */
async function testConnection() {
  log('Проверка соединения с базой данных...', colors.cyan);
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGHOST?.includes('neon.tech') 
      ? { rejectUnauthorized: true } // Для Neon DB требуется SSL
      : false // Для локального Replit SSL не требуется
  });
  
  try {
    const result = await pool.query('SELECT current_database() as db_name, current_user, version()');
    const { db_name, current_user, version } = result.rows[0];
    
    log(`Успешное подключение к базе данных ${db_name}`, colors.green);
    log(`Пользователь: ${current_user}`, colors.green);
    log(`Версия PostgreSQL: ${version}`, colors.green);
    
    // Проверка существующих таблиц
    const tablesResult = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    
    if (tablesResult.rows.length > 0) {
      log('Существующие таблицы:', colors.cyan);
      tablesResult.rows.forEach(row => {
        log(`- ${row.table_name}`, colors.blue);
      });
    } else {
      log('В базе данных нет таблиц', colors.yellow);
    }
    
    await pool.end();
    return true;
  } catch (error) {
    log(`Ошибка подключения к базе данных: ${error.message}`, colors.red);
    return false;
  }
}

/**
 * Создает базовую структуру базы данных с помощью Drizzle
 */
async function createDatabaseSchema() {
  log('Создание структуры базы данных...', colors.cyan);
  
  try {
    // Проверяем наличие файла схемы
    const schemaFile = join(__dirname, 'shared', 'schema.ts');
    if (!fs.existsSync(schemaFile)) {
      log(`Файл схемы не найден: ${schemaFile}`, colors.red);
      return false;
    }
    
    // Устанавливаем переменную окружения DATABASE_PROVIDER для использования Replit
    process.env.DATABASE_PROVIDER = 'replit';
    
    // Запускаем Drizzle для создания схемы
    log('Запуск Drizzle для создания схемы...', colors.cyan);
    
    // Используем npx drizzle-kit push:pg для создания схемы
    execSync('npx drizzle-kit push:pg', { stdio: 'inherit' });
    
    log('Структура базы данных успешно создана', colors.green);
    return true;
  } catch (error) {
    log(`Ошибка создания структуры базы данных: ${error.message}`, colors.red);
    return false;
  }
}

/**
 * Основная функция миграции
 */
async function migrateDatabase() {
  log('\n=== Миграция базы данных на Replit PostgreSQL ===\n', colors.bright + colors.blue);
  
  // Проверяем переменные окружения
  if (!checkEnvironmentVariables()) {
    return false;
  }
  
  // Проверяем соединение с базой данных
  if (!await testConnection()) {
    return false;
  }
  
  // Создаем структуру базы данных
  if (!await createDatabaseSchema()) {
    return false;
  }
  
  log('\n=== Миграция успешно завершена ===\n', colors.bright + colors.green);
  log('Для запуска приложения с базой данных Replit выполните:', colors.cyan);
  log('DATABASE_PROVIDER=replit node server/index.ts', colors.bright + colors.yellow);
  log('Или используйте скрипт:', colors.cyan);
  log('node start-with-replit-db.js', colors.bright + colors.yellow);
  
  return true;
}

// Запуск скрипта
migrateDatabase().catch(error => {
  log(`Критическая ошибка: ${error.message}`, colors.red);
  process.exit(1);
});