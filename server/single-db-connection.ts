/**
 * ЄДИНИЙ МОДУЛЬ ПІДКЛЮЧЕННЯ ДО БД
 * 
 * Це єдине джерело підключення до правильної бази даних з 10 користувачами.
 * Всі інші модулі повинні використовувати тільки цей файл.
 */

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../shared/schema.js';

// ЄДИНА ПРАВИЛЬНА БАЗА ДАНИХ - використовуємо змінну оточення
const CORRECT_DB_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_SpgdNBV70WKl@ep-lucky-boat-a463bggt-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';

let singlePool: Pool | null = null;
let singleDb: any = null;

// Очищаємо кеш при кожному перезапуску
singlePool = null;
singleDb = null;

/**
 * Отримує єдине підключення до правильної бази даних
 */
export async function getSingleDbConnection() {
  if (!singlePool) {
    console.log('🎯 [SINGLE DB] Створюю єдине підключення до правильної бази з 10 користувачами');
    
    singlePool = new Pool({
      connectionString: CORRECT_DB_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    
    singleDb = drizzle(singlePool, { schema });
    
    // Тестуємо підключення
    try {
      const result = await singlePool.query('SELECT COUNT(*) as count FROM users');
      const userCount = parseInt(result.rows[0].count);
      console.log(`✅ [SINGLE DB] Підключення успішне! Користувачів: ${userCount}`);
    } catch (error) {
      console.error('❌ [SINGLE DB] Помилка підключення:', error);
      throw error;
    }
  }
  
  return singleDb;
}

/**
 * Отримує пул підключень
 */
export async function getSinglePool() {
  if (!singlePool) {
    await getSingleDbConnection();
  }
  return singlePool!;
}

/**
 * Виконує SQL запит через єдине підключення
 */
export async function querySingleDb(query: string, params: any[] = []) {
  const pool = await getSinglePool();
  return pool.query(query, params);
}

// Експортуємо для зворотної сумісності
export const db = getSingleDbConnection;
export const pool = getSinglePool;
export const queryDb = querySingleDb;