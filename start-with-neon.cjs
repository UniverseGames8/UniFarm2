/**
 * Унифицированный скрипт запуска для UniFarm
 * 
 * Этот скрипт объединяет все необходимые шаги для запуска приложения:
 * 1. Запуск PostgreSQL на Replit
 * 2. Загрузка переменных окружения
 * 3. Создание таблиц в базе данных (если нужно)
 * 4. Запуск приложения
 */

// Модули для работы с процессами, файлами и путями
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

// Цвета для вывода в консоль
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
 * Загрузка переменных окружения с приоритетом для Neon DB
 */
function loadEnvironment() {
  log(`\n${colors.blue}=== Загрузка переменных окружения ===${colors.reset}`);
  
  // НОВЫЙ КОД: Сначала пробуем загрузить из .env.neon для приоритета Neon DB
  const neonEnvPath = path.join(process.cwd(), '.env.neon');
  if (fs.existsSync(neonEnvPath)) {
    log(`📝 Загрузка переменных из .env.neon...`, colors.blue);
    const envConfig = dotenv.parse(fs.readFileSync(neonEnvPath));
    
    // Применяем переменные окружения
    for (const key in envConfig) {
      process.env[key] = envConfig[key];
    }
    
    // Устанавливаем принудительные настройки для Neon DB
    process.env.DATABASE_PROVIDER = 'neon';
    process.env.FORCE_NEON_DB = 'true';
    process.env.DISABLE_REPLIT_DB = 'true';
    process.env.USE_LOCAL_DB_ONLY = 'false';
    process.env.OVERRIDE_DB_PROVIDER = 'neon';
    
    log(`✅ Переменные окружения из .env.neon успешно загружены`, colors.green);
    log(`✅ Установлено принудительное использование Neon DB`, colors.green);
  } else {
    log(`⚠️ Файл .env.neon не найден, переходим к стандартной логике`, colors.yellow);
    
    // Проверяем, запущен ли скрипт на Replit
    const isReplit = process.env.REPL_ID && process.env.REPL_OWNER;
    
    if (isReplit) {
      // Сначала пробуем загрузить из .env.replit
      const replitEnvPath = path.join(process.cwd(), '.env.replit');
      if (fs.existsSync(replitEnvPath)) {
        log(`📝 Загрузка переменных из .env.replit...`, colors.blue);
        const envConfig = dotenv.parse(fs.readFileSync(replitEnvPath));
        
        // Применяем переменные окружения
        for (const key in envConfig) {
          process.env[key] = envConfig[key];
        }
        
        // Устанавливаем принудительные настройки для Replit
        process.env.DATABASE_PROVIDER = 'replit';
        process.env.USE_LOCAL_DB_ONLY = 'true';
        
        log(`✅ Переменные окружения из .env.replit успешно загружены`, colors.green);
      } else {
        log(`⚠️ Файл .env.replit не найден, используем системные переменные`, colors.yellow);
      }
    } else {
      // Не на Replit - загружаем стандартный .env
      log(`📝 Загрузка стандартных переменных окружения...`, colors.blue);
      dotenv.config();
      log(`✅ Стандартные переменные окружения загружены`, colors.green);
    }
  }
  
  // Проверка важных переменных окружения
  const requiredVars = ['DATABASE_PROVIDER', 'PORT'];
  let missingVars = [];
  
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  }
  
  if (missingVars.length > 0) {
    log(`⚠️ Не найдены важные переменные окружения: ${missingVars.join(', ')}`, colors.yellow);
    
    // Установка значений по умолчанию с приоритетом Neon DB
    if (!process.env.DATABASE_PROVIDER) process.env.DATABASE_PROVIDER = 'neon';
    if (!process.env.PORT) process.env.PORT = '3000';
    
    log(`⚠️ Установлены значения по умолчанию`, colors.yellow);
  }
  
  log(`ℹ️ DATABASE_PROVIDER = ${process.env.DATABASE_PROVIDER}`, colors.blue);
  log(`ℹ️ PORT = ${process.env.PORT}`, colors.blue);
  
  // Всегда выводим дополнительную информацию о настройках соединения
  if (process.env.DATABASE_PROVIDER === 'neon') {
    log(`🚀 НАСТРОЕНО ИСПОЛЬЗОВАНИЕ NEON DB`, colors.green);
    if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('neon.tech')) {
      log(`✅ DATABASE_URL содержит neon.tech - корректная строка подключения`, colors.green);
    } else {
      log(`⚠️ DATABASE_URL не указывает на Neon DB или отсутствует!`, colors.yellow);
    }
  } else {
    log(`📊 НАСТРОЕНО ИСПОЛЬЗОВАНИЕ REPLIT POSTGRESQL`, colors.blue);
  }
}

/**
 * Запуск и настройка PostgreSQL на Replit
 */
async function setupPostgreSQL() {
  log(`\n${colors.blue}=== Настройка PostgreSQL ===${colors.reset}`);
  
  // Проверяем, запущен ли PostgreSQL уже
  let isRunning = false;
  
  try {
    // Создаем путь для сокетов, если еще не создан
    const socketPath = process.env.HOME ? path.join(process.env.HOME, '.postgresql', 'sockets') : '/tmp/.postgresql/sockets';
    
    if (!fs.existsSync(socketPath)) {
      fs.mkdirSync(socketPath, { recursive: true });
      log(`📁 Создан каталог для сокетов: ${socketPath}`, colors.blue);
    }
    
    process.env.PGSOCKET = socketPath;
    
    // Проверяем соединение с PostgreSQL
    execSync(`PGHOST=${socketPath} PGUSER=runner psql -d postgres -c "SELECT 1" -t`);
    isRunning = true;
    log(`✅ PostgreSQL уже запущен и доступен`, colors.green);
  } catch (error) {
    log(`🔄 PostgreSQL не запущен, запускаем...`, colors.yellow);
    
    try {
      // Запускаем PostgreSQL с помощью нашего скрипта
      execSync('bash ./start-postgres.sh', { stdio: 'inherit' });
      isRunning = true;
      log(`✅ PostgreSQL успешно запущен`, colors.green);
    } catch (error) {
      log(`❌ Ошибка при запуске PostgreSQL: ${error.message}`, colors.red);
      return false;
    }
  }
  
  // Проверяем структуру базы данных, если PostgreSQL запущен
  if (isRunning) {
    try {
      // Проверяем наличие таблицы users
      const result = execSync(`PGHOST=${process.env.PGSOCKET} PGUSER=runner psql -d postgres -c "
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'users'
        )
      " -t`).toString().trim();
      
      if (result === 't') {
        log(`✅ Структура базы данных уже создана`, colors.green);
      } else {
        log(`🔄 Таблица users не найдена, создаем структуру базы данных...`, colors.yellow);
        
        try {
          execSync('node migrate-direct.cjs', { stdio: 'inherit' });
          log(`✅ Структура базы данных успешно создана`, colors.green);
        } catch (error) {
          log(`❌ Ошибка при создании структуры базы данных: ${error.message}`, colors.red);
          return false;
        }
      }
      
      return true;
    } catch (error) {
      log(`❌ Ошибка при проверке структуры базы данных: ${error.message}`, colors.red);
      return false;
    }
  }
  
  return isRunning;
}

/**
 * Запуск сервера приложения
 */
function startServer() {
  log(`\n${colors.blue}=== Запуск сервера приложения ===${colors.reset}`);
  log(`🚀 Запуск сервера на порту ${process.env.PORT}...`, colors.magenta);
  
  // Учитываем как dev, так и production режимы
  const isProduction = process.env.NODE_ENV === 'production';
  const command = isProduction ? 'start' : 'dev';
  log(`ℹ️ Режим: ${isProduction ? 'production' : 'development'}`, colors.blue);
  
  // Запускаем сервер через npm
  const serverProcess = spawn('npm', ['run', command], {
    stdio: 'inherit',
    env: process.env
  });
  
  // Обработка событий
  serverProcess.on('close', (code) => {
    log(`⚠️ Сервер завершил работу с кодом ${code}`, colors.yellow);
    process.exit(code);
  });
  
  serverProcess.on('error', (error) => {
    log(`❌ Ошибка при запуске сервера: ${error.message}`, colors.red);
    process.exit(1);
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
}

/**
 * Основная функция
 */
async function main() {
  // Заголовок
  log(`\n${colors.magenta}==================================${colors.reset}`);
  log(`${colors.magenta}= ЗАПУСК UNIFARM (UNIFIED MODE) =${colors.reset}`);
  log(`${colors.magenta}==================================${colors.reset}`);
  
  // Загрузка переменных окружения
  loadEnvironment();
  
  // Настройка PostgreSQL, если используется Replit
  if (process.env.DATABASE_PROVIDER === 'replit') {
    if (!await setupPostgreSQL()) {
      log(`❌ Не удалось настроить PostgreSQL. Завершение работы.`, colors.red);
      process.exit(1);
    }
  } else {
    log(`ℹ️ Используется внешняя база данных (${process.env.DATABASE_PROVIDER})`, colors.blue);
  }
  
  // Запуск сервера
  startServer();
}

// Запуск основной функции
main().catch(error => {
  log(`\n❌ Критическая ошибка: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});