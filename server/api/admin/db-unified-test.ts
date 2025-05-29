/**
 * API-маршрут для тестирования обновленной системы подключения к базе данных
 * Доступен по адресу: /api/admin/db-unified-test
 */

import { Request, Response } from 'express';
import { pool, db, testConnection, reconnect, getMonitorStats, dbMonitor, dbType } from '../../db-connect-unified';

export default async function handler(req: Request, res: Response) {
  try {
    // Начинаем тестирование
    const results: {
      dbType: string;
      connectionTest: boolean;
      query: {
        success: boolean;
        currentTime?: any;
        error?: string;
      } | null;
      stats: any;
    } = {
      dbType,
      connectionTest: false,
      query: null,
      stats: null
    };
    
    // 1. Проверка соединения
    results.connectionTest = await testConnection();
    
    if (!results.connectionTest) {
      // Если не удалось подключиться, пробуем переподключиться
      await reconnect();
      // Проверяем снова
      results.connectionTest = await testConnection();
    }
    
    if (results.connectionTest) {
      try {
        // 2. Выполняем запрос
        const client = await pool.connect();
        try {
          const result = await client.query('SELECT NOW() as current_time');
          results.query = {
            success: true,
            currentTime: result.rows[0].current_time
          };
        } finally {
          client.release();
        }
      } catch (queryError) {
        results.query = {
          success: false,
          error: queryError instanceof Error ? queryError.message : String(queryError)
        };
      }
    }
    
    // 3. Получаем статистику мониторинга
    results.stats = dbMonitor.getStats();
    
    // Возвращаем результаты
    res.json({
      success: true,
      message: 'Тест обновленного подключения к БД завершен',
      data: results
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[DB Unified Test] Ошибка:', errorMessage);
    
    res.status(500).json({
      success: false,
      message: 'Ошибка при выполнении теста подключения к БД',
      error: errorMessage
    });
  }
}