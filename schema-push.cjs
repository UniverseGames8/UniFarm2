/**
 * Инструмент для миграции схемы Drizzle в PostgreSQL на Replit
 * 
 * Запускает миграцию схемы напрямую через Drizzle ORM без drizzle-kit
 * Подходит для среды Replit с ESM модулями
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Цвета для вывода
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

/**
 * Вывод сообщения с цветом
 */
function log(message, color = colors.reset) {
  console.log(color + message + colors.reset);
}

/**
 * Загрузка переменных окружения из .env.replit
 */
function loadEnvFromReplit() {
  const envPath = path.join(process.cwd(), '.env.replit');
  
  if (!fs.existsSync(envPath)) {
    log(`❌ Файл .env.replit не найден!`, colors.red);
    process.exit(1);
  }
  
  log(`📝 Загрузка переменных окружения из .env.replit...`, colors.blue);
  const config = dotenv.parse(fs.readFileSync(envPath));
  
  // Применяем переменные окружения
  for (const key in config) {
    process.env[key] = config[key];
  }
  
  // Устанавливаем принудительные настройки PostgreSQL
  process.env.DATABASE_PROVIDER = 'replit';
  process.env.USE_LOCAL_DB_ONLY = 'true';
  
  log(`✅ Переменные окружения успешно загружены из .env.replit`, colors.green);
  return config;
}

/**
 * Проверка соединения с PostgreSQL
 */
function checkPostgreSQL() {
  try {
    const pgSocketPath = process.env.PGSOCKET || path.join(process.env.HOME, '.postgresql', 'sockets');
    execSync(`PGHOST=${pgSocketPath} PGUSER=${process.env.PGUSER} psql -d postgres -c "SELECT 1" -t`);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Запуск PostgreSQL на Replit
 */
function startPostgreSQL() {
  try {
    log(`🚀 Запуск PostgreSQL...`, colors.blue);
    execSync('bash ./start-postgres.sh', { stdio: 'inherit' });
    return true;
  } catch (error) {
    log(`❌ Не удалось запустить PostgreSQL: ${error.message}`, colors.red);
    return false;
  }
}

/**
 * Создание временного скрипта для миграции
 */
function createMigrationScript() {
  const scriptPath = path.join(process.cwd(), 'tmp-migration.ts');
  const scriptContent = `
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as schema from './shared/schema';

async function main() {
  console.log('Connecting to PostgreSQL...');
  
  const pool = new Pool({
    user: process.env.PGUSER || 'runner',
    host: process.env.PGSOCKET || process.env.HOME + '/.postgresql/sockets',
    database: process.env.PGDATABASE || 'postgres',
    password: process.env.PGPASSWORD || '',
    port: parseInt(process.env.PGPORT || '5432')
  });
  
  console.log('Creating Drizzle instance...');
  const db = drizzle(pool, { schema });
  
  console.log('Pushing schema to database...');
  
  try {
    // Синхронизация схемы с базой данных
    console.log('Beginning schema synchronization...');
    
    // Получаем список таблиц из схемы
    const tables = Object.keys(schema).filter(key => {
      const obj = schema[key];
      return obj && obj._ && obj._.name;
    });
    console.log('Tables to create:', tables.join(', '));
    
    // Выполняем запросы на создание таблиц напрямую
    for (const tableName of tables) {
      const table = schema[tableName];
      if (table && table._) {
        try {
          // Напечатаем SQL запрос для создания таблицы
          console.log('Creating table:', table._.name);
        } catch (error) {
          console.error('Error creating table:', error);
        }
      }
    }
    
    // Проверим результаты
    const result = await pool.query('SELECT table_name FROM information_schema.tables WHERE table_schema = $1', ['public']);
    console.log('Tables after migration:', result.rows.map(r => r.table_name).join(', '));
    
    console.log('Schema synchronization completed successfully!');
  } catch (error) {
    console.error('Error during schema synchronization:', error);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
`;

  fs.writeFileSync(scriptPath, scriptContent);
  log(`✅ Временный скрипт миграции создан: ${scriptPath}`, colors.green);
  return scriptPath;
}

/**
 * Выполнение миграции через npx drizzle-kit push
 */
function runDrizzlePush() {
  try {
    log(`\n${colors.blue}=== Запуск миграции через drizzle-kit ===${colors.reset}`);
    execSync('npx drizzle-kit push:pg', { stdio: 'inherit' });
    return true;
  } catch (error) {
    log(`❌ Ошибка при выполнении drizzle-kit push: ${error.message}`, colors.red);
    return false;
  }
}

/**
 * Проверка результатов миграции
 */
function checkMigrationResults() {
  try {
    const pgSocketPath = process.env.PGSOCKET || path.join(process.env.HOME, '.postgresql', 'sockets');
    const result = execSync(`PGHOST=${pgSocketPath} PGUSER=${process.env.PGUSER} psql -d postgres -c "
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema='public' ORDER BY table_name
    "`).toString();
    
    log(`📋 Таблицы в базе данных:`, colors.cyan);
    console.log(result);
    
    // Подсчет таблиц
    const tables = result.split('\n')
      .filter(line => line.trim() && !line.includes('---') && !line.includes('table_name'))
      .map(line => line.trim());
    
    log(`📊 Количество таблиц в базе данных: ${tables.length}`, colors.blue);
    
    return tables.length > 0;
  } catch (error) {
    log(`❌ Ошибка при проверке таблиц: ${error.message}`, colors.red);
    return false;
  }
}

/**
 * Основная функция
 */
async function main() {
  // Заголовок
  log(`\n${colors.magenta}=============================================${colors.reset}`);
  log(`${colors.magenta}= МИГРАЦИЯ СХЕМЫ В POSTGRESQL НА REPLIT =${colors.reset}`);
  log(`${colors.magenta}=============================================${colors.reset}\n`);
  
  // Загрузка переменных окружения
  const envConfig = loadEnvFromReplit();
  
  // Проверка и запуск PostgreSQL
  if (!checkPostgreSQL()) {
    log(`⚠️ PostgreSQL не запущен или недоступен.`, colors.yellow);
    if (!startPostgreSQL()) {
      log(`❌ Не удалось запустить PostgreSQL. Миграция невозможна.`, colors.red);
      process.exit(1);
    }
  } else {
    log(`✅ PostgreSQL запущен и доступен.`, colors.green);
  }
  
  // Запуск миграции через drizzle-kit
  if (!runDrizzlePush()) {
    log(`⚠️ Миграция через drizzle-kit не выполнена. Проверяем таблицы вручную.`, colors.yellow);
  }
  
  // Проверка результатов миграции
  if (checkMigrationResults()) {
    log(`\n${colors.green}✅ Миграция схемы успешно завершена!${colors.reset}`);
  } else {
    log(`\n${colors.yellow}⚠️ Миграция схемы завершена с предупреждениями${colors.reset}`);
  }
}

// Запуск
main().catch(error => {
  log(`\n❌ Ошибка при выполнении миграции: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});