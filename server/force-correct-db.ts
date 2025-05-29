/**
 * КРИТИЧНИЙ МОДУЛЬ - ФОРСУВАННЯ ПРАВИЛЬНОЇ БАЗИ ДАНИХ
 * 
 * Цей модуль примусово встановлює правильні налаштування бази даних,
 * ігноруючи будь-які змінні середовища Replit, які можуть перевизначати з'єднання
 */

// ПРАВИЛЬНА БАЗА ДАНИХ - 13 користувачів
const CORRECT_DATABASE_CONFIG = {
  host: 'ep-lucky-boat-a463bggt-pooler.us-east-1.aws.neon.tech',
  user: 'neondb_owner',
  password: 'npg_SpgdNBV70WKl',
  database: 'neondb',
  port: 5432,
  ssl: { rejectUnauthorized: false }
};

const CORRECT_DATABASE_URL = 'postgresql://neondb_owner:npg_SpgdNBV70WKl@ep-lucky-boat-a463bggt-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';

/**
 * Примусово встановлює правильні змінні бази даних
 */
export function forceCorrectDatabaseConfig() {
  console.log('[FORCE-DB] 🎯 ФОРСУВАННЯ ПРАВИЛЬНОЇ БАЗИ ДАНИХ');
  console.log('[FORCE-DB] Було DATABASE_URL:', process.env.DATABASE_URL);
  console.log('[FORCE-DB] Було PGHOST:', process.env.PGHOST);
  
  // Примусово встановлюємо правильні налаштування
  process.env.DATABASE_URL = CORRECT_DATABASE_URL;
  process.env.PGHOST = CORRECT_DATABASE_CONFIG.host;
  process.env.PGUSER = CORRECT_DATABASE_CONFIG.user;
  process.env.PGPASSWORD = CORRECT_DATABASE_CONFIG.password;
  process.env.PGDATABASE = CORRECT_DATABASE_CONFIG.database;
  process.env.PGPORT = CORRECT_DATABASE_CONFIG.port.toString();
  process.env.PGSSLMODE = 'require';
  
  console.log('[FORCE-DB] ✅ Встановлено DATABASE_URL:', process.env.DATABASE_URL);
  console.log('[FORCE-DB] ✅ Встановлено PGHOST:', process.env.PGHOST);
  console.log('[FORCE-DB] 🎯 База даних примусово перенаправлена на правильну');
}

/**
 * Отримує правильні налаштування бази даних
 */
export function getCorrectDatabaseConfig() {
  return CORRECT_DATABASE_CONFIG;
}

/**
 * Отримує правильний URL бази даних
 */
export function getCorrectDatabaseUrl() {
  return CORRECT_DATABASE_URL;
}

// Автоматично викликаємо при імпорті
forceCorrectDatabaseConfig();