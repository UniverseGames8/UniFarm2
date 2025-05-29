/**
 * API-маршрут для запуску тестів БД-з'єднання
 * Доступен по адресу: /api/admin/db-test
 */

import { Request, Response } from 'express';
import { startTests } from '../../tests/db-connection-test';
import { TestDatabaseConnectionResult } from '../../db-adapter';

export default async function handler(req: Request, res: Response) {
  try {
    console.log('[DB Test API] Запуск тестів підключення до БД');
    
    // Запускаємо тести
    const testResults = await startTests();
    
    // Повертаємо результати як JSON
    return res.json({
      success: true,
      data: {
        message: 'Тести БД-з\'єднання виконані',
        results: testResults
      }
    });
  } catch (error) {
    console.error('[DB Test API] Помилка при запуску тестів:', error);
    
    return res.status(500).json({
      success: false,
      error: {
        message: 'Помилка при виконанні тестів БД-з\'єднання',
        details: error instanceof Error ? error.message : String(error)
      }
    });
  }
}