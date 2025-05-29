/**
 * Конфигурация для деплоя приложения в Replit
 *
 * Этот скрипт настраивает подключение к базе данных Replit
 * и устанавливает необходимые переменные окружения для production
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Функция для записи в .env.replit или создания файла
function writeToEnv(key, value) {
  const envPath = path.join(process.cwd(), '.env.replit');
  let content = '';
  
  try {
    if (fs.existsSync(envPath)) {
      content = fs.readFileSync(envPath, 'utf8');
    }
  } catch (err) {
    console.log('Создаем новый файл .env.replit');
  }

  // Проверяем, существует ли уже такая переменная
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(content)) {
    // Заменяем существующую переменную
    content = content.replace(regex, `${key}=${value}`);
  } else {
    // Добавляем новую переменную
    content += `\n${key}=${value}`;
  }

  fs.writeFileSync(envPath, content.trim());
  console.log(`[Deploy Config] Установлена переменная ${key}`);
}

// Функция для копирования переменных окружения из Secrets в .env.replit
function copyDatabaseEnvVars() {
  const dbKeys = [
    'DATABASE_URL',
    'PGDATABASE',
    'PGUSER',
    'PGHOST',
    'PGPASSWORD',
    'PGPORT'
  ];

  dbKeys.forEach(key => {
    if (process.env[key]) {
      writeToEnv(key, process.env[key]);
      console.log(`[Deploy Config] Скопирована переменная ${key}`);
    } else {
      console.warn(`[Deploy Config] Не найдена переменная ${key}`);
    }
  });
}

// Функция для создания файла .replit.production
function createReplitProductionConfig() {
  const config = `
run = "NODE_ENV=production PORT=8080 node start-unified.js"
hidden = [".config", ".git", "node_modules"]

[env]
DATABASE_PROVIDER = "replit"
NODE_ENV = "production"
PORT = "8080"

[nix]
channel = "stable-22_11"

[languages]
  [languages.javascript]
  pattern = "**/{*.js,*.jsx,*.ts,*.tsx}"

[packager]
language = "nodejs"

[packager.features]
packageSearch = true
guessImports = true
enabledForHosting = false

[unitTest]
language = "nodejs"

[deployment]
deploymentTarget = "static"
publicDir = "client/dist"
`;

  const replitProdPath = path.join(process.cwd(), '.replit.production');
  fs.writeFileSync(replitProdPath, config);
  console.log('[Deploy Config] Создан файл .replit.production');
}

// Главная функция
async function main() {
  try {
    console.log('[Deploy Config] Начало настройки деплоя...');
    
    // 1. Задаем переменные окружения
    writeToEnv('DATABASE_PROVIDER', 'replit');
    writeToEnv('NODE_ENV', 'production');
    writeToEnv('PORT', '8080');
    
    // 2. Копируем переменные базы данных
    copyDatabaseEnvVars();
    
    // 3. Создаем .replit.production
    createReplitProductionConfig();
    
    console.log('[Deploy Config] Конфигурация деплоя завершена успешно!');
  } catch (error) {
    console.error('[Deploy Config] Ошибка при настройке деплоя:', error);
    process.exit(1);
  }
}

// Вызываем основную функцию
main();