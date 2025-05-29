/**
 * Миграция схемы базы данных для Replit PostgreSQL
 * 
 * Создает все необходимые таблицы на основе схемы Drizzle
 * Использует Drizzle Kit для автоматической миграции
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Настройка цветов для вывода
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
 * Выводит сообщение в консоль с цветом
 */
function log(message, color = colors.reset) {
  console.log(color + message + colors.reset);
}

/**
 * Загружает переменные окружения из .env.replit
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
 * Выполняет push схемы в базу данных
 */
function migrateSchema() {
  log(`\n${colors.blue}=== Миграция схемы в PostgreSQL ===${colors.reset}`);
  log(`🔄 Выполнение миграции схемы...`, colors.magenta);
  
  try {
    execSync('npx drizzle-kit push:pg', { stdio: 'inherit' });
    log(`✅ Схема успешно перенесена в базу данных`, colors.green);
    return true;
  } catch (err) {
    log(`❌ Ошибка при миграции схемы: ${err.message}`, colors.red);
    return false;
  }
}

/**
 * Проверяет результаты миграции
 */
function verifyMigration() {
  log(`\n${colors.blue}=== Проверка результатов миграции ===${colors.reset}`);
  log(`🔍 Проверка созданных таблиц...`, colors.magenta);
  
  try {
    const pgSocketPath = process.env.PGSOCKET || path.join(process.env.HOME, '.postgresql', 'sockets');
    const tablesResult = execSync(`PGHOST=${pgSocketPath} PGUSER=${process.env.PGUSER} psql -d postgres -c "
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    "`).toString();
    
    log(`📋 Список таблиц в базе данных:`, colors.cyan);
    console.log(tablesResult);
    
    // Проверяем количество таблиц
    const tableCount = tablesResult.split('\n').filter(line => line.trim().length > 0 && !line.includes('-') && !line.includes('table_name')).length;
    log(`ℹ️ Количество таблиц: ${tableCount}`, colors.blue);
    
    if (tableCount > 10) {
      log(`✅ Миграция схемы выполнена успешно`, colors.green);
      return true;
    } else {
      log(`⚠️ Количество таблиц меньше ожидаемого (${tableCount} < 10)`, colors.yellow);
      return false;
    }
  } catch (err) {
    log(`❌ Ошибка при проверке результатов миграции: ${err.message}`, colors.red);
    return false;
  }
}

/**
 * Основная функция
 */
async function main() {
  // Показываем заголовок
  log(`\n${colors.magenta}=======================================${colors.reset}`);
  log(`${colors.magenta}= МИГРАЦИЯ СХЕМЫ В REPLIT POSTGRESQL =${colors.reset}`);
  log(`${colors.magenta}=======================================${colors.reset}\n`);
  
  // Загружаем переменные окружения
  loadEnvFromReplit();
  
  // Проверяем, запущен ли PostgreSQL
  if (!checkPostgreSQLRunning()) {
    log(`🔄 PostgreSQL не запущен, пытаемся запустить...`, colors.yellow);
    if (!startPostgreSQL()) {
      log(`❌ Не удалось запустить PostgreSQL, миграция невозможна`, colors.red);
      process.exit(1);
    }
  }
  
  // Выполняем миграцию
  if (!migrateSchema()) {
    log(`❌ Миграция схемы не выполнена`, colors.red);
    process.exit(1);
  }
  
  // Проверяем результаты
  if (!verifyMigration()) {
    log(`⚠️ Результаты миграции не соответствуют ожиданиям`, colors.yellow);
  }
  
  log(`\n${colors.green}Миграция схемы завершена!${colors.reset}`);
}

// Запускаем скрипт
main().catch(err => {
  log(`\n❌ Ошибка при выполнении миграции: ${err.message}`, colors.red);
  process.exit(1);
});