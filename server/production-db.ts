/**
 * ПЕРЕНАПРАВЛЕННЯ НА ЄДИНИЙ МОДУЛЬ ПІДКЛЮЧЕННЯ
 * Всі підключення тепер йдуть через single-db-connection.ts
 */

// Імпортуємо з єдиного модуля
export { 
  getSingleDbConnection as getProductionDb, 
  getSinglePool as getProductionPool,
  querySingleDb as queryProduction,
  getSingleDbConnection as db,
  getSinglePool as pool
} from './single-db-connection';