/**
 * Запуск приложения с PostgreSQL на Replit
 * 
 * Этот скрипт:
 * 1. Запускает PostgreSQL
 * 2. Загружает переменные окружения из .env.replit
 * 3. Устанавливает DATABASE_PROVIDER=replit и USE_LOCAL_DB_ONLY=true
 * 4. Запускает приложение
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
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
 * Вывод сообщения в консоль
 */
function log(message, color = colors.reset) {
  console.log(color + message + colors.reset);
}

/**
 * Загрузка переменных окружения из .env.replit
 */
function loadEnvFromReplit() {
  log(`📥 Загрузка переменных окружения из .env.replit...`, colors.blue);
  
  const envFile = path.join(process.cwd(), '.env.replit');
  if (!fs.existsSync(envFile)) {
    log(`❌ Файл .env.replit не найден!`, colors.red);
    process.exit(1);
  }
  
  const envVars = dotenv.parse(fs.readFileSync(envFile));
  
  // Принудительно устанавливаем использование Replit PostgreSQL
  envVars.DATABASE_PROVIDER = 'replit';
  envVars.USE_LOCAL_DB_ONLY = 'true';
  
  // Устанавливаем переменные окружения
  for (const key in envVars) {
    process.env[key] = envVars[key];
  }
  
  log(`✅ Переменные окружения успешно загружены`, colors.green);
  return envVars;
}

/**
 * Проверка и запуск PostgreSQL
 */
function ensurePostgresRunning() {
  log(`🔍 Проверка состояния PostgreSQL...`, colors.blue);
  
  try {
    const pgSocketPath = process.env.PGSOCKET || path.join(process.env.HOME, '.postgresql', 'sockets');
    execSync(`PGHOST=${pgSocketPath} PGUSER=${process.env.PGUSER} psql -d postgres -c "SELECT 1" -t`);
    log(`✅ PostgreSQL запущен и доступен`, colors.green);
    return true;
  } catch (error) {
    log(`🔄 PostgreSQL не запущен, запускаем...`, colors.yellow);
    
    try {
      execSync('bash ./start-postgres.sh', { stdio: 'inherit' });
      log(`✅ PostgreSQL успешно запущен`, colors.green);
      return true;
    } catch (error) {
      log(`❌ Не удалось запустить PostgreSQL: ${error.message}`, colors.red);
      return false;
    }
  }
}

/**
 * Проверка структуры базы данных
 */
function checkDatabaseStructure() {
  log(`🔍 Проверка структуры базы данных...`, colors.blue);
  
  try {
    const pgSocketPath = process.env.PGSOCKET || path.join(process.env.HOME, '.postgresql', 'sockets');
    const result = execSync(`PGHOST=${pgSocketPath} PGUSER=${process.env.PGUSER} psql -d postgres -c "
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema='public' ORDER BY table_name
    "`).toString();
    
    const requiredTables = ['users', 'auth_users', 'transactions'];
    const existingTables = result.split('\n')
      .filter(line => line.trim() && !line.includes('---') && !line.includes('table_name'))
      .map(line => line.trim());
    
    // Проверка наличия обязательных таблиц
    const missingTables = requiredTables.filter(table => !existingTables.includes(table));
    
    if (missingTables.length === 0) {
      log(`✅ Структура базы данных корректна`, colors.green);
      return true;
    } else {
      log(`⚠️ Отсутствуют обязательные таблицы: ${missingTables.join(', ')}`, colors.yellow);
      log(`🔄 Запуск миграции схемы...`, colors.yellow);
      
      try {
        execSync('node migrate-direct.cjs', { stdio: 'inherit' });
        log(`✅ Миграция схемы успешно выполнена`, colors.green);
        return true;
      } catch (error) {
        log(`❌ Ошибка при выполнении миграции: ${error.message}`, colors.red);
        return false;
      }
    }
  } catch (error) {
    log(`❌ Ошибка при проверке структуры базы данных: ${error.message}`, colors.red);
    return false;
  }
}

/**
 * Запуск приложения
 */
function startApplication() {
  log(`\n${colors.blue}=== Запуск приложения ===${colors.reset}`);
  log(`🚀 Запуск сервера...`, colors.magenta);
  
  const serverProcess = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit',
    env: process.env
  });
  
  serverProcess.on('close', (code) => {
    log(`⚠️ Сервер завершил работу с кодом ${code}`, colors.yellow);
  });
  
  serverProcess.on('error', (error) => {
    log(`❌ Ошибка при запуске сервера: ${error.message}`, colors.red);
  });
  
  // Обработка сигналов завершения
  process.on('SIGINT', () => {
    log(`\n👋 Завершение работы по команде пользователя...`, colors.blue);
    serverProcess.kill('SIGINT');
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    log(`\n👋 Завершение работы...`, colors.blue);
    serverProcess.kill('SIGTERM');
    process.exit(0);
  });
  
  log(`✅ Приложение запущено с использованием PostgreSQL на Replit`, colors.green);
}

/**
 * Основная функция
 */
function main() {
  // Заголовок
  log(`\n${colors.magenta}=========================================${colors.reset}`);
  log(`${colors.magenta}= ЗАПУСК UNIFARM С POSTGRESQL НА REPLIT =${colors.reset}`);
  log(`${colors.magenta}=========================================${colors.reset}\n`);
  
  // Загрузка переменных окружения
  loadEnvFromReplit();
  
  // Проверка и запуск PostgreSQL
  if (!ensurePostgresRunning()) {
    log(`❌ Не удалось запустить PostgreSQL. Завершение работы.`, colors.red);
    process.exit(1);
  }
  
  // Проверка структуры базы данных
  if (!checkDatabaseStructure()) {
    log(`⚠️ Структура базы данных некорректна, но продолжаем запуск.`, colors.yellow);
  }
  
  // Запуск приложения
  startApplication();
}

// Запуск скрипта
main();