/**
 * СИСТЕМНИЙ ПЕРЕХОПЛЮВАЧ ПІДКЛЮЧЕНЬ ДО БД
 * Перенаправляє ВСІ підключення на правильну базу з 10 користувачами
 */

const CORRECT_DB_URL = 'postgresql://neondb_owner:npg_SpgdNBV70WKl@ep-lucky-boat-a463bggt-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';
const BLOCKED_HOST = 'ep-old-bonus-a67dnvju.us-west-2.aws.neon.tech';

// Форсуємо правильні змінні середовища
process.env.DATABASE_URL = CORRECT_DB_URL;
process.env.PGHOST = 'ep-lucky-boat-a463bggt-pooler.us-east-1.aws.neon.tech';
process.env.PGUSER = 'neondb_owner';
process.env.PGPASSWORD = 'npg_SpgdNBV70WKl';
process.env.PGDATABASE = 'neondb';
process.env.PGPORT = '5432';

console.log('🎯 [DB INTERCEPTOR] Системний перехоплювач активований');
console.log('✅ [DB INTERCEPTOR] Всі підключення перенаправлені на правильну базу');

export function interceptDatabaseConnections() {
  // Перехоплюємо всі можливі підключення
  const originalEnv = process.env;
  
  // Заморожуємо правильні значення
  Object.defineProperty(process.env, 'DATABASE_URL', {
    value: CORRECT_DB_URL,
    writable: false,
    configurable: false
  });
  
  console.log('🔒 [DB INTERCEPTOR] Змінні середовища заблоковані на правильних значеннях');
  return true;
}

// Автоматично активуємо при імпорті
interceptDatabaseConnections();