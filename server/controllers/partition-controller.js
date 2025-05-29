/**
 * Контроллер для управления партиционированием
 * 
 * Обрабатывает API-запросы, связанные с партиционированием таблицы транзакций:
 * - Получение статуса партиционирования
 * - Получение списка партиций
 * - Создание новых партиций
 * - Получение логов партиционирования
 */

// Импорт из централизованного сервиса с поддержкой обратной совместимости
import { partitionService } from '../services/index.js';

/**
 * Получение статуса партиционирования таблицы
 */
export async function checkPartitioningStatus(req, res) {
  console.log('[PartitionController] Запрос статуса партиционирования от пользователя:', req.user?.id || 'неизвестно');
  console.log('[PartitionController] Headers:', JSON.stringify(req.headers, null, 2));
  
  try {
    console.log('[PartitionController] Начинаем проверку статуса партиционирования...');
    
    // Проверяем статус партиционирования
    const isPartitioned = await partitionService.isTablePartitioned();
    console.log('[PartitionController] Статус партиционирования получен:', isPartitioned);
    
    // Получаем статистику по партициям
    console.log('[PartitionController] Запрашиваем статистику партиций...');
    const stats = await partitionService.getPartitionStats();
    console.log('[PartitionController] Статистика партиций получена');
    
    // Формируем ответ
    console.log('[PartitionController] Формируем и отправляем успешный ответ');
    return res.status(200).json({
      success: true,
      data: {
        isPartitioned,
        stats
      }
    });
  } catch (error) {
    console.error('[PartitionController] Ошибка при получении статуса партиционирования:', error);
    console.error('[PartitionController] Stack trace:', error.stack);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Произошла ошибка при получении статуса партиционирования',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * Получение списка партиций
 */
export async function listPartitions(req, res) {
  console.log('[PartitionController] Запрос списка партиций от пользователя:', req.user?.id || 'неизвестно');
  console.log('[PartitionController] Headers:', JSON.stringify(req.headers, null, 2));
  
  try {
    console.log('[PartitionController] Начинаем запрос списка партиций...');
    
    // Получаем список всех партиций
    const partitions = await partitionService.getPartitionsList();
    console.log(`[PartitionController] Список партиций получен, количество: ${partitions.length}`);
    
    // Формируем ответ
    console.log('[PartitionController] Формируем и отправляем успешный ответ');
    return res.status(200).json({
      success: true,
      data: {
        partitions,
        total: partitions.length
      }
    });
  } catch (error) {
    console.error('[PartitionController] Ошибка при получении списка партиций:', error);
    console.error('[PartitionController] Stack trace:', error.stack);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Произошла ошибка при получении списка партиций',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * Экспортируем getPartitionsList как алиас для listPartitions
 * для соответствия именам функций в маршрутах
 */
export const getPartitionsList = listPartitions;

/**
 * Получение логов партиционирования
 */
export async function getPartitionLogs(req, res) {
  try {
    // Получаем лимит из параметров запроса или используем значение по умолчанию
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
    
    // Получаем логи партиционирования
    const logs = await partitionService.getPartitionLogs(limit);
    
    // Формируем ответ
    return res.status(200).json({
      success: true,
      data: {
        logs,
        total: logs.length
      }
    });
  } catch (error) {
    console.error('[PartitionController] Ошибка при получении логов партиционирования:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Произошла ошибка при получении логов партиционирования',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * Создание новых партиций на указанное количество дней вперед
 */
export async function createPartitions(req, res) {
  try {
    // Получаем количество дней из тела запроса или используем значение по умолчанию
    const days = req.body.days ? parseInt(req.body.days, 10) : 7;
    
    // Проверяем валидность значения
    if (days <= 0 || days > 365) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Количество дней должно быть положительным числом и не превышать 365'
      });
    }
    
    // Создаем партиции на указанное количество дней вперед
    const result = await partitionService.createFuturePartitions(days);
    
    // Формируем ответ
    return res.status(200).json({
      success: true,
      data: {
        days,
        created: result.created,
        skipped: result.skipped,
        partitions: result.partitions
      }
    });
  } catch (error) {
    console.error('[PartitionController] Ошибка при создании партиций:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Произошла ошибка при создании партиций',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * Экспортируем createFuturePartitions как алиас для createPartitions
 * для соответствия именам функций в маршрутах
 */
export const createFuturePartitions = createPartitions;

/**
 * Удаление партиции по имени
 */
export async function dropPartition(req, res) {
  try {
    // Получаем имя партиции из тела запроса
    const { partitionName } = req.body;
    
    // Проверяем наличие имени партиции
    if (!partitionName) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Не указано имя партиции для удаления'
      });
    }
    
    // Проверяем формат имени партиции для безопасности
    if (!partitionName.match(/^transactions_\d{4}_\d{2}_\d{2}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Неверный формат имени партиции. Ожидается формат: transactions_YYYY_MM_DD'
      });
    }
    
    // Проверяем существование партиции
    const exists = await partitionService.partitionExists(partitionName);
    if (!exists) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Партиция с именем ${partitionName} не найдена`
      });
    }
    
    // Удаляем партицию
    await partitionService.dropPartition(partitionName);
    
    // Формируем ответ
    return res.status(200).json({
      success: true,
      data: {
        message: `Партиция ${partitionName} успешно удалена`,
        partitionName
      }
    });
  } catch (error) {
    console.error('[PartitionController] Ошибка при удалении партиции:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Произошла ошибка при удалении партиции',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * Удаление партиции по имени (alias function для совместимости)
 */
export async function deletePartition(req, res) {
  console.log('[PartitionController] Вызов deletePartition для удаления партиции');
  try {
    // Получаем имя партиции из тела запроса
    const { partitionName } = req.body;
    
    // Проверяем наличие имени партиции
    if (!partitionName) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Не указано имя партиции для удаления'
      });
    }
    
    // Проверяем формат имени партиции для безопасности
    if (!partitionName.match(/^transactions_\d{4}_\d{2}_\d{2}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Неверный формат имени партиции. Ожидается формат: transactions_YYYY_MM_DD'
      });
    }
    
    // Проверяем существование партиции
    const exists = await partitionService.partitionExists(partitionName);
    if (!exists) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Партиция с именем ${partitionName} не найдена`
      });
    }
    
    // Удаляем партицию
    await partitionService.dropPartition(partitionName);
    
    // Формируем ответ
    return res.status(200).json({
      success: true,
      data: {
        message: `Партиция ${partitionName} успешно удалена`,
        partitionName
      }
    });
  } catch (error) {
    console.error('[PartitionController] Ошибка при удалении партиции (deletePartition):', error);
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Произошла ошибка при удалении партиции',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}