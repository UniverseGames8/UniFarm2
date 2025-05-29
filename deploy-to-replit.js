/**
 * Скрипт для подготовки и деплоя приложения на Replit
 * Выполняет необходимые шаги для обеспечения корректной работы в production
 */

const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Цвета для вывода в консоль
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
  step: (msg) => console.log(`${colors.magenta}[STEP]${colors.reset} ${msg}`),
};

// Шаг 1: Проверка наличия необходимых файлов
async function checkRequiredFiles() {
  log.step('Шаг 1: Проверка наличия необходимых файлов');
  
  const requiredFiles = [
    'production-server.js',
    'static-loading.html',
    'start-unified.js',
    '.replit.production'
  ];
  
  const missingFiles = [];
  
  for (const file of requiredFiles) {
    if (!fs.existsSync(path.join(__dirname, file))) {
      missingFiles.push(file);
    }
  }
  
  if (missingFiles.length > 0) {
    log.error(`Не найдены следующие файлы: ${missingFiles.join(', ')}`);
    return false;
  }
  
  log.success('Все необходимые файлы найдены');
  return true;
}

// Шаг 2: Копирование .replit.production в .replit
async function prepareReplitConfig() {
  log.step('Шаг 2: Подготовка конфигурации Replit');
  
  try {
    const source = path.join(__dirname, '.replit.production');
    const destination = path.join(__dirname, '.replit');
    
    fs.copyFileSync(source, destination);
    log.success('Файл .replit.production успешно скопирован в .replit');
    return true;
  } catch (error) {
    log.error(`Ошибка при копировании файла конфигурации: ${error.message}`);
    return false;
  }
}

// Шаг 3: Проверка подключения к базе данных
async function checkDatabaseConnection() {
  log.step('Шаг 3: Проверка подключения к базе данных');
  
  try {
    if (!process.env.DATABASE_URL) {
      log.warning('Переменная окружения DATABASE_URL не найдена');
      return false;
    }
    
    // Тестовый запрос к базе данных
    const { pg } = require('pg');
    const client = new pg.Client({
      connectionString: process.env.DATABASE_URL,
    });
    
    await client.connect();
    const result = await client.query('SELECT NOW()');
    await client.end();
    
    log.success(`Подключение к базе данных успешно: ${result.rows[0].now}`);
    return true;
  } catch (error) {
    log.error(`Ошибка при подключении к базе данных: ${error.message}`);
    return false;
  }
}

// Шаг 4: Проверка наличия Telegram Bot Token
async function checkTelegramBotToken() {
  log.step('Шаг 4: Проверка наличия Telegram Bot Token');
  
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    log.warning('Переменная окружения TELEGRAM_BOT_TOKEN не найдена');
    return false;
  }
  
  log.success('Telegram Bot Token найден');
  return true;
}

// Шаг 5: Подготовка приложения к деплою
async function prepareForDeployment() {
  log.step('Шаг 5: Подготовка приложения к деплою');
  
  try {
    // Создаем директории, если они не существуют
    const dirs = ['dist', 'dist/public'];
    for (const dir of dirs) {
      const dirPath = path.join(__dirname, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        log.info(`Создана директория: ${dir}`);
      }
    }
    
    // Проверяем, были ли созданы все необходимые директории
    const allDirsExist = dirs.every(dir => fs.existsSync(path.join(__dirname, dir)));
    
    if (allDirsExist) {
      log.success('Приложение готово к деплою');
      return true;
    } else {
      log.error('Не удалось создать необходимые директории');
      return false;
    }
  } catch (error) {
    log.error(`Ошибка при подготовке к деплою: ${error.message}`);
    return false;
  }
}

// Шаг 6: Информирование о следующих шагах
function showNextSteps() {
  log.step('Шаг 6: Дальнейшие действия');
  
  console.log(`
${colors.yellow}Для деплоя приложения на Replit:${colors.reset}

1. Создайте новый репозиторий на Replit, выбрав шаблон Node.js
2. Скопируйте все файлы из текущего проекта в новый репозиторий
3. На панели слева щелкните по кнопке "☰" и выберите "Secrets"
4. Добавьте следующие секреты:
   - DATABASE_URL - URL для подключения к PostgreSQL
   - TELEGRAM_BOT_TOKEN - токен вашего Telegram бота

5. Нажмите на кнопку "Run" в верхней части экрана
6. После успешного запуска нажмите на кнопку "Deploy" для публикации

${colors.yellow}Для проверки развернутого приложения:${colors.reset}
Запустите: node open-deployed-app.js
  `);
}

// Главная функция
async function main() {
  console.log(`
${colors.green}╔════════════════════════════════════════════╗
║  Подготовка и деплой приложения на Replit   ║
╚════════════════════════════════════════════╝${colors.reset}
  `);
  
  // Запуск всех шагов последовательно
  const filesOk = await checkRequiredFiles();
  if (!filesOk) {
    log.error('Проверка файлов не пройдена, деплой невозможен');
    return;
  }
  
  const configOk = await prepareReplitConfig();
  if (!configOk) {
    log.warning('Не удалось подготовить конфигурацию Replit, но можно продолжить');
  }
  
  // Следующие шаги являются информационными, не блокируют процесс
  await checkDatabaseConnection().catch(() => log.warning('Проверка базы данных пропущена'));
  await checkTelegramBotToken().catch(() => log.warning('Проверка токена бота пропущена'));
  
  const prepOk = await prepareForDeployment();
  if (!prepOk) {
    log.warning('Не удалось полностью подготовить приложение, могут возникнуть проблемы при деплое');
  }
  
  showNextSteps();
  
  console.log(`
${colors.green}╔════════════════════════════════════════════╗
║           Подготовка завершена!            ║
╚════════════════════════════════════════════╝${colors.reset}
  `);
}

// Запуск скрипта
main().catch((error) => {
  log.error(`Неожиданная ошибка: ${error.message}`);
  process.exit(1);
});