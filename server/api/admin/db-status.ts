/**
 * API для отримання статусу підключення до бази даних
 * Дозволяє перевірити, яке з підключень зараз активне та стан пулу з'єднань
 */

import { Request, Response } from "express";
import { getConnectionManager } from "../../db-connect-unified";

/**
 * Обробник для отримання статусу підключення до бази даних
 */
export async function getDbStatus(req: Request, res: Response) {
  try {
    const connectionManager = getConnectionManager();
    const connectionInfo = connectionManager.getCurrentConnectionInfo();
    
    // Спробуємо отримати пул для оновлення інформації про з'єднання
    await connectionManager.getPool();
    
    // Отримуємо оновлену інформацію про з'єднання
    const updatedConnectionInfo = connectionManager.getCurrentConnectionInfo();
    
    // Формуємо відповідь
    const response = {
      success: true,
      data: {
        ...updatedConnectionInfo,
        env: {
          DATABASE_PROVIDER: process.env.DATABASE_PROVIDER || 'не вказано',
          USE_NEON_DB: process.env.USE_NEON_DB === 'true',
          USE_LOCAL_DB: process.env.USE_LOCAL_DB === 'true',
          ALLOW_MEMORY_FALLBACK: process.env.ALLOW_MEMORY_FALLBACK === 'true',
          FORCE_MEMORY_STORAGE: process.env.FORCE_MEMORY_STORAGE === 'true'
        },
        timestamp: new Date().toISOString()
      }
    };
    
    return res.status(200).json(response);
  } catch (error) {
    console.error('[DB Status API] Помилка при отриманні статусу БД:', error);
    return res.status(500).json({
      success: false,
      error: 'Помилка при отриманні статусу бази даних',
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Обробник для примусового перепідключення до бази даних
 */
export async function resetDbConnection(req: Request, res: Response) {
  try {
    console.log('[DB Status API] Запит на скидання підключення до бази даних');
    const connectionManager = getConnectionManager();
    
    // Зберігаємо поточну інформацію про підключення
    const oldConnectionInfo = connectionManager.getCurrentConnectionInfo();
    
    // Скидаємо підключення і пробуємо перепідключитися
    const resetResult = await connectionManager.resetConnection();
    
    // Отримуємо нову інформацію про підключення
    const newConnectionInfo = connectionManager.getCurrentConnectionInfo();
    
    // Формуємо відповідь
    const response = {
      success: true,
      data: {
        resetSuccessful: resetResult,
        oldConnection: oldConnectionInfo,
        newConnection: newConnectionInfo,
        timestamp: new Date().toISOString()
      }
    };
    
    return res.status(200).json(response);
  } catch (error) {
    console.error('[DB Status API] Помилка при скиданні підключення:', error);
    return res.status(500).json({
      success: false,
      error: 'Помилка при скиданні підключення до бази даних',
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Обробник для тестового створення таблиці
 */
export async function testCreateTable(req: Request, res: Response) {
  try {
    console.log('[DB Status API] Тестове створення таблиці...');
    const connectionManager = getConnectionManager();
    
    // Якщо ми в режимі in-memory, повертаємо успіх, але повідомляємо про це
    if (connectionManager.isInMemoryMode()) {
      return res.status(200).json({
        success: true,
        data: {
          inMemoryMode: true,
          message: 'Використовується in-memory режим, таблиці зберігаються в пам\'яті',
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // Спробуємо отримати клієнт
    const client = await connectionManager.getClient();
    if (!client) {
      return res.status(500).json({
        success: false,
        error: 'Не вдалося отримати клієнт бази даних',
      });
    }
    
    try {
      // Створюємо тестову таблицю, якщо вона не існує
      await client.query(`
        CREATE TABLE IF NOT EXISTS db_test (
          id SERIAL PRIMARY KEY,
          test_value TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Додаємо тестовий запис
      const testValue = `Test value ${new Date().toISOString()}`;
      await client.query(
        'INSERT INTO db_test (test_value) VALUES ($1) RETURNING id',
        [testValue]
      );
      
      // Отримуємо останні 5 записів
      const result = await client.query(
        'SELECT id, test_value, created_at FROM db_test ORDER BY id DESC LIMIT 5'
      );
      
      return res.status(200).json({
        success: true,
        data: {
          message: 'Тестова таблиця успішно створена і запис додано',
          records: result.rows,
          timestamp: new Date().toISOString()
        }
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[DB Status API] Помилка при тестуванні створення таблиці:', error);
    return res.status(500).json({
      success: false,
      error: 'Помилка при тестовому створенні таблиці',
      message: error instanceof Error ? error.message : String(error)
    });
  }
}