/**
 * Менеджер жизненного цикла партиций
 * 
 * Этот скрипт реализует более щадящий подход к управлению партициями:
 * 1. Архивирование вместо удаления для старых партиций
 * 2. Многоуровневая политика хранения (активные, архивные, глубокий архив)
 * 3. Защита от случайного удаления важных данных
 * 4. Постепенный переход партиций между состояниями
 */

import { db, wrappedPool } from '../db';
import { format, subDays, parseISO, differenceInDays } from 'date-fns';

// Функция-обертка для запросов к базе данных
async function dbQuery(text: string, params: any[] = []) {
  return await wrappedPool.query(text, params);
}

// Конфигурация жизненного цикла партиций (в днях)
const PARTITION_LIFECYCLE = {
  ACTIVE: 90,     // Активные партиции: 0-90 дней
  ARCHIVE: 365,   // Архивные партиции: 91-365 дней 
  DEEP_ARCHIVE: 730,  // Глубокий архив: 366-730 дней
  DELETE_THRESHOLD: 731 // Порог для удаления: >730 дней
};

// Статусы партиций
enum PartitionStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  DEEP_ARCHIVED = 'deep_archived',
  MARKED_FOR_DELETION = 'marked_for_deletion',
  DELETED = 'deleted'
}

// Интерфейс для информации о партиции
interface PartitionInfo {
  partition_name: string;
  partition_expression: string;
  date_str?: string;
  date?: Date;
  age_days?: number;
  status?: PartitionStatus;
}

/**
 * Логирует сообщение
 */
function log(message: string) {
  console.log(`[${new Date().toISOString()}] [PartitionManager] ${message}`);
}

/**
 * Получение списка партиций с дополнительной информацией
 */
async function getDetailedPartitionsList(): Promise<PartitionInfo[]> {
  try {
    const query = `
      SELECT c.relname as partition_name, 
             pg_get_expr(c.relpartbound, c.oid) as partition_expression
      FROM pg_inherits i
      JOIN pg_class p ON p.oid = i.inhparent
      JOIN pg_class c ON c.oid = i.inhrelid
      WHERE p.relname = 'transactions'
      AND c.relname LIKE 'transactions_%'
      AND c.relname NOT IN ('transactions_default', 'transactions_future')
      ORDER BY c.relname;
    `;
    
    const result = await dbQuery(query);
    
    // Обогащаем результаты дополнительной информацией
    return result.rows.map(row => {
      const partitionInfo: PartitionInfo = {
        ...row
      };

      // Извлекаем дату из имени партиции
      const match = row.partition_name.match(/transactions_(\d{4}_\d{2}_\d{2})/);
      if (match) {
        const dateStr = match[1].replace(/_/g, '-');
        partitionInfo.date_str = dateStr;
        
        try {
          const date = parseISO(dateStr);
          partitionInfo.date = date;
          
          // Вычисляем возраст партиции в днях
          const ageDays = differenceInDays(new Date(), date);
          partitionInfo.age_days = ageDays;
          
          // Определяем статус партиции в зависимости от возраста
          if (ageDays <= PARTITION_LIFECYCLE.ACTIVE) {
            partitionInfo.status = PartitionStatus.ACTIVE;
          } else if (ageDays <= PARTITION_LIFECYCLE.ARCHIVE) {
            partitionInfo.status = PartitionStatus.ARCHIVED;
          } else if (ageDays <= PARTITION_LIFECYCLE.DEEP_ARCHIVE) {
            partitionInfo.status = PartitionStatus.DEEP_ARCHIVED;
          } else {
            partitionInfo.status = PartitionStatus.MARKED_FOR_DELETION;
          }
        } catch (error) {
          log(`Error parsing date from partition name ${row.partition_name}: ${error}`);
        }
      }
      
      return partitionInfo;
    });
  } catch (error) {
    log(`Error getting detailed partitions list: ${error}`);
    return [];
  }
}

/**
 * Проверка активности партиции - есть ли обращения к данным
 */
async function checkPartitionActivity(partitionName: string): Promise<boolean> {
  try {
    // Получаем статистику обращений к партиции
    const query = `
      SELECT relname, n_tup_upd + n_tup_del + n_tup_ins + n_tup_hot_upd as activity_count
      FROM pg_stat_user_tables
      WHERE relname = $1;
    `;
    
    const result = await dbQuery(query, [partitionName]);
    if (!result.rows.length) return false;
    
    // Если есть активность, считаем партицию активной
    return result.rows[0].activity_count > 0;
  } catch (error) {
    log(`Error checking partition activity for ${partitionName}: ${error}`);
    return false;
  }
}

/**
 * Архивирует партицию - перемещает в архивную таблицу
 */
async function archivePartition(partition: PartitionInfo, level: 'archive' | 'deep_archive'): Promise<boolean> {
  try {
    const { partition_name } = partition;
    const archiveTablePrefix = level === 'archive' ? 'archived_' : 'deep_archive_';
    const archiveTableName = `${archiveTablePrefix}${partition_name}`;
    
    log(`Archiving partition ${partition_name} to ${archiveTableName}`);
    
    // Начинаем транзакцию
    await dbQuery('BEGIN');
    
    // Создаем архивную таблицу, если она не существует
    await dbQuery(`
      CREATE TABLE IF NOT EXISTS ${archiveTableName} (
        LIKE ${partition_name} INCLUDING ALL
      )
    `);
    
    // Копируем данные из партиции в архивную таблицу
    await dbQuery(`
      INSERT INTO ${archiveTableName}
      SELECT * FROM ${partition_name}
    `);
    
    // Отключаем партицию от основной таблицы
    await dbQuery(`
      ALTER TABLE transactions DETACH PARTITION ${partition_name}
    `);
    
    // Записываем информацию об архивации в таблицу логов
    await dbQuery(`
      INSERT INTO partition_logs 
      (operation_type, partition_name, status, notes) 
      VALUES 
      ('archive', $1, 'success', $2)
    `, [partition_name, `Partition ${partition_name} archived to ${archiveTableName}`]);
    
    // Подтверждаем транзакцию
    await dbQuery('COMMIT');
    
    log(`Partition ${partition_name} successfully archived to ${archiveTableName}`);
    return true;
  } catch (error) {
    // Откатываем транзакцию в случае ошибки
    await dbQuery('ROLLBACK');
    
    log(`Error archiving partition ${partition.partition_name}: ${error}`);
    
    // Логируем ошибку в таблицу логов
    try {
      await dbQuery(`
        INSERT INTO partition_logs 
        (operation_type, partition_name, status, notes, error_message) 
        VALUES 
        ('archive', $1, 'error', $2, $3)
      `, [partition.partition_name, `Failed to archive partition ${partition.partition_name}`, error.message]);
    } catch (logError) {
      log(`Failed to log error to partition_logs: ${logError}`);
    }
    
    return false;
  }
}

/**
 * Помечает партицию на удаление
 */
async function markPartitionForDeletion(partition: PartitionInfo): Promise<boolean> {
  try {
    const { partition_name } = partition;
    
    log(`Marking partition ${partition_name} for deletion`);
    
    // Записываем информацию о пометке на удаление в таблицу логов
    await dbQuery(`
      INSERT INTO partition_logs 
      (operation_type, partition_name, status, notes) 
      VALUES 
      ('mark_for_deletion', $1, 'success', $2)
    `, [partition_name, `Partition ${partition_name} marked for deletion. Will be permanently deleted after 7 days.`]);
    
    log(`Partition ${partition_name} successfully marked for deletion`);
    return true;
  } catch (error) {
    log(`Error marking partition ${partition.partition_name} for deletion: ${error}`);
    
    // Логируем ошибку в таблицу логов
    try {
      await dbQuery(`
        INSERT INTO partition_logs 
        (operation_type, partition_name, status, notes, error_message) 
        VALUES 
        ('mark_for_deletion', $1, 'error', $2, $3)
      `, [partition.partition_name, `Failed to mark partition ${partition.partition_name} for deletion`, error.message]);
    } catch (logError) {
      log(`Failed to log error to partition_logs: ${logError}`);
    }
    
    return false;
  }
}

/**
 * Удаляет партицию, помеченную на удаление, если прошло более 7 дней
 */
async function deleteMarkedPartition(partition: PartitionInfo): Promise<boolean> {
  try {
    const { partition_name } = partition;
    
    // Проверяем, была ли партиция помечена на удаление более 7 дней назад
    const query = `
      SELECT created_at
      FROM partition_logs
      WHERE partition_name = $1
      AND operation_type = 'mark_for_deletion'
      AND status = 'success'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    
    const result = await dbQuery(query, [partition_name]);
    
    if (!result.rows.length) {
      log(`Partition ${partition_name} was not previously marked for deletion. Marking now.`);
      return await markPartitionForDeletion(partition);
    }
    
    const markedAt = result.rows[0].created_at;
    const daysMarked = differenceInDays(new Date(), new Date(markedAt));
    
    if (daysMarked < 7) {
      log(`Partition ${partition_name} was marked for deletion ${daysMarked} days ago. Waiting for 7 days before deletion.`);
      return false;
    }
    
    log(`Deleting partition ${partition_name} that was marked for deletion ${daysMarked} days ago`);
    
    // Начинаем транзакцию
    await dbQuery('BEGIN');
    
    // Удаляем архивную таблицу, если она существует
    const archiveTableName = `archived_${partition_name}`;
    const deepArchiveTableName = `deep_archive_${partition_name}`;
    
    await dbQuery(`DROP TABLE IF EXISTS ${archiveTableName}`);
    await dbQuery(`DROP TABLE IF EXISTS ${deepArchiveTableName}`);
    
    // Удаляем саму партицию, если она еще существует и подключена к основной таблице
    const checkPartitionQuery = `
      SELECT 1
      FROM pg_inherits i
      JOIN pg_class p ON p.oid = i.inhparent
      JOIN pg_class c ON c.oid = i.inhrelid
      WHERE p.relname = 'transactions'
      AND c.relname = $1
    `;
    
    const checkResult = await dbQuery(checkPartitionQuery, [partition_name]);
    
    if (checkResult.rows.length > 0) {
      // Партиция всё еще подключена к основной таблице, отключаем и удаляем
      await dbQuery(`ALTER TABLE transactions DETACH PARTITION ${partition_name}`);
    }
    
    // Проверяем существование таблицы
    const tableExistsQuery = `
      SELECT 1
      FROM pg_catalog.pg_class
      WHERE relname = $1
    `;
    
    const tableExists = await dbQuery(tableExistsQuery, [partition_name]);
    
    if (tableExists.rows.length > 0) {
      // Удаляем таблицу
      await dbQuery(`DROP TABLE IF EXISTS ${partition_name}`);
    }
    
    // Записываем информацию об удалении в таблицу логов
    await dbQuery(`
      INSERT INTO partition_logs 
      (operation_type, partition_name, status, notes) 
      VALUES 
      ('delete', $1, 'success', $2)
    `, [partition_name, `Partition ${partition_name} permanently deleted after being marked for ${daysMarked} days`]);
    
    // Подтверждаем транзакцию
    await dbQuery('COMMIT');
    
    log(`Partition ${partition_name} successfully deleted`);
    return true;
  } catch (error) {
    // Откатываем транзакцию в случае ошибки
    await dbQuery('ROLLBACK');
    
    log(`Error deleting partition ${partition.partition_name}: ${error}`);
    
    // Логируем ошибку в таблицу логов
    try {
      await dbQuery(`
        INSERT INTO partition_logs 
        (operation_type, partition_name, status, notes, error_message) 
        VALUES 
        ('delete', $1, 'error', $2, $3)
      `, [partition.partition_name, `Failed to delete partition ${partition.partition_name}`, error.message]);
    } catch (logError) {
      log(`Failed to log error to partition_logs: ${logError}`);
    }
    
    return false;
  }
}

/**
 * Выполняет управление жизненным циклом партиций
 */
async function managePartitionsLifecycle(dryRun: boolean = false): Promise<{
  success: boolean;
  processed: number;
  archiveCount: number;
  deepArchiveCount: number;
  markedForDeletionCount: number;
  deletedCount: number;
  errors: any[];
}> {
  try {
    log(`Starting partition lifecycle management. Dry run: ${dryRun}`);
    
    // Получаем список всех партиций с дополнительной информацией
    const partitions = await getDetailedPartitionsList();
    
    log(`Found ${partitions.length} partitions to process`);
    
    // Статистика операций
    let archiveCount = 0;
    let deepArchiveCount = 0;
    let markedForDeletionCount = 0;
    let deletedCount = 0;
    const errors: any[] = [];
    
    // Проходимся по всем партициям и выполняем соответствующие действия
    for (const partition of partitions) {
      if (!partition.status || !partition.age_days) {
        log(`Skipping partition ${partition.partition_name} as it has no status or age information`);
        continue;
      }
      
      const { partition_name, status, age_days } = partition;
      
      // Проверка активности для партиций, которые находятся на границе
      const isActive = age_days <= PARTITION_LIFECYCLE.ACTIVE + 10 ? 
        await checkPartitionActivity(partition_name) : false;
      
      // Если партиция активна, пропускаем ее
      if (isActive && age_days <= PARTITION_LIFECYCLE.ARCHIVE) {
        log(`Skipping partition ${partition_name} as it is still active`);
        continue;
      }
      
      // Выбираем действие в зависимости от статуса партиции
      switch (status) {
        case PartitionStatus.ACTIVE:
          if (age_days > PARTITION_LIFECYCLE.ACTIVE) {
            log(`Archiving active partition ${partition_name} (${age_days} days old)`);
            if (!dryRun) {
              const success = await archivePartition(partition, 'archive');
              if (success) archiveCount++;
              else errors.push({ partition_name, operation: 'archive', error: 'Failed to archive partition' });
            } else {
              archiveCount++;
            }
          }
          break;
          
        case PartitionStatus.ARCHIVED:
          if (age_days > PARTITION_LIFECYCLE.ARCHIVE) {
            log(`Moving to deep archive: ${partition_name} (${age_days} days old)`);
            if (!dryRun) {
              const success = await archivePartition(partition, 'deep_archive');
              if (success) deepArchiveCount++;
              else errors.push({ partition_name, operation: 'deep_archive', error: 'Failed to move to deep archive' });
            } else {
              deepArchiveCount++;
            }
          }
          break;
          
        case PartitionStatus.DEEP_ARCHIVED:
          if (age_days > PARTITION_LIFECYCLE.DEEP_ARCHIVE) {
            log(`Marking for deletion: ${partition_name} (${age_days} days old)`);
            if (!dryRun) {
              const success = await markPartitionForDeletion(partition);
              if (success) markedForDeletionCount++;
              else errors.push({ partition_name, operation: 'mark_deletion', error: 'Failed to mark for deletion' });
            } else {
              markedForDeletionCount++;
            }
          }
          break;
          
        case PartitionStatus.MARKED_FOR_DELETION:
          log(`Processing marked for deletion: ${partition_name} (${age_days} days old)`);
          if (!dryRun) {
            const success = await deleteMarkedPartition(partition);
            if (success && partition.age_days > PARTITION_LIFECYCLE.DELETE_THRESHOLD) {
              deletedCount++;
            }
          } else {
            // В режиме dry run просто подсчитываем
            if (age_days > PARTITION_LIFECYCLE.DELETE_THRESHOLD) {
              deletedCount++;
            }
          }
          break;
          
        default:
          log(`Unknown partition status for ${partition_name}: ${status}`);
      }
    }
    
    // Формируем итоговый отчет
    log(`
      Partition lifecycle management completed:
      - Archived: ${archiveCount}
      - Deep archived: ${deepArchiveCount}
      - Marked for deletion: ${markedForDeletionCount}
      - Deleted: ${deletedCount}
      - Errors: ${errors.length}
    `);
    
    return {
      success: true,
      processed: partitions.length,
      archiveCount,
      deepArchiveCount,
      markedForDeletionCount,
      deletedCount,
      errors
    };
  } catch (error) {
    log(`Error in partition lifecycle management: ${error}`);
    return {
      success: false,
      processed: 0,
      archiveCount: 0,
      deepArchiveCount: 0,
      markedForDeletionCount: 0,
      deletedCount: 0,
      errors: [{ global: true, error: error.message }]
    };
  }
}

/**
 * Запускает управление жизненным циклом партиций
 */
export async function runPartitionLifecycleManagement(dryRun: boolean = false) {
  try {
    log('Starting partition lifecycle management...');
    const result = await managePartitionsLifecycle(dryRun);
    
    if (result.success) {
      log(`Partition lifecycle management completed successfully. 
      Processed: ${result.processed}, 
      Archived: ${result.archiveCount}, 
      Deep archived: ${result.deepArchiveCount}, 
      Marked for deletion: ${result.markedForDeletionCount}, 
      Deleted: ${result.deletedCount}, 
      Errors: ${result.errors.length}`);
    } else {
      log(`Partition lifecycle management failed: ${result.errors[0]?.error}`);
    }
    
    return result;
  } catch (error) {
    log(`Critical error in partition lifecycle management: ${error}`);
    return {
      success: false,
      processed: 0,
      archiveCount: 0,
      deepArchiveCount: 0,
      markedForDeletionCount: 0,
      deletedCount: 0,
      errors: [{ global: true, error: error.message }]
    };
  }
}

// Если скрипт запускается напрямую, выполняем управление жизненным циклом
if (import.meta.url.startsWith('file:')) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  
  runPartitionLifecycleManagement(dryRun)
    .then((result) => {
      if (result.success) {
        console.log('Partition lifecycle management completed successfully');
        process.exit(0);
      } else {
        console.error(`Partition lifecycle management failed: ${result.errors[0]?.error}`);
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('Critical error:', error);
      process.exit(1);
    });
}