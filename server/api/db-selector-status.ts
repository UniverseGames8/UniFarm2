import { Request, Response } from 'express';
import { testDatabaseConnection, dbType, DatabaseType } from '../db-selector';

/**
 * Получает информацию о текущем подключении к базе данных
 * Показывает, какой тип базы данных используется (Replit или Neon)
 * и результат проверки соединения.
 */
export async function getDatabaseStatus(req: Request, res: Response) {
  try {
    // Получаем текущие переменные окружения (без секретных значений)
    const dbEnvInfo = {
      DB_TYPE: process.env.DB_TYPE || 'не указан',
      DATABASE_URL: process.env.DATABASE_URL ? 
        (process.env.DATABASE_URL.includes('neon.tech') ? 
          'neon.tech connection string (masked)' : 
          'replit connection string (masked)') : 
        'не указан'
    };

    // Проверяем соединение с базой данных
    const connectionTest = await testDatabaseConnection();
    
    // Формируем ответ
    return res.status(200).json({
      success: true,
      data: {
        dbType,
        dbTypeName: dbType === DatabaseType.NEON ? 'NEON' : 'REPLIT',
        connectionTest,
        dbEnvInfo,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[API] Ошибка при получении статуса базы данных:', error);
    return res.status(500).json({
      success: false,
      error: 'Ошибка при получении статуса базы данных',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}