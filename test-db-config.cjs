/**
 * Скрипт для проверки конфигурации подключения к Neon DB
 */
require('dotenv').config({ path: '.env.neon' });
const fs = require('fs');
const path = require('path');

// Функция для логирования с цветами
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

function log(message, color = colors.reset) {
  console.log(color + message + colors.reset);
}

// Функция для чтения и анализа файла
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return `Ошибка при чтении файла: ${error.message}`;
  }
}

function testDBConfiguration() {
  log('='.repeat(60), colors.blue);
  log('🔍 ПРОВЕРКА КОНФИГУРАЦИИ NEON DB', colors.bright + colors.blue);
  log('='.repeat(60), colors.blue);
  
  // Проверка переменных окружения
  log('📋 Переменные окружения:', colors.blue);
  const hasDbUrl = !!process.env.DATABASE_URL;
  log(`DATABASE_URL: ${hasDbUrl ? 'Установлена ✅' : 'Не установлена ❌'}`, 
    hasDbUrl ? colors.green : colors.red);
  
  // Сохраняем dbUrl в переменной всего скрипта
  let dbUrl = '';
  let isNeonDb = false;
  let hasSslMode = false;
  let hasPooler = false;
  
  if (hasDbUrl) {
    dbUrl = process.env.DATABASE_URL;
    isNeonDb = dbUrl.includes('neon.tech');
    log(`Тип базы данных: ${isNeonDb ? 'Neon DB ✅' : 'Другая ❌'}`, 
      isNeonDb ? colors.green : colors.yellow);
    
    hasSslMode = dbUrl.includes('sslmode=require');
    log(`SSL настройка: ${hasSslMode ? 'Установлена (sslmode=require) ✅' : 'Отсутствует ❌'}`, 
      hasSslMode ? colors.green : colors.red);
    
    hasPooler = dbUrl.includes('-pooler');
    log(`Connection Pooler: ${hasPooler ? 'Включен ✅' : 'Выключен ℹ️'}`, 
      hasPooler ? colors.green : colors.yellow);
  }
  
  // Проверка настроек в db-selector-new.ts
  log('\n📝 Проверка файла db-selector-new.ts:', colors.blue);
  const selectorContent = readFile('./server/db-selector-new.ts');
  
  // Проверка настройки принудительного использования Neon DB
  const forcesNeonDb = selectorContent.includes('// Всегда используем Neon DB') || 
                       selectorContent.includes('ПРИНУДИТЕЛЬНОЕ ИСПОЛЬЗОВАНИЕ NEON DB');
  log(`Принудительное использование Neon DB: ${forcesNeonDb ? 'Да ✅' : 'Нет ❌'}`, 
    forcesNeonDb ? colors.green : colors.red);
  
  // Проверка обхода проверки USE_LOCAL_DB_ONLY
  const bypassesLocalDbCheck = !selectorContent.includes('if (enforceLocalDbOnly && provider !== \'replit\')');
  log(`Обход проверки USE_LOCAL_DB_ONLY: ${bypassesLocalDbCheck ? 'Да ✅' : 'Нет ❌'}`, 
    bypassesLocalDbCheck ? colors.green : colors.red);
  
  // Проверка настроек в db.ts
  log('\n📝 Проверка файла db.ts:', colors.blue);
  const dbContent = readFile('./server/db.ts');
  
  // Проверка настройки SSL для Neon DB
  const hasSslConfig = dbContent.includes('ssl: {') && 
                       dbContent.includes('rejectUnauthorized: false');
  log(`Настройка SSL для Neon DB: ${hasSslConfig ? 'Да ✅' : 'Нет ❌'}`, 
    hasSslConfig ? colors.green : colors.red);
  
  // Проверка игнорирования проверки isReplit
  const ignoresReplitCheck = !dbContent.includes('if (isReplit)') || 
                             dbContent.includes('// Игнорируем проверку isReplit');
  log(`Игнорирование проверки isReplit: ${ignoresReplitCheck ? 'Да ✅' : 'Нет ❌'}`, 
    ignoresReplitCheck ? colors.green : colors.red);
  
  // Проверка drizzle.config.ts
  log('\n📝 Проверка файла drizzle.config.ts:', colors.blue);
  const drizzleContent = readFile('./drizzle.config.ts');
  
  const drizzleUsesEnvVar = drizzleContent.includes('process.env.DATABASE_URL');
  log(`Использование переменной DATABASE_URL: ${drizzleUsesEnvVar ? 'Да ✅' : 'Нет ❌'}`, 
    drizzleUsesEnvVar ? colors.green : colors.red);
  
  // Статус готовности
  log('\n📊 ИТОГОВЫЙ СТАТУС:', colors.blue);
  
  const envStatus = hasDbUrl && isNeonDb;
  const codeStatus = forcesNeonDb && hasSslConfig && ignoresReplitCheck;
  
  log(`Конфигурация переменных окружения: ${envStatus ? 'Готова ✅' : 'Требует настройки ❌'}`, 
    envStatus ? colors.green : colors.red);
  
  log(`Конфигурация кода: ${codeStatus ? 'Готова ✅' : 'Требует настройки ❌'}`, 
    codeStatus ? colors.green : colors.red);
  
  if (envStatus && codeStatus) {
    log('\n🎉 СИСТЕМА ГОТОВА К ИСПОЛЬЗОВАНИЮ NEON DB!', colors.green);
    log('Проверьте работу приложения, запустив его в режиме использования Neon DB.', colors.green);
  } else {
    log('\n⚠️ ТРЕБУЕТСЯ ДОПОЛНИТЕЛЬНАЯ НАСТРОЙКА', colors.yellow);
    log('Обратите внимание на пункты, отмеченные ❌, и исправьте их.', colors.yellow);
  }
}

testDBConfiguration();