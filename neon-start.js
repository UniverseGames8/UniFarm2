/**
 * Скрипт для запуска приложения с принудительным использованием Neon DB
 * 
 * Устанавливает все необходимые переменные окружения и запускает сервер
 * напрямую в режиме index.ts, а не из собранной версии
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

// Получаем текущую директорию
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
 * Загрузка переменных окружения из Neon DB
 */
function loadNeonEnvironment() {
  log(`\n${colors.blue}=== Загрузка переменных окружения для Neon DB ===${colors.reset}`);
  
  // Загружаем настройки из .env.neon, если он существует
  const neonEnvPath = path.join(__dirname, '.env.neon');
  if (fs.existsSync(neonEnvPath)) {
    log(`📝 Загрузка переменных из .env.neon...`, colors.blue);
    const envConfig = dotenv.parse(fs.readFileSync(neonEnvPath));
    
    // Применяем переменные окружения с заменой ${VAR}
    for (const key in envConfig) {
      let value = envConfig[key];
      
      // Обработка переменных окружения в формате ${VAR_NAME}
      if (value.includes('${') && value.includes('}')) {
        // Заменяем ${VAR_NAME} на значение переменной окружения
        value = value.replace(/\${([^}]+)}/g, (match, varName) => {
          return process.env[varName] || '';
        });
      }
      
      process.env[key] = value;
    }
    
    log(`✅ Переменные окружения из .env.neon успешно загружены`, colors.green);
  } else {
    log(`❌ Файл .env.neon не найден!`, colors.red);
    log(`⚠️ Создайте файл .env.neon с настройками подключения к Neon DB`, colors.yellow);
    return false;
  }
  
  // Принудительно устанавливаем настройки для Neon DB
  process.env.FORCE_NEON_DB = 'true';
  process.env.DATABASE_PROVIDER = 'neon';
  process.env.DISABLE_REPLIT_DB = 'true';
  process.env.USE_LOCAL_DB_ONLY = 'false';
  process.env.NODE_ENV = 'production';
  process.env.OVERRIDE_DB_PROVIDER = 'neon';
  
  // Проверяем, что у нас есть DATABASE_URL для Neon DB
  if (!process.env.DATABASE_URL) {
    log(`❌ Ошибка: Переменная DATABASE_URL не установлена!`, colors.red);
    log(`⚠️ Убедитесь, что файл .env.neon содержит переменную DATABASE_URL`, colors.yellow);
    return false;
  }
  
  // Проверяем, что DATABASE_URL указывает на Neon DB
  if (!process.env.DATABASE_URL.includes('neon.tech')) {
    log(`⚠️ Переменная DATABASE_URL не указывает на Neon DB!`, colors.yellow);
    log(`⚠️ Текущее значение: ${process.env.DATABASE_URL.replace(/:[^:]*@/, ':***@')}`, colors.yellow);
    log(`⚠️ URL должен содержать neon.tech`, colors.yellow);
    return false;
  }
  
  log(`✅ DATABASE_PROVIDER = ${process.env.DATABASE_PROVIDER}`, colors.green);
  log(`✅ FORCE_NEON_DB = ${process.env.FORCE_NEON_DB}`, colors.green);
  log(`✅ NODE_ENV = ${process.env.NODE_ENV}`, colors.green);
  log(`✅ URL содержит neon.tech, это корректный URL для Neon DB`, colors.green);
  
  return true;
}

/**
 * Запуск сервера приложения напрямую через tsx
 */
function startServer() {
  log(`\n${colors.blue}=== Запуск сервера приложения с Neon DB ===${colors.reset}`);
  log(`🚀 Запуск сервера на порту ${process.env.PORT || '3000'}...`, colors.magenta);
  
  // Запускаем сервер напрямую через tsx, минуя build
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
    log(`\n❌ Не удалось настроить окружение для Neon DB. Завершение работы.`, colors.red);
    process.exit(1);
  }
  
  // Запуск сервера
  startServer();
}

// Запуск основной функции
main();