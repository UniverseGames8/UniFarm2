/**
 * Скрипт для ручного создания партиций в таблице transactions
 * 
 * Создает партиции для указанного дня или для следующих N дней,
 * что позволяет подготавливать структуру данных заранее
 */

import { pool } from '../db.js';
import { format, addDays } from 'date-fns';
import { fileURLToPath } from 'url';

// Вспомогательная функция для логирования
function log(message) {
  console.log(`[Partition Manager] ${message}`);
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

// Проверка существования партиции
async function partitionExists(partitionName) {
  try {
    const query = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      );
    `;
    const result = await executeQuery(query, [partitionName]);
    return result.rows[0].exists;
  } catch (error) {
    console.error(`Error checking if partition exists: ${error.message}`);
    return false;
  }
}

// Создание партиции для указанной даты
async function createPartitionForDate(date) {
  const dateStr = format(date, 'yyyy_MM_dd');
  const partitionName = `transactions_${dateStr}`;
  
  // Проверяем, существует ли уже партиция
  const exists = await partitionExists(partitionName);
  if (exists) {
    log(`Partition ${partitionName} already exists. Skipping.`);
    return {
      created: false,
      partitionName
    };
  }
  
  const startDate = format(date, 'yyyy-MM-dd');
  const endDate = format(addDays(date, 1), 'yyyy-MM-dd');
  
  log(`Creating partition ${partitionName} for date ${startDate}`);
  
  try {
    // Начинаем транзакцию
    await executeQuery('BEGIN');
    
    // Создаем партицию
    const query = `
      CREATE TABLE IF NOT EXISTS ${partitionName} (
        LIKE transactions INCLUDING ALL
      );
      
      ALTER TABLE ${partitionName} ADD CONSTRAINT ${partitionName}_date_check 
      CHECK (created_at >= '${startDate}'::timestamp AND created_at < '${endDate}'::timestamp);
      
      ALTER TABLE transactions ATTACH PARTITION ${partitionName}
      FOR VALUES FROM ('${startDate}') TO ('${endDate}');
    `;
    
    await executeQuery(query);
    
    // Создаем индексы для партиции
    log(`Creating indexes for partition ${partitionName}`);
    await executeQuery(`CREATE INDEX IF NOT EXISTS ${partitionName}_user_id_idx ON ${partitionName} (user_id)`);
    await executeQuery(`CREATE INDEX IF NOT EXISTS ${partitionName}_type_idx ON ${partitionName} (type)`);
    await executeQuery(`CREATE INDEX IF NOT EXISTS ${partitionName}_created_at_idx ON ${partitionName} (created_at)`);
    
    // Записываем информацию о созданной партиции в таблицу логов
    await executeQuery(`
      INSERT INTO partition_logs 
      (operation_type, partition_name, status, notes) 
      VALUES 
      ('create', $1, 'success', $2)
    `, [partitionName, `Partition created for date ${startDate}`]);
    
    // Подтверждаем транзакцию
    await executeQuery('COMMIT');
    
    log(`Partition ${partitionName} created successfully`);
    return {
      created: true,
      partitionName
    };
  } catch (error) {
    // Откатываем транзакцию в случае ошибки
    await executeQuery('ROLLBACK');
    
    // Логируем ошибку в таблицу логов
    try {
      await executeQuery(`
        INSERT INTO partition_logs 
        (operation_type, partition_name, status, notes, error_message) 
        VALUES 
        ('create', $1, 'error', $2, $3)
      `, [partitionName, `Failed to create partition for date ${startDate}`, error.message]);
    } catch (logError) {
      console.error(`Failed to log error to partition_logs: ${logError.message}`);
    }
    
    log(`Error creating partition ${partitionName}: ${error.message}`);
    return {
      created: false,
      error: error.message,
      partitionName
    };
  }
}

// Создание партиций на будущие дни
async function createFuturePartitions(days = 7) {
  const today = new Date();
  const results = [];
  
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    const result = await createPartitionForDate(date);
    results.push(result);
  }
  
  return results;
}

// Проверка таблицы transactions на партиционирование
async function checkTransactionsTable() {
  try {
    // Проверяем, существует ли таблица transactions
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions'
      );
    `;
    const tableExistsResult = await executeQuery(tableExistsQuery);
    if (!tableExistsResult.rows[0].exists) {
      log('Table transactions does not exist. Cannot create partitions.');
      return false;
    }
    
    // Проверяем, является ли таблица партиционированной
    const isPartitionedQuery = `
      SELECT EXISTS (
        SELECT FROM pg_partitioned_table pt
        JOIN pg_class pc ON pt.partrelid = pc.oid
        JOIN pg_namespace pn ON pc.relnamespace = pn.oid
        WHERE pc.relname = 'transactions'
        AND pn.nspname = 'public'
      );
    `;
    const isPartitionedResult = await executeQuery(isPartitionedQuery);
    return isPartitionedResult.rows[0].exists;
  } catch (error) {
    console.error(`Error checking transactions table: ${error.message}`);
    return false;
  }
}

// Проверка и создание таблицы partition_logs
async function checkAndCreatePartitionLogs() {
  try {
    // Проверяем, существует ли таблица partition_logs
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'partition_logs'
      );
    `;
    const tableExistsResult = await executeQuery(tableExistsQuery);
    
    if (!tableExistsResult.rows[0].exists) {
      log('Table partition_logs does not exist. Creating...');
      
      // Создаем таблицу partition_logs
      const createTableQuery = `
        CREATE TABLE partition_logs (
          id SERIAL PRIMARY KEY,
          operation_type VARCHAR(50) NOT NULL,
          partition_name VARCHAR(255) NOT NULL,
          status VARCHAR(50) NOT NULL,
          notes TEXT,
          error_message TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX partition_logs_operation_type_idx ON partition_logs (operation_type);
        CREATE INDEX partition_logs_status_idx ON partition_logs (status);
        CREATE INDEX partition_logs_created_at_idx ON partition_logs (created_at);
      `;
      
      await executeQuery(createTableQuery);
      log('Table partition_logs created successfully');
      return true;
    }
    
    return true;
  } catch (error) {
    console.error(`Error checking/creating partition_logs table: ${error.message}`);
    return false;
  }
}

// Основная функция создания партиций
export async function createPartitions(days = 7) {
  try {
    // Проверяем и создаем таблицу partition_logs, если нужно
    const logsTableReady = await checkAndCreatePartitionLogs();
    if (!logsTableReady) {
      throw new Error('Failed to create or check partition_logs table');
    }
    
    // Проверяем таблицу transactions
    const isPartitioned = await checkTransactionsTable();
    if (!isPartitioned) {
      log('Table transactions is not partitioned. Cannot create partitions.');
      return {
        success: false,
        error: 'Table transactions is not partitioned'
      };
    }
    
    // Создаем партиции на будущие дни
    const results = await createFuturePartitions(days);
    
    log(`Created partitions for ${days} days`);
    return {
      success: true,
      partitions: results
    };
  } catch (error) {
    console.error(`Error creating partitions: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  } finally {
    // Закрываем пул соединений с базой данных
    await pool.end();
  }
}

// Если скрипт запускается напрямую, создаем партиции
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Проверяем, указано ли количество дней в аргументах
  const daysArg = process.argv[2];
  const days = daysArg ? parseInt(daysArg, 10) : 7;
  
  if (isNaN(days) || days < 1) {
    console.error('Invalid number of days. Please provide a positive integer.');
    process.exit(1);
  }
  
  createPartitions(days)
    .then((result) => {
      if (result.success) {
        console.log(`Successfully created partitions for ${days} days.`);
        console.log(`Created ${result.partitions.filter(p => p.created).length} new partitions.`);
        process.exit(0);
      } else {
        console.error(`Failed to create partitions: ${result.error}`);
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('Critical error:', error);
      process.exit(1);
    });
}