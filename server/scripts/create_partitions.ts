/**
 * Скрипт для создания партиций на несколько дней вперед
 * Запускается ежедневно для создания партиций на 5 дней вперед
 */

import { partitionService } from '../services/partition-service';

/**
 * Функция для создания партиций на несколько дней вперед
 */
export async function createPartitionsJob(): Promise<any> {
  console.log('[Create Partitions] Запуск задачи создания партиций на будущие даты');
  
  try {
    // Проверяем, что таблица партиционирована
    const isPartitioned = await partitionService.isTablePartitioned();
    
    if (!isPartitioned) {
      console.error('[Create Partitions] Таблица transactions не партиционирована! Нельзя создать партиции.');
      return {
        success: false,
        error: 'Таблица transactions не партиционирована',
      };
    }
    
    // Создаем партиции на 5 дней вперед
    const daysAhead = 5;
    console.log(`[Create Partitions] Создание партиций на ${daysAhead} дней вперед`);
    
    const result = await partitionService.createFuturePartitions(daysAhead);
    
    if (result.success) {
      console.log(`[Create Partitions] Успешно создано ${result.createdCount} партиций`);
    } else {
      console.error(`[Create Partitions] Ошибка при создании партиций: ${result.errors.join(', ')}`);
    }
    
    return result;
  } catch (error: any) {
    console.error('[Create Partitions] Неожиданная ошибка при создании партиций:', error);
    
    return {
      success: false,
      error: error.message,
      stack: error.stack,
    };
  }
}

// Экспортируем функцию по умолчанию для использования в cron_scheduler
export default createPartitionsJob;

// Если скрипт запускается напрямую, выполняем создание партиций
// Используем проверку для ES модулей
import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log('[Create Partitions] Запуск скрипта напрямую');
  
  createPartitionsJob()
    .then((result) => {
      console.log('[Create Partitions] Результат выполнения:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('[Create Partitions] Критическая ошибка:', error);
      process.exit(1);
    });
}