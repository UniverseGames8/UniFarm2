/**
 * Контроллер для управления партициями
 * Позволяет получать информацию о партициях и логах их создания
 */

import { Request, Response } from 'express';
import { partitionService } from '../services'; // Импорт из централизованного экспорта

/**
 * Получение списка всех партиций с информацией о них
 */
export async function getPartitionsList(req: Request, res: Response) {
  try {
    const partitions = await partitionService.getPartitionsList();
    
    return res.json({
      success: true,
      data: {
        partitions
      }
    });
  } catch (error: any) {
    console.error('Error getting partitions list:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to get partitions list',
      details: error.message
    });
  }
}

/**
 * Получение логов создания партиций
 */
export async function getPartitionLogs(req: Request, res: Response) {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const logs = await partitionService.getPartitionLogs(limit);
    
    return res.json({
      success: true,
      data: {
        logs
      }
    });
  } catch (error: any) {
    console.error('Error getting partition logs:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to get partition logs',
      details: error.message
    });
  }
}

/**
 * Проверка статуса партиционирования
 */
export async function checkPartitioningStatus(req: Request, res: Response) {
  try {
    const isPartitioned = await partitionService.isTablePartitioned();
    
    return res.json({
      success: true,
      data: {
        is_partitioned: isPartitioned
      }
    });
  } catch (error: any) {
    console.error('Error checking partitioning status:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to check partitioning status',
      details: error.message
    });
  }
}

/**
 * Ручное создание партиций на будущие даты
 */
export async function createFuturePartitions(req: Request, res: Response) {
  try {
    const daysAhead = req.body.days_ahead || 5;
    
    // Проверяем, что таблица партиционирована
    const isPartitioned = await partitionService.isTablePartitioned();
    
    if (!isPartitioned) {
      return res.status(400).json({
        success: false,
        error: 'Cannot create partitions',
        message: 'Table transactions is not partitioned'
      });
    }
    
    // Создаем партиции
    const result = await partitionService.createFuturePartitions(daysAhead);
    
    return res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Error creating future partitions:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to create future partitions',
      details: error.message
    });
  }
}