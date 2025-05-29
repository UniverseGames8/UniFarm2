/**
 * Отладочный скрипт для модуля db-selector
 * Проверяет правильно ли выбирается база данных и почему происходят
 * автоматические переключения
 */

import 'dotenv/config';
import * as neonDB from './server/db.js';
import * as replitDB from './server/db-replit.js';

// Цвета для консоли
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// Проверяем текущие настройки
async function checkDbSettings() {
  log('🔍 Проверка настроек выбора базы данных...', colors.blue);
  
  // Проверяем переменные окружения
  log('\n📋 Текущие переменные окружения:', colors.magenta);
  log(`DATABASE_PROVIDER: ${process.env.DATABASE_PROVIDER || 'не установлено'}`, colors.reset);
  log(`USE_LOCAL_DB_ONLY: ${process.env.USE_LOCAL_DB_ONLY || 'не установлено'}`, colors.reset);
  log(`FORCE_NEON_DB: ${process.env.FORCE_NEON_DB || 'не установлено'}`, colors.reset);
  log(`DISABLE_REPLIT_DB: ${process.env.DISABLE_REPLIT_DB || 'не установлено'}`, colors.reset);
  log(`OVERRIDE_DB_PROVIDER: ${process.env.OVERRIDE_DB_PROVIDER || 'не установлено'}`, colors.reset);
  
  if (process.env.DATABASE_URL) {
    const maskedUrl = process.env.DATABASE_URL.replace(/:[^:]*@/, ':***@');
    log(`DATABASE_URL: ${maskedUrl}`, colors.reset);
    log(`URL содержит "neon": ${maskedUrl.includes('neon') ? '✅ Да' : '❌ Нет'}`, colors.reset);
    log(`URL содержит "pooler": ${maskedUrl.includes('pooler') ? '✅ Да' : '❌ Нет'}`, colors.reset);
  } else {
    log(`DATABASE_URL: не установлено`, colors.red);
  }
  
  // Проверяем наличие Replit PostgreSQL переменных
  const hasReplitPgEnv = process.env.PGHOST && process.env.PGUSER === 'runner';
  log(`\nReplit PostgreSQL переменные: ${hasReplitPgEnv ? '✅ Настроены' : '❌ Отсутствуют'}`, hasReplitPgEnv ? colors.green : colors.yellow);
  
  if (hasReplitPgEnv) {
    log(`PGHOST: ${process.env.PGHOST}`, colors.reset);
    log(`PGUSER: ${process.env.PGUSER}`, colors.reset);
    log(`PGDATABASE: ${process.env.PGDATABASE}`, colors.reset);
  }
  
  // Проверяем, какой провайдер должен быть выбран по логике db-selector
  const enforceLocalDbOnly = process.env.USE_LOCAL_DB_ONLY === 'true';
  const forceNeonDb = process.env.FORCE_NEON_DB === 'true';
  const disableReplitDb = process.env.DISABLE_REPLIT_DB === 'true';
  const overrideProvider = process.env.OVERRIDE_DB_PROVIDER;
  const defaultProvider = process.env.DATABASE_PROVIDER || 'neon';
  
  let expectedProvider = defaultProvider;
  
  // Применяем логику выбора провайдера
  if (enforceLocalDbOnly) {
    expectedProvider = 'replit';
    log(`\n⚠️ USE_LOCAL_DB_ONLY=true, принудительно используется Replit PostgreSQL`, colors.yellow);
  } else if (forceNeonDb) {
    expectedProvider = 'neon';
    log(`\n⚠️ FORCE_NEON_DB=true, принудительно используется Neon DB`, colors.yellow);
  } else if (disableReplitDb) {
    expectedProvider = 'neon';
    log(`\n⚠️ DISABLE_REPLIT_DB=true, принудительно используется Neon DB`, colors.yellow);
  } else if (overrideProvider) {
    expectedProvider = overrideProvider;
    log(`\n⚠️ OVERRIDE_DB_PROVIDER=${overrideProvider}, используется указанный провайдер`, colors.yellow);
  }
  
  log(`\n🔍 Ожидаемый провайдер базы данных: ${expectedProvider}`, colors.cyan);
  
  // Проверяем подключение к обеим базам данных
  log('\n📡 Проверка подключения к базам данных:', colors.blue);
  
  try {
    log('\n📡 Проверка подключения к Neon DB:', colors.blue);
    const neonResult = await neonDB.testDatabaseConnection();
    if (typeof neonResult === 'boolean') {
      log(`✅ Neon DB подключение: ${neonResult ? 'успешно' : 'не удалось'}`, neonResult ? colors.green : colors.red);
    } else {
      log(`✅ Neon DB подключение: ${neonResult.success ? 'успешно' : 'не удалось'}`, neonResult.success ? colors.green : colors.red);
      if (neonResult.message) {
        log(`   Сообщение: ${neonResult.message}`, colors.reset);
      }
      if (neonResult.timestamp) {
        log(`   Время сервера: ${neonResult.timestamp}`, colors.reset);
      }
    }
  } catch (error) {
    log(`❌ Ошибка при проверке подключения к Neon DB: ${error.message}`, colors.red);
  }
  
  try {
    log('\n📡 Проверка подключения к Replit PostgreSQL:', colors.blue);
    const replitResult = await replitDB.testDatabaseConnection();
    if (typeof replitResult === 'boolean') {
      log(`✅ Replit PostgreSQL подключение: ${replitResult ? 'успешно' : 'не удалось'}`, replitResult ? colors.green : colors.red);
    } else {
      log(`✅ Replit PostgreSQL подключение: ${replitResult.success ? 'успешно' : 'не удалось'}`, replitResult.success ? colors.green : colors.red);
      if (replitResult.message) {
        log(`   Сообщение: ${replitResult.message}`, colors.reset);
      }
      if (replitResult.timestamp) {
        log(`   Время сервера: ${replitResult.timestamp}`, colors.reset);
      }
    }
  } catch (error) {
    log(`❌ Ошибка при проверке подключения к Replit PostgreSQL: ${error.message}`, colors.red);
  }
  
  log('\n🏆 Итоговые рекомендации:', colors.magenta);
  
  if (expectedProvider === 'neon') {
    log('1. Для использования Neon DB убедитесь, что следующие переменные установлены в .env или .env.neon:', colors.reset);
    log('   DATABASE_PROVIDER=neon', colors.reset);
    log('   USE_LOCAL_DB_ONLY=false', colors.reset);
    log('   FORCE_NEON_DB=true', colors.reset);
    log('   DATABASE_URL=postgresql://user:password@your-neon-host.com/database', colors.reset);
  } else {
    log('1. Для использования Replit PostgreSQL убедитесь, что следующие переменные установлены в .env:', colors.reset);
    log('   DATABASE_PROVIDER=replit', colors.reset);
    log('   USE_LOCAL_DB_ONLY=true', colors.reset);
  }
  
  log('\n2. Проверьте файл server/db-selector-new.ts на наличие логики, которая может переопределять ваш выбор', colors.reset);
  log('3. Внесите изменения в код, чтобы принудительно использовать нужный провайдер, если это необходимо', colors.reset);
}

// Запускаем проверку
checkDbSettings()
  .then(() => {
    log('\n✅ Проверка завершена', colors.green);
  })
  .catch(error => {
    log(`\n❌ Непредвиденная ошибка: ${error.message}`, colors.red);
    console.error(error);
  });