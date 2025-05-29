/**
 * Скрипт для удаления устаревших партиций таблицы transactions
 * 
 * Удаляет партиции, которые старше указанного срока (по умолчанию 60 дней)
 * и записывает информацию об удалении в таблицу partition_logs
 */

import { pool } from '../db.js';
import { format, subDays } from 'date-fns';
import { fileURLToPath } from 'url';

// Вспомогательная функция для логирования
function log(message) {
  console.log(`[PartitionCleaner] ${message}`);
}

// Функция для выполнения SQL запроса
async function executeQuery(query, params = []) {
  try {
    const result = await pool.query(query, params);
    return result;
  } catch (error) {
    console.error(`SQL Error: ${error.message}`);
    console.error(`Query: ${query}`);
    console.error(`Params: ${JSON.stringify(params)}`);
    throw error;
  }
}

// Получение списка партиций
async function getPartitionsList() {
  try {
    const query = `
      SELECT c.relname as partition_name, 
             pg_get_expr(c.relpartbound, c.oid) as partition_expression
      FROM pg_inherits i
      JOIN pg_class p ON p.oid = i.inhparent
      JOIN pg_class c ON c.oid = i.inhrelid
      WHERE p.relname = 'transactions'
      AND c.relname LIKE 'transactions_%'
      ORDER BY c.relname;
    `;
    
    const result = await executeQuery(query);
    return result.rows;
  } catch (error) {
    console.error(`Error getting partitions list: ${error.message}`);
    return [];
  }
}

// Удаление партиции
async function dropPartition(partitionName) {
  try {
    log(`Dropping partition ${partitionName}`);
    
    // Начинаем транзакцию
    await executeQuery('BEGIN');
    
    // Удаляем партицию
    await executeQuery(`DROP TABLE IF EXISTS ${partitionName}`);
    
    // Записываем информацию об удалении в таблицу логов
    await executeQuery(`
      INSERT INTO partition_logs 
      (operation_type, partition_name, status, notes) 
      VALUES 
      ('drop', $1, 'success', $2)
    `, [partitionName, `Partition ${partitionName} dropped successfully`]);
    
    // Подтверждаем транзакцию
    await executeQuery('COMMIT');
    
    log(`Partition ${partitionName} dropped successfully`);
    return true;
  } catch (error) {
    // Откатываем транзакцию в случае ошибки
    await executeQuery('ROLLBACK');
    
    // Логируем ошибку в таблицу логов
    try {
      await executeQuery(`
        INSERT INTO partition_logs 
        (operation_type, partition_name, status, notes, error_message) 
        VALUES 
        ('drop', $1, 'error', $2, $3)
      `, [partitionName, `Failed to drop partition ${partitionName}`, error.message]);
    } catch (logError) {
      console.error(`Failed to log error to partition_logs: ${logError.message}`);
    }
    
    log(`Error dropping partition ${partitionName}: ${error.message}`);
    return false;
  }
}

// Очистка старых партиций
async function clearOldPartitions(retentionDays = 60) {
  try {
    const cutoffDate = subDays(new Date(), retentionDays);
    const cutoffDateStr = format(cutoffDate, 'yyyy_MM_dd');
    
    log(`Cleaning partitions older than ${cutoffDateStr} (${retentionDays} days)`);
    
    // Получаем список всех партиций
    const partitions = await getPartitionsList();
    log(`Found ${partitions.length} partitions`);
    
    // Определяем партиции для удаления
    const partitionsToDelete = partitions
      .filter(p => {
        // Извлекаем дату из имени партиции
        const match = p.partition_name.match(/transactions_(\d{4}_\d{2}_\d{2})/);
        if (!match) return false;
        
        // Сравниваем дату партиции с датой отсечения
        const partitionDateStr = match[1];
        return partitionDateStr < cutoffDateStr;
      });
    
    if (partitionsToDelete.length === 0) {
      log('No partitions to delete');
      return {
        success: true,
        deleted: 0,
        message: 'No partitions to delete'
      };
    }
    
    log(`Found ${partitionsToDelete.length} partitions to delete`);
    
    // Удаляем найденные партиции
    const results = [];
    for (const partition of partitionsToDelete) {
      const result = await dropPartition(partition.partition_name);
      results.push({
        partition_name: partition.partition_name,
        success: result
      });
    }
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;
    
    log(`Deleted ${successCount} partitions, failed to delete ${failCount} partitions`);
    
    return {
      success: true,
      deleted: successCount,
      failed: failCount,
      results
    };
  } catch (error) {
    console.error(`Error clearing old partitions: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  } finally {
    // Закрываем пул соединений с базой данных
    await pool.end();
  }
}

// Если скрипт запускается напрямую, выполняем очистку
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Проверяем, указано ли количество дней в аргументах
  const daysArg = process.argv[2];
  const days = daysArg ? parseInt(daysArg, 10) : 60;
  
  if (isNaN(days) || days < 1) {
    console.error('Invalid retention days. Please provide a positive integer.');
    process.exit(1);
  }
  
  clearOldPartitions(days)
    .then((result) => {
      if (result.success) {
        console.log(`Successfully cleaned old partitions. Deleted ${result.deleted} partitions.`);
        process.exit(0);
      } else {
        console.error(`Failed to clean old partitions: ${result.error}`);
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('Critical error:', error);
      process.exit(1);
    });
}