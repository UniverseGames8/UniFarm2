/**
 * Запуск приложения с использованием Replit PostgreSQL
 * 
 * Этот скрипт:
 * 1. Запускает PostgreSQL с использованием Unix-сокетов
 * 2. Загружает переменные окружения из .env.replit
 * 3. Устанавливает DATABASE_PROVIDER=replit и USE_LOCAL_DB_ONLY=true
 * 4. Запускает приложение
 */

const { execSync, spawn } = require('child_process');
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
    log(`❌ Файл .env.replit не найден! Создание нового файла...`, colors.yellow);
    
    const defaultEnvContent = 
`DATABASE_URL=postgresql://runner@localhost:5432/postgres?host=/home/runner/.postgresql/sockets
PGHOST=localhost
PGPORT=5432
PGUSER=runner
PGPASSWORD=
PGSOCKET=/home/runner/.postgresql/sockets
PGDATABASE=postgres
USE_LOCAL_DB_ONLY=true
DATABASE_PROVIDER=replit
PORT=3000`;
    
    fs.writeFileSync(replitEnvPath, defaultEnvContent);
    log(`✅ Создан новый файл .env.replit с настройками PostgreSQL`, colors.green);
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
  
  log(`✅ Переменные окружения успешно загружены`, colors.green);
  log(`ℹ️ DATABASE_PROVIDER установлен в ${process.env.DATABASE_PROVIDER}`, colors.cyan);
  log(`ℹ️ USE_LOCAL_DB_ONLY установлен в ${process.env.USE_LOCAL_DB_ONLY}`, colors.cyan);
}

/**
 * Проверяет наличие необходимых переменных окружения
 */
function checkEnvironmentVariables() {
  const requiredVars = ['DATABASE_URL', 'PGHOST', 'PGPORT', 'PGUSER', 'PGDATABASE'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    log(`❌ Отсутствуют необходимые переменные окружения: ${missingVars.join(', ')}`, colors.red);
    process.exit(1);
  }
  
  log(`✅ Все необходимые переменные окружения присутствуют`, colors.green);
}

/**
 * Запуск PostgreSQL на Replit
 */
function startPostgreSQL() {
  log(`\n${colors.blue}=== Запуск PostgreSQL ===${colors.reset}`);
  
  try {
    log(`🔄 Запуск скрипта start-postgres.sh...`, colors.cyan);
    execSync('bash ./start-postgres.sh', { stdio: 'inherit' });
    log(`✅ PostgreSQL успешно запущен`, colors.green);
    
    // Проверяем соединение с базой данных
    try {
      const result = execSync(`PGHOST=${process.env.PGSOCKET || process.env.HOME + '/.postgresql/sockets'} PGUSER=${process.env.PGUSER} psql -d ${process.env.PGDATABASE} -c "SELECT 1" -t`).toString().trim();
      
      if (result === '1') {
        log(`✅ Соединение с PostgreSQL подтверждено`, colors.green);
      } else {
        log(`⚠️ Неожиданный результат проверки соединения: ${result}`, colors.yellow);
      }
    } catch (err) {
      log(`❌ Ошибка при проверке соединения с PostgreSQL: ${err.message}`, colors.red);
      process.exit(1);
    }
  } catch (err) {
    log(`❌ Не удалось запустить PostgreSQL: ${err.message}`, colors.red);
    process.exit(1);
  }
}

/**
 * Запускает процесс сервера
 */
function startServer() {
  log(`\n${colors.blue}=== Запуск сервера ===${colors.reset}`);
  log(`🚀 Запуск сервера с использованием Replit PostgreSQL...`, colors.magenta);
  
  const serverProcess = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit',
    env: process.env
  });
  
  serverProcess.on('close', (code) => {
    log(`⚠️ Сервер завершил работу с кодом: ${code}`, colors.yellow);
  });
  
  serverProcess.on('error', (err) => {
    log(`❌ Ошибка при запуске сервера: ${err.message}`, colors.red);
  });
}

/**
 * Основная функция
 */
function main() {
  // Показываем заголовок
  log(`\n${colors.magenta}=========================================${colors.reset}`);
  log(`${colors.magenta}= ЗАПУСК UNIFARM С REPLIT POSTGRESQL =${colors.reset}`);
  log(`${colors.magenta}=========================================${colors.reset}\n`);
  
  // Загружаем переменные окружения
  loadEnvFromReplit();
  
  // Проверяем наличие всех необходимых переменных
  checkEnvironmentVariables();
  
  // Запускаем PostgreSQL
  startPostgreSQL();
  
  // Запускаем сервер
  startServer();
}

// Запускаем скрипт
main();