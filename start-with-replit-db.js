/**
 * Скрипт для запуска приложения с использованием PostgreSQL на Replit
 * 
 * Загружает .env.replit и устанавливает переменную окружения DATABASE_PROVIDER=replit,
 * предотвращая возможность переключения на Neon DB
 * 
 * ВАЖНО: Этот скрипт принудительно использует PostgreSQL на Replit,
 * установленные в .env.replit, игнорируя любые другие настройки
 */

import { spawn, spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
 * Загружает переменные окружения из .env.replit
 */
function loadEnvFromReplit() {
  const envReplitPath = path.join(__dirname, '.env.replit');
  
  if (!fs.existsSync(envReplitPath)) {
    log(`Файл .env.replit не найден по пути: ${envReplitPath}`, colors.red);
    return false;
  }
  
  log('Загрузка настроек из .env.replit...', colors.cyan);
  
  try {
    // Читаем файл напрямую
    const envContent = fs.readFileSync(envReplitPath, 'utf8');
    const envLines = envContent.split('\n');
    
    // Парсим переменные окружения
    const envConfig = {};
    
    for (const line of envLines) {
      // Пропускаем комментарии и пустые строки
      if (line.trim().startsWith('#') || !line.trim()) {
        continue;
      }
      
      // Разбиваем строку на ключ и значение
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        // Удаляем кавычки, если они есть
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        envConfig[key] = value;
      }
    }
    
    // Применяем переменные окружения из .env.replit
    for (const key in envConfig) {
      process.env[key] = envConfig[key];
    }
    
    // Принудительно устанавливаем DATABASE_PROVIDER=replit
    process.env.DATABASE_PROVIDER = 'replit';
    
    // Проверяем, что строка подключения указывает на Replit PostgreSQL
    if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('neon.tech')) {
      log('⚠️ Обнаружена строка подключения к Neon DB, заменяем на Replit PostgreSQL', colors.yellow);
      process.env.DATABASE_URL = 'postgresql://runner@localhost:5432/postgres';
      process.env.PGHOST = 'localhost';
      process.env.PGUSER = 'runner';
      process.env.PGDATABASE = 'postgres';
      process.env.PGPORT = '5432';
      process.env.PGPASSWORD = '';
    }
    
    log('Настройки из .env.replit успешно загружены', colors.green);
    return true;
  } catch (error) {
    log(`Ошибка при загрузке .env.replit: ${error.message}`, colors.red);
    return false;
  }
}

/**
 * Проверяет наличие необходимых переменных окружения
 */
function checkEnvironmentVariables() {
  log('Проверка переменных окружения PostgreSQL...', colors.cyan);
  
  const requiredVars = ['PGHOST', 'PGPORT', 'PGUSER', 'PGDATABASE', 'DATABASE_URL'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    log(`Отсутствуют необходимые переменные окружения: ${missingVars.join(', ')}`, colors.red);
    log('Для создания базы данных PostgreSQL:', colors.yellow);
    log('1. Используйте инструмент create_postgresql_database_tool в чате с ИИ', colors.yellow);
    log('2. Перезапустите терминал после создания базы данных', colors.yellow);
    return false;
  }
  
  // Проверяем, что локальные настройки указывают на Replit PostgreSQL
  if (process.env.PGHOST !== 'localhost') {
    log('❌ PGHOST не указывает на localhost. Установка принудительно на localhost', colors.red);
    process.env.PGHOST = 'localhost';
  }
  
  log('Все необходимые переменные окружения PostgreSQL настроены', colors.green);
  return true;
}

/**
 * Запуск PostgreSQL на Replit
 */
function startPostgreSQL() {
  log('\n===== Запуск PostgreSQL на Replit =====\n', colors.bright + colors.blue);
  
  try {
    log('Запуск PostgreSQL через start-postgres.sh...', colors.cyan);
    
    // Запускаем скрипт start-postgres.sh с выводом в консоль
    const postgresProcess = spawnSync('./start-postgres.sh', [], {
      stdio: 'inherit',
      shell: false
    });
    
    // Проверяем результат запуска
    if (postgresProcess.status !== 0) {
      log(`❌ Ошибка запуска PostgreSQL! Код выхода: ${postgresProcess.status}`, colors.red);
      log('Проверьте лог выше для выявления причин ошибки', colors.red);
      return false;
    }
    
    log('✅ PostgreSQL успешно запущен!', colors.green);
    return true;
  } catch (error) {
    log(`❌ Критическая ошибка при запуске PostgreSQL: ${error.message}`, colors.red);
    return false;
  }
}

/**
 * Запускает процесс сервера
 */
function startServer() {
  log('\n===== Запуск сервера с PostgreSQL на Replit =====\n', colors.bright + colors.blue);
  
  // Загружаем .env.replit
  if (!loadEnvFromReplit()) {
    log('Невозможно загрузить настройки из .env.replit', colors.red);
    return;
  }
  
  // Проверяем переменные окружения
  if (!checkEnvironmentVariables()) {
    log('Невозможно запустить сервер без корректной конфигурации PostgreSQL', colors.red);
    return;
  }
  
  // Запускаем PostgreSQL перед запуском сервера
  if (!startPostgreSQL()) {
    log('❌ Невозможно запустить сервер без запущенного PostgreSQL', colors.red);
    return;
  }
  
  // Принудительно устанавливаем переменную окружения для выбора провайдера
  process.env.DATABASE_PROVIDER = 'replit';
  process.env.USE_LOCAL_DB_ONLY = 'true';
  log('✅ Установлены переменные DATABASE_PROVIDER=replit, USE_LOCAL_DB_ONLY=true', colors.green);
  
  // Определяем команду для запуска сервера
  let serverProcess;
  const serverPath = path.join(__dirname, 'server', 'index.ts');
  
  // Показываем информацию о настройках подключения
  log('\n===== Настройки подключения к базе данных =====', colors.bright + colors.cyan);
  log(`Database URL: ${process.env.DATABASE_URL.replace(/:[^:]*@/, ':******@')}`, colors.cyan);
  log(`PGHOST: ${process.env.PGHOST}`, colors.cyan);
  log(`PGPORT: ${process.env.PGPORT}`, colors.cyan);
  log(`PGDATABASE: ${process.env.PGDATABASE}`, colors.cyan);
  log(`DATABASE_PROVIDER: ${process.env.DATABASE_PROVIDER}`, colors.cyan);
  log('==============================================\n', colors.bright + colors.cyan);
  
  try {
    // Пытаемся запустить сервер через TypeScript (tsx)
    log('Запуск сервера с использованием tsx...', colors.cyan);
    serverProcess = spawn('npx', ['tsx', serverPath], {
      stdio: 'inherit',
      env: { ...process.env }
    });
  } catch (error) {
    // Если не получилось через tsx, пробуем node
    log('Запуск через tsx не удался, пробуем node...', colors.yellow);
    serverProcess = spawn('node', [serverPath], {
      stdio: 'inherit',
      env: { ...process.env }
    });
  }
  
  // Обработка событий процесса
  serverProcess.on('error', (error) => {
    log(`Ошибка запуска сервера: ${error.message}`, colors.red);
  });
  
  serverProcess.on('close', (code) => {
    if (code !== 0) {
      log(`Сервер завершил работу с кодом: ${code}`, colors.red);
    } else {
      log('Сервер корректно завершил работу', colors.green);
    }
  });
  
  // Обработка сигналов для корректного завершения
  process.on('SIGINT', () => {
    log('\nПолучен сигнал завершения, останавливаем сервер...', colors.yellow);
    serverProcess.kill('SIGINT');
  });
  
  process.on('SIGTERM', () => {
    log('\nПолучен сигнал завершения, останавливаем сервер...', colors.yellow);
    serverProcess.kill('SIGTERM');
  });
}

// Запуск сервера
startServer();