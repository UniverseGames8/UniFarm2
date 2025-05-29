/**
 * Контроллер для управления миграциями данных
 * 
 * Предоставляет API для запуска и мониторинга миграций данных между 
 * разными версиями схем базы данных
 */

import { Request, Response } from 'express';
import { runFarmingMigration } from '../migrations/farmingDataMigration';

/**
 * Запускает миграцию данных фарминга из старой системы в новую
 */
export async function migrateFarmingData(req: Request, res: Response) {
  try {
    const { forceOverwrite = false, dryRun = false } = req.body;
    
    // Проверяем права администратора
    const isAdmin = req.headers['x-admin-token'] === process.env.ADMIN_API_TOKEN;
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Доступ запрещен. Необходимы права администратора.'
      });
    }
    
    console.log(`[MigrationController] Запрос на миграцию данных фарминга. forceOverwrite=${forceOverwrite}, dryRun=${dryRun}`);
    
    // Запускаем процесс миграции
    const result = await runFarmingMigration(
      Boolean(forceOverwrite),
      Boolean(dryRun)
    );
    
    return res.json({
      success: result.success,
      message: result.message,
      stats: result.stats
    });
    
  } catch (error) {
    console.error('[MigrationController] Ошибка при запуске миграции:', error);
    
    return res.status(500).json({
      success: false,
      message: `Ошибка при выполнении миграции: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}

/**
 * Проверяет текущий статус фарминга у пользователя в обеих системах
 */
export async function checkUserFarmingStatus(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    
    if (!userId || isNaN(Number(userId))) {
      return res.status(400).json({
        success: false,
        message: 'Некорректный ID пользователя'
      });
    }
    
    // Здесь будет код для проверки данных пользователя в старой и новой системах
    // Это полезно для отладки и проверки корректности миграции
    
    // Временная заглушка
    return res.json({
      success: true,
      message: 'Функция в разработке',
      userId: Number(userId)
    });
    
  } catch (error) {
    console.error('[MigrationController] Ошибка при проверке статуса фарминга:', error);
    
    return res.status(500).json({
      success: false,
      message: `Внутренняя ошибка сервера: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}