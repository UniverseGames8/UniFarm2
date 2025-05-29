/**
 * Сервис для управления партиционированием таблицы transactions
 * 
 * Предоставляет методы для:
 * 1. Проверки статуса партиционирования
 * 2. Получения списка партиций
 * 3. Создания новых партиций
 * 4. Очистки старых партиций
 */

import { db, pool } from '../db.js';
import { partition_logs } from '@shared/schema';

/**
 * Логирует операцию с партицией в таблицу partition_logs
 */
export function log(message) {
  console.log(`[PartitionService] ${message}`);
  
  try {
    const logEntry = {
      operation: 'INFO',
      message,
      timestamp: new Date(),
      status: 'success'
    };
    
    // Асинхронно сохраняем в базу данных, не дожидаясь результата
    db.insert(partition_logs).values(logEntry).execute();
  } catch (error) {
    console.error('[PartitionService] Ошибка при логировании:', error);
  }
}

/**
 * Выполняет SQL-запрос напрямую через пул соединений
 */
export async function executeQuery(query, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(query, params);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Проверяет, является ли таблица партиционированной
 */
export async function isTablePartitioned(tableName = 'transactions') {
  try {
    const query = `
      SELECT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_inherits i ON i.inhparent = c.oid
        WHERE c.relname = $1
      ) as is_partitioned;
    `;
    
    const result = await executeQuery(query, [tableName]);
    return result[0]?.is_partitioned || false;
  } catch (error) {
    console.error('[PartitionService] Ошибка при проверке партиционирования:', error);
    throw error;
  }
}

/**
 * Получает список всех партиций для указанной таблицы
 */
export async function getPartitionsList(tableName = 'transactions') {
  try {
    const query = `
      SELECT c.relname as partition_name, 
             pg_size_pretty(pg_total_relation_size(c.oid)) as size,
             pg_total_relation_size(c.oid) as size_bytes,
             (SELECT COUNT(*) FROM ${tableName} WHERE tableoid = c.oid) as rows_count,
             obj_description(c.oid, 'pg_class') as comment
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_inherits i ON i.inhrelid = c.oid
      JOIN pg_catalog.pg_class parent ON parent.oid = i.inhparent
      WHERE parent.relname = $1
      ORDER BY c.relname;
    `;
    
    const partitions = await executeQuery(query, [tableName]);
    
    // Добавляем дополнительную информацию к каждой партиции
    for (const partition of partitions) {
      // Извлекаем дату из имени партиции (например, из transactions_2023_01_01)
      const dateParts = partition.partition_name.replace(`${tableName}_`, '').split('_');
      if (dateParts.length === 3) {
        const year = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]) - 1; // Месяцы в JS начинаются с 0
        const day = parseInt(dateParts[2]);
        
        if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
          const partitionDate = new Date(year, month, day);
          partition.date = partitionDate.toISOString().split('T')[0];
          
          const now = new Date();
          const diffTime = Math.abs(now - partitionDate);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
          
          partition.days_ago = diffDays;
          partition.is_future = partitionDate > now;
        }
      }
    }
    
    return partitions;
  } catch (error) {
    console.error('[PartitionService] Ошибка при получении списка партиций:', error);
    throw error;
  }
}

/**
 * Получает логи операций с партициями
 */
export async function getPartitionLogs(limit = 50) {
  try {
    const query = `
      SELECT * FROM partition_logs
      ORDER BY timestamp DESC
      LIMIT $1;
    `;
    
    return await executeQuery(query, [limit]);
  } catch (error) {
    console.error('[PartitionService] Ошибка при получении логов партиционирования:', error);
    throw error;
  }
}

/**
 * Проверяет существование партиции по имени
 */
export async function partitionExists(partitionName) {
  try {
    const query = `
      SELECT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class
        WHERE relname = $1
      ) as exists;
    `;
    
    const result = await executeQuery(query, [partitionName]);
    return result[0]?.exists || false;
  } catch (error) {
    console.error(`[PartitionService] Ошибка при проверке существования партиции ${partitionName}:`, error);
    throw error;
  }
}

/**
 * Создает партицию для конкретной даты
 */
export async function createPartitionForDate(date, tableName = 'transactions') {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  const partitionName = `${tableName}_${year}_${month}_${day}`;
  
  try {
    // Проверяем, существует ли уже такая партиция
    const exists = await partitionExists(partitionName);
    if (exists) {
      log(`Партиция ${partitionName} уже существует, пропускаем создание`);
      return { created: false, partitionName };
    }
    
    // Формируем диапазон дат для партиции
    const startDate = `${year}-${month}-${day}`;
    
    // Устанавливаем конечную дату как следующий день
    const nextDate = new Date(date);
    nextDate.setDate(date.getDate() + 1);
    const nextYear = nextDate.getFullYear();
    const nextMonth = String(nextDate.getMonth() + 1).padStart(2, '0');
    const nextDay = String(nextDate.getDate()).padStart(2, '0');
    const endDate = `${nextYear}-${nextMonth}-${nextDay}`;
    
    // Создаем партицию
    const createQuery = `
      CREATE TABLE IF NOT EXISTS ${partitionName} PARTITION OF ${tableName}
      FOR VALUES FROM ('${startDate}') TO ('${endDate}');
    `;
    
    await executeQuery(createQuery);
    
    // Добавляем комментарий к партиции для лучшей идентификации
    const commentQuery = `
      COMMENT ON TABLE ${partitionName} IS 'Partition for ${startDate}';
    `;
    await executeQuery(commentQuery);
    
    log(`Успешно создана партиция ${partitionName} для даты ${startDate}`);
    
    // Логируем операцию создания партиции
    const logEntry = {
      operation: 'CREATE',
      partition_name: partitionName,
      message: `Создана партиция для даты ${startDate}`,
      timestamp: new Date(),
      status: 'success'
    };
    
    await db.insert(partition_logs).values(logEntry).execute();
    
    return { created: true, partitionName };
  } catch (error) {
    console.error(`[PartitionService] Ошибка при создании партиции ${partitionName}:`, error);
    
    // Логируем ошибку в таблицу логов
    try {
      const logEntry = {
        operation: 'CREATE',
        partition_name: partitionName,
        message: `Ошибка при создании партиции: ${error.message}`,
        timestamp: new Date(),
        status: 'error',
        error_details: error.stack
      };
      
      await db.insert(partition_logs).values(logEntry).execute();
    } catch (logError) {
      console.error('[PartitionService] Ошибка при логировании ошибки:', logError);
    }
    
    throw error;
  }
}

/**
 * Создает партиции на несколько дней вперед
 */
export async function createFuturePartitions(days = 7, tableName = 'transactions') {
  const result = {
    created: 0,
    skipped: 0,
    partitions: []
  };
  
  try {
    const now = new Date();
    
    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(now.getDate() + i);
      
      const { created, partitionName } = await createPartitionForDate(date, tableName);
      
      if (created) {
        result.created++;
      } else {
        result.skipped++;
      }
      
      result.partitions.push(partitionName);
    }
    
    log(`Создание будущих партиций завершено: создано ${result.created}, пропущено ${result.skipped}`);
    return result;
  } catch (error) {
    console.error('[PartitionService] Ошибка при создании будущих партиций:', error);
    throw error;
  }
}

/**
 * Удаляет партицию по имени
 */
export async function dropPartition(partitionName, tableName = 'transactions') {
  try {
    // Проверяем, существует ли партиция
    const exists = await partitionExists(partitionName);
    if (!exists) {
      log(`Партиция ${partitionName} не существует, пропускаем удаление`);
      return false;
    }
    
    // Дополнительная проверка формата имени для безопасности
    if (!partitionName.match(new RegExp(`^${tableName}_\\d{4}_\\d{2}_\\d{2}$`))) {
      throw new Error(`Некорректное имя партиции: ${partitionName}`);
    }
    
    // Удаляем партицию
    const dropQuery = `DROP TABLE IF EXISTS ${partitionName};`;
    await executeQuery(dropQuery);
    
    log(`Успешно удалена партиция ${partitionName}`);
    
    // Логируем операцию удаления партиции
    const logEntry = {
      operation: 'DROP',
      partition_name: partitionName,
      message: `Удалена партиция ${partitionName}`,
      timestamp: new Date(),
      status: 'success'
    };
    
    await db.insert(partition_logs).values(logEntry).execute();
    
    return true;
  } catch (error) {
    console.error(`[PartitionService] Ошибка при удалении партиции ${partitionName}:`, error);
    
    // Логируем ошибку в таблицу логов
    try {
      const logEntry = {
        operation: 'DROP',
        partition_name: partitionName,
        message: `Ошибка при удалении партиции: ${error.message}`,
        timestamp: new Date(),
        status: 'error',
        error_details: error.stack
      };
      
      await db.insert(partition_logs).values(logEntry).execute();
    } catch (logError) {
      console.error('[PartitionService] Ошибка при логировании ошибки:', logError);
    }
    
    throw error;
  }
}

/**
 * Получает статистику о партициях
 */
export async function getPartitionStats(tableName = 'transactions') {
  try {
    const partitions = await getPartitionsList(tableName);
    
    // Считаем статистику
    const totalPartitions = partitions.length;
    const totalSize = partitions.reduce((sum, p) => sum + parseInt(p.size_bytes || 0), 0);
    const pastPartitions = partitions.filter(p => !p.is_future && p.days_ago !== undefined).length;
    const futurePartitions = partitions.filter(p => p.is_future).length;
    const todayPartition = partitions.find(p => p.days_ago === 0);
    const oldestPartition = [...partitions].sort((a, b) => b.days_ago - a.days_ago)[0];
    const newestPartition = [...partitions].filter(p => p.is_future).sort((a, b) => a.days_ago - b.days_ago)[0];
    
    // Получаем таблицу transaction
    const mainTableQuery = `
      SELECT pg_size_pretty(pg_total_relation_size($1)) as size,
             pg_total_relation_size($1) as size_bytes,
             (SELECT COUNT(*) FROM ${tableName}) as rows_count
      FROM pg_catalog.pg_class
      WHERE relname = $1;
    `;
    
    const mainTableResult = await executeQuery(mainTableQuery, [tableName]);
    const mainTable = mainTableResult[0] || { size: '0 bytes', size_bytes: 0, rows_count: 0 };
    
    return {
      tableName,
      totalPartitions,
      mainTableSize: mainTable.size,
      totalPartitionsSize: formatBytes(totalSize),
      totalRows: parseInt(mainTable.rows_count || 0),
      pastPartitions,
      futurePartitions,
      todayPartition: todayPartition ? {
        name: todayPartition.partition_name,
        size: todayPartition.size,
        rows: parseInt(todayPartition.rows_count || 0)
      } : null,
      oldestPartition: oldestPartition ? {
        name: oldestPartition.partition_name,
        daysAgo: oldestPartition.days_ago,
        date: oldestPartition.date
      } : null,
      newestPartition: newestPartition ? {
        name: newestPartition.partition_name,
        daysAhead: newestPartition.days_ago,
        date: newestPartition.date
      } : null
    };
  } catch (error) {
    console.error('[PartitionService] Ошибка при получении статистики партиций:', error);
    throw error;
  }
}

/**
 * Вспомогательная функция для форматирования размера в байтах
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}