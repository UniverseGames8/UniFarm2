/**
 * Скрипт для удаления временной таблицы transactions_temp
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const { execSync } = require('child_process');

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
 * Вывод сообщения в консоль с цветом
 */
function log(message, color = colors.reset) {
  console.log(color + message + colors.reset);
}

/**
 * Загрузка переменных окружения из .env.replit
 */
function loadEnvFromReplit() {
  const replitEnvPath = path.join(process.cwd(), '.env.replit');
  
  if (!fs.existsSync(replitEnvPath)) {
    log(`❌ Файл .env.replit не найден!`, colors.red);
    process.exit(1);
  }
  
  log(`📝 Загрузка переменных окружения из .env.replit...`, colors.blue);
  const envConfig = dotenv.parse(fs.readFileSync(replitEnvPath));
  
  // Устанавливаем принудительное использование Replit PostgreSQL
  envConfig.DATABASE_PROVIDER = 'replit';
  envConfig.USE_LOCAL_DB_ONLY = 'true';
  
  // Применяем переменные окружения
  for (const key in envConfig) {
    process.env[key] = envConfig[key];
  }
  
  log(`✅ Переменные окружения успешно загружены из .env.replit`, colors.green);
}

/**
 * Проверяет, запущен ли PostgreSQL
 */
function checkPostgreSQLRunning() {
  log(`🔍 Проверка состояния PostgreSQL...`, colors.blue);
  
  try {
    const pgSocketPath = process.env.PGSOCKET || path.join(process.env.HOME, '.postgresql', 'sockets');
    const result = execSync(`PGHOST=${pgSocketPath} PGUSER=${process.env.PGUSER} psql -d postgres -c "SELECT 1" -t`).toString().trim();
    
    if (result === '1') {
      log(`✅ PostgreSQL запущен и доступен`, colors.green);
      return true;
    } else {
      log(`⚠️ PostgreSQL запущен, но возвращает неожиданный результат: ${result}`, colors.yellow);
      return false;
    }
  } catch (err) {
    log(`❌ PostgreSQL не запущен или недоступен: ${err.message}`, colors.red);
    return false;
  }
}

/**
 * Запускает PostgreSQL через скрипт start-postgres.sh
 */
function startPostgreSQL() {
  log(`🚀 Запуск PostgreSQL...`, colors.blue);
  
  try {
    execSync('bash ./start-postgres.sh', { stdio: 'inherit' });
    log(`✅ PostgreSQL успешно запущен`, colors.green);
    return true;
  } catch (err) {
    log(`❌ Не удалось запустить PostgreSQL: ${err.message}`, colors.red);
    return false;
  }
}

/**
 * Удаляет временную таблицу transactions_temp
 */
async function cleanupTempTable() {
  log(`\n${colors.blue}=== Удаление временной таблицы ===${colors.reset}`);
  
  // Создаем подключение к базе данных
  const pgSocketPath = process.env.PGSOCKET || path.join(process.env.HOME, '.postgresql', 'sockets');
  const pool = new Pool({
    host: pgSocketPath,
    user: process.env.PGUSER || 'runner',
    database: process.env.PGDATABASE || 'postgres',
    password: process.env.PGPASSWORD || '',
    port: parseInt(process.env.PGPORT || '5432'),
  });
  
  try {
    // Проверяем, существует ли таблица transactions_temp
    const existsResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'transactions_temp'
      )
    `);
    
    const tempTableExists = existsResult.rows[0].exists;
    if (!tempTableExists) {
      log(`✅ Таблица transactions_temp не существует, нечего удалять`, colors.green);
      return true;
    }
    
    // Удаляем временную таблицу
    log(`🧹 Удаление временной таблицы transactions_temp...`, colors.blue);
    await pool.query(`DROP TABLE transactions_temp`);
    
    log(`✅ Таблица transactions_temp успешно удалена`, colors.green);
    return true;
  } catch (error) {
    log(`❌ Ошибка при удалении временной таблицы: ${error.message}`, colors.red);
    console.error(error);
    return false;
  } finally {
    // Закрываем подключение
    await pool.end();
  }
}

/**
 * Основная функция
 */
async function main() {
  // Показываем заголовок
  log(`\n${colors.magenta}====================================${colors.reset}`);
  log(`${colors.magenta}= ОЧИСТКА ВРЕМЕННОЙ ТАБЛИЦЫ В БД =${colors.reset}`);
  log(`${colors.magenta}====================================${colors.reset}\n`);
  
  // Загружаем переменные окружения
  loadEnvFromReplit();
  
  // Проверяем, запущен ли PostgreSQL
  if (!checkPostgreSQLRunning()) {
    log(`🔄 PostgreSQL не запущен, пытаемся запустить...`, colors.yellow);
    if (!startPostgreSQL()) {
      log(`❌ Не удалось запустить PostgreSQL, операция невозможна`, colors.red);
      process.exit(1);
    }
  }
  
  // Удаляем временную таблицу
  if (await cleanupTempTable()) {
    log(`\n${colors.green}✅ Очистка временной таблицы успешно завершена!${colors.reset}`);
  } else {
    log(`\n${colors.red}❌ Не удалось очистить временную таблицу${colors.reset}`);
    process.exit(1);
  }
}

// Запускаем основную функцию
main().catch(err => {
  log(`\n❌ Критическая ошибка: ${err.message}`, colors.red);
  console.error(err);
  process.exit(1);
});