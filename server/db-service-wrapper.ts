/**
 * Database Service Wrapper
 * Універсальна обгортка для всіх операцій з базою даних
 * Використовує вашу правильну production базу ep-lucky-boat-a463bggt
 */

import { db, pool } from './production-db';
import type { User, InsertUser, Transaction, InsertTransaction } from '@shared/schema';

/**
 * Сервіс для роботи з базою даних
 * Всі контролери використовують цей сервіс для доступу до production бази
 */
export class DatabaseService {
  
  /**
   * Отримати з'єднання з базою даних
   */
  static async getConnection() {
    return await db;
  }

  /**
   * Отримати pool підключень
   */
  static async getPool() {
    return await pool;
  }

  /**
   * Виконати SQL запит
   */
  static async query(text: string, params: any[] = []) {
    const connection = await this.getPool();
    return await connection.query(text, params);
  }

  /**
   * Виконати транзакцію
   */
  static async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    const connection = await this.getPool();
    const client = await connection.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Перевірити підключення до бази
   */
  static async healthCheck() {
    try {
      const result = await this.query('SELECT current_database(), COUNT(*) as users FROM public.users');
      return {
        connected: true,
        database: result.rows[0].current_database,
        users: result.rows[0].users
      };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

/**
 * Обгортка для сервісних функцій для зворотної сумісності
 */
export function wrapServiceFunction<T extends any[], R>(
  serviceFunction: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await serviceFunction(...args);
    } catch (error) {
      console.error('[DB Service Wrapper] Error in service function:', error);
      throw error;
    }
  };
}

// Експортуємо для зворотної сумісності
export const dbService = DatabaseService;
export default DatabaseService;