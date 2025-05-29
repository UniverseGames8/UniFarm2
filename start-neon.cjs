/**
 * Скрипт запуска UniFarm с принудительным использованием Neon DB
 * 
 * Этот скрипт настраивает все необходимые переменные окружения
 * и запускает приложение с Neon DB
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

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
 * Загрузка переменных окружения для Neon DB
 */
function loadNeonEnvironment() {
  log(`\n${colors.blue}=== Загрузка переменных окружения для Neon DB ===${colors.reset}`);
  
  // Загружаем настройки из .env.neon
  const neonEnvPath = path.join(process.cwd(), '.env.neon');
  if (fs.existsSync(neonEnvPath)) {
    log(`📝 Загрузка переменных из .env.neon...`, colors.blue);
    const neonConfig = dotenv.parse(fs.readFileSync(neonEnvPath));
    
    // Применяем переменные окружения из .env.neon
    for (const key in neonConfig) {
      process.env[key] = neonConfig[key];
    }
    
    log(`✅ Переменные окружения из .env.neon успешно загружены`, colors.green);
  } else {
    log(`❌ Ошибка: Файл .env.neon не найден!`, colors.red);
    log(`⚠️ Создайте файл .env.neon с DATABASE_URL для Neon DB`, colors.yellow);
    return false;
  }
  
  // Принудительно устанавливаем настройки для Neon DB
  process.env.DATABASE_PROVIDER = 'neon';
  process.env.FORCE_NEON_DB = 'true';
  process.env.DISABLE_REPLIT_DB = 'true';
  process.env.USE_LOCAL_DB_ONLY = 'false';
  process.env.OVERRIDE_DB_PROVIDER = 'neon';
  process.env.NODE_ENV = 'production';
  
  // Проверяем наличие DATABASE_URL
  if (!process.env.DATABASE_URL) {
    log(`❌ Ошибка: DATABASE_URL не найден в .env.neon`, colors.red);
    return false;
  }
  
  // Проверяем, что URL указывает на Neon DB
  if (!process.env.DATABASE_URL.includes('neon.tech')) {
    log(`⚠️ Предупреждение: DATABASE_URL не похож на URL Neon DB`, colors.yellow);
    log(`⚠️ URL должен содержать "neon.tech"`, colors.yellow);
  }
  
  log(`✅ DATABASE_PROVIDER = ${process.env.DATABASE_PROVIDER}`, colors.green);
  log(`✅ FORCE_NEON_DB = ${process.env.FORCE_NEON_DB}`, colors.green);
  log(`✅ NODE_ENV = ${process.env.NODE_ENV}`, colors.green);
  
  return true;
}

/**
 * Запуск сервера
 */
function startServer() {
  log(`\n${colors.blue}=== Запуск сервера приложения с Neon DB ===${colors.reset}`);
  
  try {
    log(`🚀 Запуск сервера в production режиме...`, colors.magenta);
    
    // Запускаем напрямую через tsx вместо использования скомпилированной версии
    const serverProcess = spawn('tsx', ['server/index.ts'], {
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
  } catch (error) {
    log(`❌ Критическая ошибка при запуске сервера: ${error.message}`, colors.red);
    console.error(error);
    process.exit(1);
  }
}

/**
 * Основная функция
 */
function main() {
  // Заголовок
  log(`\n${colors.magenta}====================================${colors.reset}`);
  log(`${colors.magenta}= ЗАПУСК UNIFARM С NEON DB (FORCED) =${colors.reset}`);
  log(`${colors.magenta}====================================${colors.reset}`);
  
  // Загрузка переменных окружения для Neon DB
  if (!loadNeonEnvironment()) {
    log(`\n❌ Не удалось настроить окружение для Neon DB.`, colors.red);
    process.exit(1);
  }
  
  // Запуск сервера
  startServer();
}

// Запуск основной функции
main();