#!/usr/bin/env node
/**
 * Скрипт для проверки статуса PostgreSQL на Replit
 * 
 * Проверяет:
 * 1. Установлены ли нужные переменные окружения
 * 2. Запущен ли сервер PostgreSQL
 * 3. Доступен ли сокет для соединения
 * 4. Возможность подключиться к базе данных
 * 5. Версию PostgreSQL
 * 
 * Использование: node check-replit-postgres.mjs
 */

import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI цвета для вывода в консоль
const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';

// Функция для вывода сообщения с цветом
function log(message, color = RESET) {
  console.log(`${color}${message}${RESET}`);
}

// Функция для проверки наличия необходимых переменных окружения
function checkEnvironmentVariables() {
  log('\n[1] Проверка переменных окружения...', BLUE);
  
  // Загружаем .env.replit, если он существует
  const envReplitPath = path.join(__dirname, '.env.replit');
  if (fs.existsSync(envReplitPath)) {
    log(`Найден файл .env.replit`, GREEN);
    
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
      
      // Проверяем наличие всех необходимых переменных
      const requiredVars = ['DATABASE_URL', 'PGHOST', 'PGPORT', 'PGUSER', 'PGDATABASE'];
      const missingVars = [];
      
      for (const varName of requiredVars) {
        if (!envConfig[varName]) {
          missingVars.push(varName);
        }
      }
      
      if (missingVars.length === 0) {
        log('✅ Все необходимые переменные окружения найдены в .env.replit', GREEN);
        
        // Выводим значения переменных
        log('\nНайдены следующие переменные:', CYAN);
        log(`DATABASE_URL: ${envConfig.DATABASE_URL}`, CYAN);
        log(`PGHOST: ${envConfig.PGHOST}`, CYAN);
        log(`PGPORT: ${envConfig.PGPORT}`, CYAN);
        log(`PGUSER: ${envConfig.PGUSER}`, CYAN);
        log(`PGDATABASE: ${envConfig.PGDATABASE}`, CYAN);
        
        // Проверяем DATABASE_PROVIDER
        if (envConfig.DATABASE_PROVIDER === 'replit') {
          log('✅ DATABASE_PROVIDER=replit', GREEN);
        } else {
          log(`⚠️ DATABASE_PROVIDER=${envConfig.DATABASE_PROVIDER || 'не установлен'}`, YELLOW);
          log('   Рекомендуется установить DATABASE_PROVIDER=replit', YELLOW);
        }
        
        // Проверяем USE_LOCAL_DB_ONLY
        if (envConfig.USE_LOCAL_DB_ONLY === 'true') {
          log('✅ USE_LOCAL_DB_ONLY=true', GREEN);
        } else {
          log(`⚠️ USE_LOCAL_DB_ONLY=${envConfig.USE_LOCAL_DB_ONLY || 'не установлен'}`, YELLOW);
          log('   Рекомендуется установить USE_LOCAL_DB_ONLY=true для предотвращения случайного использования Neon DB', YELLOW);
        }
        
      } else {
        log(`❌ Отсутствуют необходимые переменные окружения в .env.replit: ${missingVars.join(', ')}`, RED);
        return false;
      }
    } catch (error) {
      log(`❌ Ошибка при чтении .env.replit: ${error.message}`, RED);
      return false;
    }
  } else {
    log(`❌ Файл .env.replit не найден`, RED);
    log('   Создайте файл .env.replit с необходимыми переменными окружения', YELLOW);
    return false;
  }
  
  return true;
}

// Функция для проверки статуса PostgreSQL
async function checkPostgresqlStatus() {
  log('\n[2] Проверка статуса PostgreSQL...', BLUE);
  
  try {
    // Проверяем, запущен ли PostgreSQL
    const pgStatus = execSync('pg_ctl status 2>&1').toString();
    
    if (pgStatus.includes('server is running')) {
      log('✅ PostgreSQL сервер запущен', GREEN);
      
      // Получаем PID сервера из вывода pg_ctl status
      const pidMatch = pgStatus.match(/PID: (\d+)/);
      if (pidMatch && pidMatch[1]) {
        log(`   PID сервера: ${pidMatch[1]}`, CYAN);
      }
      
      // Проверяем расположение сокета
      const socketDirPath = path.join(process.env.HOME, '.postgresql', 'sockets');
      const socketPath = path.join(socketDirPath, '.s.PGSQL.5432');
      
      if (fs.existsSync(socketPath)) {
        log(`✅ Сокет PostgreSQL найден: ${socketPath}`, GREEN);
      } else {
        log(`❌ Сокет PostgreSQL не найден по пути: ${socketPath}`, RED);
        log('   Проверьте параметры запуска в start-postgres.sh', YELLOW);
        return false;
      }
      
      return true;
    } else {
      log('❌ PostgreSQL сервер не запущен', RED);
      log('   Запустите PostgreSQL с помощью команды: ./start-postgres.sh', YELLOW);
      return false;
    }
  } catch (error) {
    log(`❌ Ошибка при проверке статуса PostgreSQL: ${error.message}`, RED);
    log('   Возможно, PostgreSQL не установлен или не настроен правильно', YELLOW);
    return false;
  }
}

// Функция для проверки подключения к базе данных
async function testDatabaseConnection() {
  log('\n[3] Проверка подключения к базе данных...', BLUE);
  
  const socketDirPath = path.join(process.env.HOME, '.postgresql', 'sockets');
  
  try {
    // Выполняем простой запрос к базе данных
    const result = execSync(`PGHOST=${socketDirPath} psql -d postgres -c "SELECT version();" 2>&1`).toString();
    
    if (result.includes('PostgreSQL')) {
      const versionMatch = result.match(/PostgreSQL\s+(\d+\.\d+)/);
      const version = versionMatch ? versionMatch[1] : 'неизвестно';
      
      log(`✅ Успешное подключение к базе данных PostgreSQL ${version}`, GREEN);
      log('   Вывод запроса:', CYAN);
      log(`${result}`, CYAN);
      
      return true;
    } else {
      log('❌ Не удалось получить версию PostgreSQL', RED);
      log('   Вывод запроса:', CYAN);
      log(`${result}`, CYAN);
      return false;
    }
  } catch (error) {
    log(`❌ Ошибка при подключении к базе данных: ${error.message}`, RED);
    
    // Проверяем, существует ли база данных postgres
    try {
      const databases = execSync(`PGHOST=${socketDirPath} psql -l 2>&1`).toString();
      
      if (databases.includes('postgres')) {
        log('ℹ️ База данных postgres существует, но подключение не удалось', YELLOW);
      } else {
        log('❌ База данных postgres не существует', RED);
        log('   Попробуйте создать базу данных: PGHOST=${socketDirPath} createdb postgres', YELLOW);
      }
    } catch (err) {
      log(`❌ Не удалось получить список баз данных: ${err.message}`, RED);
    }
    
    return false;
  }
}

// Функция для проверки таблиц в базе данных
async function checkDatabaseTables() {
  log('\n[4] Проверка таблиц в базе данных...', BLUE);
  
  const socketDirPath = path.join(process.env.HOME, '.postgresql', 'sockets');
  
  try {
    // Получаем список таблиц
    const result = execSync(`PGHOST=${socketDirPath} psql -d postgres -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public';" 2>&1`).toString();
    
    // Разбиваем вывод на строки и фильтруем пустые строки
    const lines = result.split('\n').filter(line => line.trim());
    
    // Удаляем строки с заголовками и разделителями
    const tableLines = lines.slice(2, -1);
    
    if (tableLines.length > 0) {
      log(`✅ В базе данных найдено ${tableLines.length} таблиц:`, GREEN);
      tableLines.forEach(line => {
        log(`   - ${line.trim()}`, CYAN);
      });
    } else {
      log('ℹ️ В базе данных нет таблиц', YELLOW);
      log('   Выполните миграцию схемы: npx drizzle-kit push:pg', YELLOW);
    }
    
    return true;
  } catch (error) {
    log(`❌ Ошибка при проверке таблиц: ${error.message}`, RED);
    return false;
  }
}

// Функция для проверки настройки Drizzle
function checkDrizzleSetup() {
  log('\n[5] Проверка настройки Drizzle...', BLUE);
  
  // Проверяем наличие конфигурации Drizzle
  const drizzleConfigPath = path.join(__dirname, 'drizzle.config.ts');
  
  if (fs.existsSync(drizzleConfigPath)) {
    log('✅ Файл конфигурации Drizzle найден', GREEN);
    
    // Читаем содержимое файла конфигурации
    const drizzleConfig = fs.readFileSync(drizzleConfigPath, 'utf8');
    
    if (drizzleConfig.includes('dialect: "postgresql"')) {
      log('✅ Настройка диалекта PostgreSQL в конфигурации Drizzle', GREEN);
    } else {
      log('❌ Диалект PostgreSQL не настроен в конфигурации Drizzle', RED);
    }
    
    // Проверяем наличие схемы Drizzle
    const schemaPath = path.join(__dirname, 'shared', 'schema.ts');
    
    if (fs.existsSync(schemaPath)) {
      log('✅ Файл схемы Drizzle найден', GREEN);
      
      // Читаем содержимое файла схемы
      const schema = fs.readFileSync(schemaPath, 'utf8');
      
      // Проверяем наличие определений таблиц
      const tableDefinitions = schema.match(/export const \w+ = pgTable/g);
      
      if (tableDefinitions && tableDefinitions.length > 0) {
        log(`✅ Определено ${tableDefinitions.length} таблиц в схеме Drizzle`, GREEN);
      } else {
        log('❌ Не найдены определения таблиц в схеме Drizzle', RED);
      }
    } else {
      log('❌ Файл схемы Drizzle не найден', RED);
    }
  } else {
    log('❌ Файл конфигурации Drizzle не найден', RED);
    log('   Создайте файл drizzle.config.ts с настройками для PostgreSQL', YELLOW);
  }
  
  return true;
}

// Главная функция для проверки всех компонентов
async function main() {
  log('=== Проверка настройки PostgreSQL на Replit ===', BLUE);
  
  // Проверяем все компоненты
  const envCheck = checkEnvironmentVariables();
  const pgStatusCheck = await checkPostgresqlStatus();
  
  // Если PostgreSQL не запущен, пытаемся запустить его
  if (!pgStatusCheck) {
    log('\nПытаемся запустить PostgreSQL...', YELLOW);
    
    try {
      execSync('./start-postgres.sh', { stdio: 'inherit' });
      log('\nПроверяем статус PostgreSQL после запуска...', YELLOW);
      await checkPostgresqlStatus();
    } catch (error) {
      log(`❌ Не удалось запустить PostgreSQL: ${error.message}`, RED);
    }
  }
  
  // Продолжаем проверки
  const dbConnectionCheck = await testDatabaseConnection();
  
  if (dbConnectionCheck) {
    await checkDatabaseTables();
  }
  
  checkDrizzleSetup();
  
  log('\n=== Итоги проверки ===', BLUE);
  
  if (envCheck && pgStatusCheck && dbConnectionCheck) {
    log('✅ PostgreSQL на Replit настроен и работает корректно', GREEN);
    log('   Все проверки пройдены успешно!', GREEN);
  } else {
    log('⚠️ Обнаружены проблемы в настройке PostgreSQL на Replit', YELLOW);
    log('   Рекомендуется исправить указанные выше проблемы', YELLOW);
  }
}

// Запускаем главную функцию
main().catch(error => {
  log(`❌ Необработанная ошибка: ${error.message}`, RED);
  process.exit(1);
});