/**
 * API-маршруты для управления системой партиционирования
 */

import express, { Request, Response } from 'express';
import { partitionServiceInstance } from '../services/partitionServiceInstance';
import { manualRunPartitionCreator } from '../cron/partition-scheduler';
import { runPartitionLifecycleManagement } from '../scripts/partition_lifecycle_manager';

// Создаем маршрутизатор
const router = express.Router();

/**
 * Получить информацию о системе партиционирования
 * GET /api/admin/partitions/status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    // Проверяем, партиционирована ли таблица
    const isPartitioned = await partitionServiceInstance.isTablePartitioned();
    
    if (!isPartitioned) {
      return res.status(200).json({
        success: true,
        data: {
          isPartitioned: false,
          message: 'Таблица transactions не является партиционированной'
        }
      });
    }
    
    // Получаем список партиций
    const partitions = await partitionServiceInstance.getPartitionsList();
    
    // Получаем последние логи партиций
    const logs = await partitionServiceInstance.getPartitionLogs(10);
    
    return res.status(200).json({
      success: true,
      data: {
        isPartitioned: true,
        partitionsCount: partitions.length,
        partitions,
        recentLogs: logs
      }
    });
  } catch (error: any) {
    console.error('[PartitionAPI] Ошибка при получении статуса партиционирования:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: `Ошибка при получении статуса партиционирования: ${error.message}`
    });
  }
});

/**
 * Создать партиции на несколько дней вперед
 * POST /api/admin/partitions/create-future
 * Body: { daysAhead: number }
 */
router.post('/create-future', async (req: Request, res: Response) => {
  try {
    const { daysAhead = 7 } = req.body;
    
    // Проверяем корректность параметра
    const days = parseInt(daysAhead);
    if (isNaN(days) || days < 1 || days > 30) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Параметр daysAhead должен быть числом от 1 до 30'
      });
    }
    
    // Создаем партиции
    const result = await partitionServiceInstance.createFuturePartitions(days);
    
    return res.status(200).json({
      success: true,
      data: {
        created: result.createdCount,
        total: days + 1,
        partitions: result.partitions,
        errors: result.errors
      }
    });
  } catch (error: any) {
    console.error('[PartitionAPI] Ошибка при создании партиций:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: `Ошибка при создании партиций: ${error.message}`
    });
  }
});

/**
 * Запустить полное обслуживание партиций (традиционный метод)
 * POST /api/admin/partitions/maintenance
 */
router.post('/maintenance', async (req: Request, res: Response) => {
  try {
    // Запускаем скрипт обслуживания партиций асинхронно
    // Возвращаем немедленный ответ, так как операция может быть длительной
    manualRunPartitionCreator();
    
    return res.status(200).json({
      success: true,
      data: {
        message: 'Запущено полное обслуживание партиций. Процесс выполняется в фоновом режиме.',
        startedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('[PartitionAPI] Ошибка при запуске обслуживания партиций:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: `Ошибка при запуске обслуживания партиций: ${error.message}`
    });
  }
});

/**
 * Запустить управление жизненным циклом партиций (улучшенный метод)
 * POST /api/admin/partitions/lifecycle
 * Query: dryRun - запуск в режиме симуляции (по умолчанию false)
 */
router.post('/lifecycle', async (req: Request, res: Response) => {
  try {
    // Проверяем, запущено ли в режиме симуляции
    const dryRun = req.query.dryRun === 'true' || req.body.dryRun === true;
    
    // Запускаем процесс управления жизненным циклом партиций
    // Возвращаем результат немедленно, так как мы дожидаемся завершения
    const result = await runPartitionLifecycleManagement(dryRun);
    
    return res.status(200).json({
      success: true,
      data: {
        dryRun,
        result,
        message: `Управление жизненным циклом партиций ${dryRun ? 'выполнено в режиме симуляции' : 'успешно выполнено'}.`,
        completedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('[PartitionAPI] Ошибка при управлении жизненным циклом партиций:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: `Ошибка при управлении жизненным циклом партиций: ${error.message}`
    });
  }
});

/**
 * Получить последние логи работы с партициями
 * GET /api/admin/partitions/logs
 * Query: limit - количество записей (по умолчанию 50)
 */
router.get('/logs', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    
    // Ограничиваем максимальное количество возвращаемых логов
    const safeLimit = Math.min(limit, 200);
    
    // Получаем логи
    const logs = await partitionServiceInstance.getPartitionLogs(safeLimit);
    
    return res.status(200).json({
      success: true,
      data: {
        count: logs.length,
        logs
      }
    });
  } catch (error: any) {
    console.error('[PartitionAPI] Ошибка при получении логов партиций:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: `Ошибка при получении логов партиций: ${error.message}`
    });
  }
});

// Экспортируем маршрутизатор
export default router;

/**
 * Функция для регистрации маршрутов партиционирования в Express приложении
 * @param app Express приложение
 */
export function registerPartitionRoutes(app: express.Application) {
  app.use('/api/admin/partitions', router);
}