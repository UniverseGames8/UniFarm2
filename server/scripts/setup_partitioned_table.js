/**
 * Скрипт для создания партиционированной таблицы transactions_partitioned
 * и переноса данных из существующей таблицы transactions
 * 
 * Этот скрипт выполняет более безопасную миграцию, сначала создавая новую
 * партиционированную таблицу, затем копируя данные, и только после успешного
 * копирования переименовывает таблицы
 */

import { pool } from '../db.js';
import { format, addDays } from 'date-fns';
import { fileURLToPath } from 'url';

// Вспомогательная функция для логирования
function log(message) {
  console.log(`[PartitionSetup] ${message}`);
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

// Проверка существования таблицы
async function tableExists(tableName) {
  try {
    const query = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      );
    `;
    const result = await executeQuery(query, [tableName]);
    return result.rows[0].exists;
  } catch (error) {
    console.error(`Error checking if table exists: ${error.message}`);
    return false;
  }
}

// Создание партиции для указанной даты
async function createPartitionForDate(date, parentTable = 'transactions_partitioned') {
  const dateStr = format(date, 'yyyy_MM_dd');
  const partitionName = `${parentTable}_${dateStr}`;
  
  const startDate = format(date, 'yyyy-MM-dd');
  const endDate = format(addDays(date, 1), 'yyyy-MM-dd');
  
  log(`Creating partition ${partitionName} for date ${startDate}`);
  
  // Создаем партицию
  const query = `
    CREATE TABLE IF NOT EXISTS ${partitionName} PARTITION OF ${parentTable}
    FOR VALUES FROM ('${startDate}') TO ('${endDate}');
  `;
  
  await executeQuery(query);
  
  // Создаем индексы для партиции
  log(`Creating indexes for partition ${partitionName}`);
  await executeQuery(`CREATE INDEX IF NOT EXISTS ${partitionName}_user_id_idx ON ${partitionName} (user_id)`);
  await executeQuery(`CREATE INDEX IF NOT EXISTS ${partitionName}_type_idx ON ${partitionName} (type)`);
  await executeQuery(`CREATE INDEX IF NOT EXISTS ${partitionName}_created_at_idx ON ${partitionName} (created_at)`);
  
  log(`Partition ${partitionName} created successfully`);
  return {
    created: true,
    partitionName
  };
}

// Создание партиций на будущие дни
async function createFuturePartitions(days = 7, parentTable = 'transactions_partitioned') {
  const today = new Date();
  const results = [];
  
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    const result = await createPartitionForDate(date, parentTable);
    results.push(result);
  }
  
  // Создаем партицию для очень старых записей
  const pastPartitionName = `${parentTable}_old`;
  const today_str = format(today, 'yyyy-MM-dd');
  
  log(`Creating partition ${pastPartitionName} for dates before ${today_str}`);
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS ${pastPartitionName} PARTITION OF ${parentTable}
    FOR VALUES FROM (MINVALUE) TO ('${today_str}');
  `);
  
  // Индексы для старых записей
  await executeQuery(`CREATE INDEX IF NOT EXISTS ${pastPartitionName}_user_id_idx ON ${pastPartitionName} (user_id)`);
  await executeQuery(`CREATE INDEX IF NOT EXISTS ${pastPartitionName}_type_idx ON ${pastPartitionName} (type)`);
  await executeQuery(`CREATE INDEX IF NOT EXISTS ${pastPartitionName}_created_at_idx ON ${pastPartitionName} (created_at)`);
  
  log(`Old data partition ${pastPartitionName} created successfully`);
  
  // Создаем дефолтную партицию для будущих записей
  const futurePartitionName = `${parentTable}_future`;
  const futureDate = format(addDays(today, days), 'yyyy-MM-dd');
  
  log(`Creating default partition ${futurePartitionName} for dates after ${futureDate}`);
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS ${futurePartitionName} PARTITION OF ${parentTable}
    FOR VALUES FROM ('${futureDate}') TO (MAXVALUE);
  `);
  
  // Индексы для будущих записей
  await executeQuery(`CREATE INDEX IF NOT EXISTS ${futurePartitionName}_user_id_idx ON ${futurePartitionName} (user_id)`);
  await executeQuery(`CREATE INDEX IF NOT EXISTS ${futurePartitionName}_type_idx ON ${futurePartitionName} (type)`);
  await executeQuery(`CREATE INDEX IF NOT EXISTS ${futurePartitionName}_created_at_idx ON ${futurePartitionName} (created_at)`);
  
  log(`Future data partition ${futurePartitionName} created successfully`);
  
  return results;
}

// Основная функция миграции
async function setupPartitionedTable() {
  try {
    log('Starting setup of partitioned transactions table');
    
    // Проверяем, существует ли таблица transactions
    const transactionsExists = await tableExists('transactions');
    if (!transactionsExists) {
      throw new Error('Table transactions does not exist. Cannot proceed with migration.');
    }
    
    // Проверка существования таблицы partition_logs
    const logsTableExists = await tableExists('partition_logs');
    if (!logsTableExists) {
      log('Creating partition_logs table');
      await executeQuery(`
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
      `);
      log('Table partition_logs created successfully');
    }
    
    // Начинаем транзакцию
    await executeQuery('BEGIN');
    
    try {
      // Получаем текущий максимальный ID
      const maxIdResult = await executeQuery('SELECT MAX(id) FROM transactions');
      const maxId = maxIdResult.rows[0].max || 0;
      log(`Current max transaction ID: ${maxId}`);
      
      // Создаем новую партиционированную таблицу
      log('Creating new partitioned transactions_partitioned table');
      await executeQuery(`
        CREATE TABLE transactions_partitioned (
          id SERIAL,
          user_id INTEGER NOT NULL,
          amount DECIMAL(18, 9) NOT NULL,
          type TEXT NOT NULL,
          currency TEXT,
          status TEXT,
          source TEXT,
          category TEXT,
          tx_hash TEXT,
          description TEXT,
          source_user_id INTEGER,
          data TEXT,
          wallet_address TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          PRIMARY KEY (id, created_at)
        ) PARTITION BY RANGE (created_at)
      `);
      
      // Создаем партиции на текущий день и будущие дни
      log('Creating partitions for current and future dates');
      await createFuturePartitions(7, 'transactions_partitioned');
      
      // Копируем данные из старой таблицы в новую
      log('Copying data from transactions to partitioned table');
      await executeQuery(`
        INSERT INTO transactions_partitioned 
        (id, user_id, amount, type, currency, status, source, category, tx_hash, 
         description, source_user_id, data, wallet_address, created_at)
        SELECT id, user_id, amount, type, currency, status, source, category, tx_hash, 
               description, source_user_id, data, wallet_address, created_at
        FROM transactions
      `);
      
      // Сбрасываем последовательность ID
      log('Resetting transactions_partitioned_id_seq');
      await executeQuery(`SELECT setval('transactions_partitioned_id_seq', ${maxId}, true)`);
      
      // Переименовываем таблицы
      log('Renaming tables');
      await executeQuery('ALTER TABLE transactions RENAME TO transactions_old');
      await executeQuery('ALTER TABLE transactions_partitioned RENAME TO transactions');
      
      // Записываем информацию о миграции в таблицу логов
      await executeQuery(`
        INSERT INTO partition_logs 
        (operation_type, partition_name, status, notes) 
        VALUES 
        ('setup', 'transactions', 'success', 'Partitioned table setup completed successfully')
      `);
      
      // Подтверждаем транзакцию
      await executeQuery('COMMIT');
      
      log('Partitioned table setup completed successfully');
      return {
        success: true,
        message: 'Partitioned table setup completed successfully'
      };
    } catch (error) {
      // Откатываем транзакцию в случае ошибки
      await executeQuery('ROLLBACK');
      
      // Логируем ошибку в таблицу логов, если таблица существует
      if (logsTableExists) {
        try {
          await executeQuery(`
            INSERT INTO partition_logs 
            (operation_type, partition_name, status, notes, error_message) 
            VALUES 
            ('setup', 'transactions', 'error', 'Failed to setup partitioned table', $1)
          `, [error.message]);
        } catch (logError) {
          console.error(`Failed to log error to partition_logs: ${logError.message}`);
        }
      }
      
      throw error;
    }
  } catch (error) {
    console.error(`Error setting up partitioned table: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  } finally {
    // Закрываем пул соединений с базой данных
    await pool.end();
  }
}

// Если скрипт запускается напрямую, выполняем миграцию
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  setupPartitionedTable()
    .then((result) => {
      if (result.success) {
        console.log('Successfully set up partitioned table.');
        process.exit(0);
      } else {
        console.error(`Failed to set up partitioned table: ${result.error}`);
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('Critical error:', error);
      process.exit(1);
    });
}