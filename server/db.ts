/**
 * ЄДИНИЙ МОДУЛЬ ПІДКЛЮЧЕННЯ ДО ПРАВИЛЬНОЇ БД
 * Перенаправляє всі запити на single-db-connection.ts
 */

// Всі підключення йдуть через єдиний модуль
export { 
  getSingleDbConnection as db,
  getSinglePool as pool,
  querySingleDb as queryDb
} from './single-db-connection';

// Експорти для зворотної сумісності
export { 
  getSingleDbConnection as getProductionDb, 
  getSinglePool as getProductionPool,
  querySingleDb as queryProduction
} from './single-db-connection';

// Функції для middleware
export async function testDatabaseConnection() {
  try {
    const { querySingleDb } = await import('./single-db-connection');
    const result = await querySingleDb('SELECT 1');
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function reconnect() {
  try {
    const { getSinglePool } = await import('./single-db-connection');
    const pool = await getSinglePool();
    return { success: true, pool };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}