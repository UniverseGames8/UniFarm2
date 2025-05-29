/**
 * Скрипт для исправления системы партиционирования
 * 
 * Этот скрипт проверяет существующие партиции и фиксирует проблемы с партиционированием,
 * создавая только недостающие партиции и правильно обрабатывая конфликты с 'transactions_future'.
 */

import { db, wrappedPool } from '../db';
import { format, addDays, subDays, parseISO } from 'date-fns';

// Функция-обертка для запросов к базе данных
async function dbQuery(text: string, params: any[] = []) {
  return await wrappedPool.query(text, params);
}

/**
 * Получить информацию о партициях
 */
async function getPartitions() {
  try {
    const query = `
      SELECT
        child.relname AS partition_name,
        pg_get_expr(child.relpartbound, child.oid) AS partition_expression
      FROM pg_inherits i
      JOIN pg_class parent ON parent.oid = i.inhparent
      JOIN pg_class child ON child.oid = i.inhrelid
      JOIN pg_namespace n ON n.oid = child.relnamespace
      WHERE parent.relname = 'transactions'
      AND n.nspname = 'public'
      ORDER BY
        child.relname;
    `;
    
    const result = await dbQuery(query, []);
    return result.rows;
  } catch (error) {
    console.error('Error getting partitions:', error);
    return [];
  }
}

/**
 * Извлекает диапазон дат из выражения партиции
 */
function extractDateRangeFromExpression(expression: string): { start: Date | null, end: Date | null } {
  try {
    // Шаблон для извлечения значений даты из выражения партиции
    const regex = /FROM \('([^']+)'\) TO \('([^']+)'\)|FROM \('([^']+)'\) TO \(MAXVALUE\)/;
    const matches = expression.match(regex);
    
    if (!matches) {
      return { start: null, end: null };
    }
    
    // Если это обычный диапазон FROM/TO
    if (matches[1] && matches[2]) {
      return {
        start: new Date(matches[1]),
        end: new Date(matches[2])
      };
    }
    
    // Если это диапазон с MAXVALUE
    if (matches[3]) {
      return {
        start: new Date(matches[3]),
        end: null // MAXVALUE
      };
    }
    
    return { start: null, end: null };
  } catch (error) {
    console.error('Error extracting date range:', error);
    return { start: null, end: null };
  }
}

/**
 * Проверяет, не перекрывается ли новая дата с существующими партициями
 */
function checkDateOverlap(date: Date, partitions: any[]): { overlaps: boolean, overlappingPartition: string | null } {
  const dateStr = format(date, 'yyyy-MM-dd');
  
  for (const partition of partitions) {
    const { start, end } = extractDateRangeFromExpression(partition.partition_expression);
    
    if (!start) continue;
    
    const startStr = format(start, 'yyyy-MM-dd');
    
    if (startStr === dateStr) {
      return { overlaps: true, overlappingPartition: partition.partition_name };
    }
    
    if (end === null) { // MAXVALUE
      if (date >= start) {
        return { overlaps: true, overlappingPartition: partition.partition_name };
      }
    } else {
      const endStr = format(end, 'yyyy-MM-dd');
      if (dateStr >= startStr && dateStr < endStr) {
        return { overlaps: true, overlappingPartition: partition.partition_name };
      }
    }
  }
  
  return { overlaps: false, overlappingPartition: null };
}

/**
 * Добавляет запись в лог операций с партициями
 */
async function logPartitionOperation(
  operationType: string,
  partitionName: string,
  status: string,
  notes?: string,
  errorMessage?: string
): Promise<boolean> {
  try {
    // Проверяем структуру таблицы
    const columnsQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'partition_logs'
    `;
    
    const columnsResult = await dbQuery(columnsQuery, []);
    const columns = columnsResult.rows.map((row: any) => row.column_name);
    
    // Используем операцию в зависимости от имени колонки
    const operationField = columns.includes('operation_type') ? 'operation_type' : 'operation';
    const errorField = columns.includes('error_message') ? 'error_message' : 
                      (columns.includes('error_details') ? 'error_details' : 'null');
    const messageField = columns.includes('message') ? ', message' : '';
    
    const sqlQuery = `
      INSERT INTO partition_logs 
      (${operationField}, partition_name, status, notes, ${errorField}${messageField}) 
      VALUES 
      ($1, $2, $3, $4, $5${messageField ? ', $6' : ''})
    `;
    
    // Сообщение для лога
    const logMessage = notes || `Operation ${operationType} for partition ${partitionName} with status ${status}`;
    
    // Параметры запроса
    const queryParams = messageField 
      ? [operationType, partitionName, status, notes, errorMessage, logMessage]
      : [operationType, partitionName, status, notes, errorMessage];
    
    await dbQuery(sqlQuery, queryParams);
    
    console.log(`[PartitionService] Logged operation: ${operationType} for ${partitionName} with status ${status}`);
    return true;
  } catch (error) {
    console.error('[PartitionService] Error logging partition operation:', error);
    return false;
  }
}

/**
 * Создать партицию для указанной даты
 */
async function createPartitionForDate(date: Date): Promise<{
  success: boolean;
  partition_name?: string;
  error?: string;
}> {
  try {
    const dateStr = format(date, 'yyyy_MM_dd');
    const partitionName = `transactions_${dateStr}`;
    
    const startDate = format(date, 'yyyy-MM-dd');
    const endDate = format(addDays(date, 1), 'yyyy-MM-dd');
    
    console.log(`[PartitionService] Creating partition ${partitionName} for date ${startDate}`);
    
    // Получаем список существующих партиций
    const partitions = await getPartitions();
    
    // Проверяем существует ли уже эта партиция
    const existingPartition = partitions.find(p => p.partition_name === partitionName);
    
    if (existingPartition) {
      console.log(`[PartitionService] Partition ${partitionName} already exists`);
      
      // Добавляем запись в логи
      await logPartitionOperation(
        'create',
        partitionName,
        'skipped',
        `Partition ${partitionName} already exists`
      );
      
      return {
        success: true,
        partition_name: partitionName
      };
    }
    
    // Проверяем на перекрытие с другими партициями
    const { overlaps, overlappingPartition } = checkDateOverlap(date, partitions);
    
    if (overlaps) {
      console.log(`[PartitionService] Cannot create partition ${partitionName}, overlaps with ${overlappingPartition}`);
      
      // Добавляем запись в логи
      await logPartitionOperation(
        'create',
        partitionName,
        'skipped',
        `Cannot create partition ${partitionName}, overlaps with ${overlappingPartition}`
      );
      
      return {
        success: false,
        error: `Partition would overlap with ${overlappingPartition}`
      };
    }
    
    // Создаем партицию
    const createPartitionQuery = `
      CREATE TABLE IF NOT EXISTS ${partitionName}
      PARTITION OF transactions
      FOR VALUES FROM ('${startDate}') TO ('${endDate}');
    `;
    
    await dbQuery(createPartitionQuery, []);
    
    // Создаем индексы для партиции
    console.log(`[PartitionService] Creating indexes for partition ${partitionName}`);
    
    await dbQuery(`CREATE INDEX IF NOT EXISTS ${partitionName}_user_id_idx ON ${partitionName} (user_id)`, []);
    await dbQuery(`CREATE INDEX IF NOT EXISTS ${partitionName}_type_idx ON ${partitionName} (type)`, []);
    await dbQuery(`CREATE INDEX IF NOT EXISTS ${partitionName}_created_at_idx ON ${partitionName} (created_at)`, []);
    
    // Добавляем запись в логи
    await logPartitionOperation(
      'create',
      partitionName,
      'success',
      `Partition ${partitionName} created successfully for date range ${startDate} to ${endDate}`
    );
    
    console.log(`[PartitionService] Partition ${partitionName} created successfully`);
    
    return {
      success: true,
      partition_name: partitionName
    };
  } catch (error: any) {
    console.error('[PartitionService] Error creating partition for date:', error);
    
    // Добавляем запись в логи об ошибке
    await logPartitionOperation(
      'create',
      `transactions_${format(date, 'yyyy_MM_dd')}`,
      'error',
      `Error creating partition: ${error.message}`,
      error.message
    );
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Создает партиции на будущие даты с учетом существующих партиций
 */
async function createFuturePartitions(daysAhead: number = 5): Promise<{
  success: boolean;
  createdCount: number;
  partitions: string[];
  errors: string[];
}> {
  const partitions: string[] = [];
  const errors: string[] = [];
  let createdCount = 0;
  
  try {
    // Получаем список существующих партиций
    const existingPartitions = await getPartitions();
    
    // Находим партицию 'transactions_future' если она существует
    const futurePartition = existingPartitions.find(p => p.partition_name === 'transactions_future');
    
    let maxDate: Date | null = null;
    
    if (futurePartition) {
      const { start } = extractDateRangeFromExpression(futurePartition.partition_expression);
      if (start) {
        // Устанавливаем максимальную дату как день перед началом future партиции
        maxDate = subDays(start, 1);
        console.log(`[PartitionService] Found future partition starting from ${format(start, 'yyyy-MM-dd')}`);
        console.log(`[PartitionService] Max date for new partitions: ${format(maxDate, 'yyyy-MM-dd')}`);
      }
    }
    
    // Создаем партиции на указанное количество дней вперед или до максимальной даты
    const today = new Date();
    
    for (let i = 0; i <= daysAhead; i++) {
      const date = addDays(today, i);
      
      // Проверяем, не превышает ли дата максимальную
      if (maxDate && date > maxDate) {
        console.log(`[PartitionService] Skipping date ${format(date, 'yyyy-MM-dd')} as it exceeds max date ${format(maxDate, 'yyyy-MM-dd')}`);
        continue;
      }
      
      const result = await createPartitionForDate(date);
      
      if (result.success) {
        if (result.partition_name) {
          partitions.push(result.partition_name);
          createdCount++;
        }
      } else if (result.error) {
        errors.push(result.error);
      }
    }
    
    return {
      success: true,
      createdCount,
      partitions,
      errors
    };
  } catch (error: any) {
    console.error('[PartitionService] Error creating future partitions:', error);
    
    return {
      success: false,
      createdCount,
      partitions,
      errors: [...errors, error.message]
    };
  }
}

/**
 * Фиксирует партицию transactions_future, если необходимо
 */
async function fixFuturePartition(): Promise<boolean> {
  try {
    // Получаем список существующих партиций
    const existingPartitions = await getPartitions();
    
    // Находим партицию 'transactions_future' если она существует
    const futurePartition = existingPartitions.find(p => p.partition_name === 'transactions_future');
    
    if (!futurePartition) {
      console.log(`[PartitionService] The partition 'transactions_future' does not exist, nothing to fix`);
      return true;
    }
    
    const { start } = extractDateRangeFromExpression(futurePartition.partition_expression);
    
    if (!start) {
      console.log(`[PartitionService] Could not determine the start date of 'transactions_future'`);
      return false;
    }
    
    const startDate = format(start, 'yyyy-MM-dd');
    console.log(`[PartitionService] The 'transactions_future' partition starts from ${startDate}`);
    
    // Получаем текущую дату
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    
    // Смотрим дату на 7 дней вперед
    const futureDate = addDays(today, 7);
    const futureDateStr = format(futureDate, 'yyyy-MM-dd');
    
    // Если текущая дата + 7 дней меньше начала future партиции, все в порядке
    if (futureDateStr < startDate) {
      console.log(`[PartitionService] The 'transactions_future' partition is properly configured (starts after ${futureDateStr})`);
      return true;
    }
    
    console.log(`[PartitionService] The 'transactions_future' partition needs adjustment`);
    
    // Вычисляем новую дату начала future партиции (текущая дата + 14 дней)
    const newFutureStart = addDays(today, 14);
    const newFutureStartStr = format(newFutureStart, 'yyyy-MM-dd');
    
    console.log(`[PartitionService] Adjusting 'transactions_future' to start from ${newFutureStartStr}`);
    
    // Удаляем текущую future партицию
    console.log(`[PartitionService] Dropping the current 'transactions_future' partition`);
    await dbQuery(`ALTER TABLE transactions DETACH PARTITION transactions_future`, []);
    await dbQuery(`DROP TABLE IF EXISTS transactions_future`, []);
    
    // Создаем новую future партицию с обновленной датой
    console.log(`[PartitionService] Creating a new 'transactions_future' partition starting from ${newFutureStartStr}`);
    await dbQuery(`
      CREATE TABLE transactions_future
      PARTITION OF transactions
      FOR VALUES FROM ('${newFutureStartStr}') TO (MAXVALUE)
    `, []);
    
    // Создаем индексы для партиции
    await dbQuery(`CREATE INDEX transactions_future_user_id_idx ON transactions_future (user_id)`, []);
    await dbQuery(`CREATE INDEX transactions_future_type_idx ON transactions_future (type)`, []);
    await dbQuery(`CREATE INDEX transactions_future_created_at_idx ON transactions_future (created_at)`, []);
    
    await logPartitionOperation(
      'adjust',
      'transactions_future',
      'success',
      `Adjusted 'transactions_future' partition to start from ${newFutureStartStr}`
    );
    
    console.log(`[PartitionService] Successfully adjusted 'transactions_future' partition`);
    return true;
  } catch (error) {
    console.error('[PartitionService] Error fixing future partition:', error);
    
    await logPartitionOperation(
      'adjust',
      'transactions_future',
      'error',
      `Error adjusting 'transactions_future' partition: ${error}`
    );
    
    return false;
  }
}

/**
 * Запускает полный процесс исправления партиционирования
 */
async function runFixPartitioning() {
  try {
    console.log('=== Starting Partitioning System Fix ===');
    
    // 1. Фиксируем партицию transactions_future, если необходимо
    const futureFixed = await fixFuturePartition();
    
    if (!futureFixed) {
      console.log('Failed to fix the future partition. Aborting.');
      return;
    }
    
    // 2. Создаем партиции на 7 дней вперед
    console.log('\n=== Creating Partitions for 7 Days Ahead ===');
    const result = await createFuturePartitions(7);
    
    console.log(`Created ${result.createdCount} new partitions out of 8 days total.`);
    console.log('Created partitions:');
    result.partitions.forEach(name => console.log(`- ${name}`));
    
    if (result.errors.length > 0) {
      console.log('Errors encountered:');
      result.errors.forEach(error => console.log(`- ${error}`));
    }
    
    console.log('\n=== Partitioning System Fix Completed ===');
  } catch (error) {
    console.error('Error during partitioning fix:', error);
  }
}

// Запуск скрипта
runFixPartitioning()
  .then(() => {
    console.log('Fix partitioning script completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fix partitioning script failed:', error);
    process.exit(1);
  });