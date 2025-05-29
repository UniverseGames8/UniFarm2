/**
 * Скрипт для инициализации нового соединения с базой данных Replit PostgreSQL
 * и миграции структуры базы данных
 * 
 * Использование:
 * node initialize-replit-database.mjs
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';
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
 * Проверяет наличие переменных окружения PostgreSQL в Replit
 */
function checkPostgreSQLEnvironment() {
  log('Проверка наличия переменных окружения PostgreSQL...', colors.cyan);
  
  const required = ['PGHOST', 'PGUSER', 'PGPASSWORD', 'PGDATABASE', 'PGPORT'];
  const missing = required.filter(name => !process.env[name]);
  
  if (missing.length > 0) {
    log(`Отсутствуют переменные окружения: ${missing.join(', ')}`, colors.yellow);
    return false;
  }
  
  log('Все необходимые переменные окружения найдены', colors.green);
  return true;
}

/**
 * Обнаруживает PostgreSQL соединение на Replit
 */
async function detectReplitPostgreSQL() {
  log('Поиск PostgreSQL соединения на Replit...', colors.cyan);
  
  try {
    // Проверяем, создана ли база данных на Replit
    if (!process.env.DATABASE_URL) {
      log('DATABASE_URL не найден. Возможно, Replit PostgreSQL не настроен', colors.yellow);
      return false;
    }
    
    // Пробуем подключиться к базе данных
    const pool = new Pool();
    const result = await pool.query('SELECT current_database(), current_user, inet_server_addr()');
    const { current_database, current_user, inet_server_addr } = result.rows[0];
    
    log(`Успешное подключение к базе данных ${current_database} как ${current_user}`, colors.green);
    log(`Адрес сервера: ${inet_server_addr}`, colors.green);
    
    await pool.end();
    return true;
  } catch (error) {
    log(`Ошибка при проверке соединения: ${error.message}`, colors.red);
    return false;
  }
}

/**
 * Проверяет, является ли база данных Neon DB
 */
async function checkIfNeonDB() {
  if (!process.env.PGHOST) return false;
  
  // Простая проверка на Neon DB по имени хоста
  return process.env.PGHOST.includes('neon.tech');
}

/**
 * Получает переменные окружения от нового соединения PostgreSQL
 */
async function getReplitPostgreSQLEnv() {
  // Здесь должен быть код для получения новых переменных окружения
  // Но поскольку в рамках текущей сессии мы не можем получить их напрямую,
  // мы будем использовать переменные, которые добавляются вручную через Secrets
  
  log('\n===== ВАЖНО =====', colors.bright + colors.yellow);
  log('Для создания базы данных PostgreSQL на Replit выполните следующие шаги:', colors.yellow);
  log('1. Перейдите в раздел "Secrets" (Секреты) в левой панели Replit', colors.yellow);
  log('2. Добавьте новый секрет с ключом "database-postgresql" и значением "true"', colors.yellow);
  log('3. Подождите, пока Replit создаст базу данных (обычно занимает меньше минуты)', colors.yellow);
  log('4. Запустите этот скрипт снова: node initialize-replit-database.mjs', colors.yellow);
  log('================\n', colors.bright + colors.yellow);
  
  return false;
}

/**
 * Мигрирует структуру базы данных
 */
async function migrateDatabase() {
  log('Миграция структуры базы данных...', colors.cyan);
  
  try {
    // Проверяем наличие Drizzle и схемы базы данных
    const schemaFile = join(__dirname, 'shared', 'schema.ts');
    if (!fs.existsSync(schemaFile)) {
      log(`Файл схемы не найден: ${schemaFile}`, colors.red);
      return false;
    }
    
    // Запускаем миграцию
    log('Запуск Drizzle миграции...', colors.cyan);
    execSync('npx drizzle-kit push:pg', { stdio: 'inherit' });
    
    log('Миграция успешно завершена', colors.green);
    return true;
  } catch (error) {
    log(`Ошибка при миграции: ${error.message}`, colors.red);
    return false;
  }
}

/**
 * Основная функция
 */
async function main() {
  log('Инициализация базы данных Replit PostgreSQL...', colors.bright + colors.blue);
  
  // Проверяем, подключены ли мы к Neon DB
  const isNeonDB = await checkIfNeonDB();
  if (isNeonDB) {
    log('\nСейчас используется Neon DB. Необходимо переключиться на Replit PostgreSQL.', colors.yellow);
    
    // Получаем переменные окружения для Replit PostgreSQL
    const replitEnvSetup = await getReplitPostgreSQLEnv();
    if (!replitEnvSetup) {
      return;
    }
  } else {
    log('Текущее соединение не использует Neon DB.', colors.green);
  }
  
  // Проверяем переменные окружения
  const envOk = checkPostgreSQLEnvironment();
  if (!envOk) {
    log('Невозможно продолжить без необходимых переменных окружения', colors.red);
    return;
  }
  
  // Проверяем соединение с PostgreSQL на Replit
  const connectionOk = await detectReplitPostgreSQL();
  if (!connectionOk) {
    log('Невозможно продолжить без функционирующего соединения PostgreSQL', colors.red);
    return;
  }
  
  // Мигрируем структуру базы данных
  const migrationOk = await migrateDatabase();
  if (!migrationOk) {
    log('Миграция базы данных не удалась', colors.red);
    return;
  }
  
  log('\n===== Инициализация успешно завершена =====', colors.bright + colors.green);
  log('База данных Replit PostgreSQL готова к использованию!', colors.green);
  log('Для запуска приложения с новой базой данных выполните:', colors.green);
  log('node start-with-replit-db.js', colors.bright + colors.green);
  log('==========================================\n', colors.bright + colors.green);
}

// Запуск скрипта
main().catch(error => {
  log(`Ошибка: ${error.message}`, colors.red);
  process.exit(1);
});