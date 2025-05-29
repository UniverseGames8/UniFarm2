/**
 * Скрипт для настройки PostgreSQL Replit
 * 
 * Этот скрипт выполняет следующие действия:
 * 1. Создает базу данных PostgreSQL на Replit, если она еще не создана
 * 2. Получает и отображает переменные окружения для подключения
 * 3. Создает необходимые таблицы в базе данных
 * 
 * Использование:
 * node setup-replit-db.mjs
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

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
 * @param {string} message Сообщение для вывода
 * @param {string} color Цвет сообщения
 */
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

/**
 * Проверяет наличие переменных окружения PostgreSQL Replit
 * @returns {boolean} true если все переменные найдены, иначе false
 */
function checkReplitPostgresEnv() {
  const requiredEnvVars = ['DATABASE_URL', 'PGUSER', 'PGPASSWORD', 'PGHOST', 'PGPORT', 'PGDATABASE'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    log(`Отсутствуют следующие переменные окружения: ${missingVars.join(', ')}`, colors.yellow);
    return false;
  }
  
  return true;
}

/**
 * Создает базу данных PostgreSQL на Replit
 */
function createReplitPostgresDatabase() {
  log('Создание базы данных PostgreSQL на Replit...', colors.cyan);
  
  // Проверяем, была ли база данных уже создана
  if (checkReplitPostgresEnv()) {
    log('База данных PostgreSQL уже настроена на Replit', colors.green);
    return;
  }
  
  try {
    // Запрашиваем пользователя установить секрет "database-postgresql"
    log('\n===== ВАЖНО =====', colors.bright + colors.yellow);
    log('Для создания базы данных PostgreSQL на Replit выполните следующие шаги:', colors.yellow);
    log('1. Перейдите в раздел "Secrets" (Секреты) в левой панели Replit', colors.yellow);
    log('2. Добавьте новый секрет с ключом "database-postgresql" и значением "true"', colors.yellow);
    log('3. Подождите, пока Replit создаст базу данных (обычно занимает меньше минуты)', colors.yellow);
    log('4. Запустите этот скрипт снова: node setup-replit-db.mjs', colors.yellow);
    log('================\n', colors.bright + colors.yellow);
    return;
  } catch (error) {
    log(`Ошибка при создании базы данных: ${error.message}`, colors.red);
    process.exit(1);
  }
}

/**
 * Отображает информацию о подключении к базе данных
 */
function displayDatabaseInfo() {
  if (!checkReplitPostgresEnv()) {
    log('Невозможно отобразить информацию о базе данных - не все переменные окружения доступны', colors.red);
    return;
  }
  
  log('\n===== Информация о базе данных PostgreSQL =====', colors.bright + colors.cyan);
  log(`Хост: ${process.env.PGHOST}`, colors.cyan);
  log(`Порт: ${process.env.PGPORT}`, colors.cyan);
  log(`База данных: ${process.env.PGDATABASE}`, colors.cyan);
  log(`Пользователь: ${process.env.PGUSER}`, colors.cyan);
  log(`URL: ${process.env.DATABASE_URL.replace(/:([^:@]+)@/, ':****@')}`, colors.cyan);
  log('=============================================\n', colors.bright + colors.cyan);
}

/**
 * Мигрирует схему базы данных с помощью drizzle-kit
 */
function migrateDatabase() {
  if (!checkReplitPostgresEnv()) {
    log('Миграция невозможна - не все переменные окружения доступны', colors.red);
    return false;
  }
  
  log('Миграция схемы базы данных...', colors.cyan);
  
  try {
    // Проверяем наличие файла схемы
    const schemaPath = join(__dirname, 'shared', 'schema.ts');
    if (!fs.existsSync(schemaPath)) {
      log(`Файл схемы не найден: ${schemaPath}`, colors.red);
      return false;
    }
    
    // Запускаем миграцию с помощью drizzle-kit
    log('Запуск drizzle-kit push:pg...', colors.cyan);
    execSync('npx drizzle-kit push:pg', { stdio: 'inherit' });
    
    log('Миграция успешно завершена!', colors.green);
    return true;
  } catch (error) {
    log(`Ошибка при миграции базы данных: ${error.message}`, colors.red);
    return false;
  }
}

/**
 * Основная функция
 */
function main() {
  log('Запуск настройки PostgreSQL Replit...', colors.bright + colors.blue);
  
  // Проверяем наличие переменных окружения
  const hasEnvVars = checkReplitPostgresEnv();
  
  // Если переменные окружения отсутствуют, создаем базу данных
  if (!hasEnvVars) {
    createReplitPostgresDatabase();
    return;
  }
  
  // Отображаем информацию о базе данных
  displayDatabaseInfo();
  
  // Мигрируем схему
  const migrationSuccess = migrateDatabase();
  
  if (migrationSuccess) {
    log('\n===== Настройка завершена успешно =====', colors.bright + colors.green);
    log('База данных PostgreSQL на Replit готова к использованию!', colors.green);
    log('Для запуска сервера с новой базой данных выполните:', colors.green);
    log('node start-with-replit-db.js', colors.bright + colors.green);
    log('=======================================\n', colors.bright + colors.green);
  } else {
    log('\n===== Настройка завершена с ошибками =====', colors.bright + colors.red);
    log('Произошли ошибки при миграции схемы базы данных.', colors.red);
    log('Проверьте логи выше для получения дополнительной информации.', colors.red);
    log('=========================================\n', colors.bright + colors.red);
  }
}

// Запуск скрипта
main();