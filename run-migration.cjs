/**
 * Запуск миграции партиционирования для Neon DB (CommonJS)
 */

const { Pool } = require('@neondatabase/serverless');
const dotenv = require('dotenv');
const { format, addDays } = require('date-fns');
const ws = require('ws');

// Загружаем переменные окружения
dotenv.config();

// Проверяем переменную окружения DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.error('❌ Отсутствует переменная окружения DATABASE_URL');
  process.exit(1);
}

// Настраиваем подключение к БД
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: true,
});

// Логирование
function log(message) {
  console.log(`[Migration] ${message}`);
}

/**
 * Выполнение SQL запроса
 */
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

/**
 * Создание партиции для указанной даты
 */
async function createPartitionForDate(date) {
  const dateStr = format(date, 'yyyy_MM_dd');
  const partitionName = `transactions_${dateStr}`;
  
  const startDate = format(date, 'yyyy-MM-dd');
  const endDate = format(addDays(date, 1), 'yyyy-MM-dd');
  
  log(`Creating partition ${partitionName} for date ${startDate}`);
  
  const query = `
    CREATE TABLE IF NOT EXISTS ${partitionName}
    PARTITION OF transactions
    FOR VALUES FROM ('${startDate}') TO ('${endDate}');
  `;
  
  await executeQuery(query);
  
  // Создаем индексы для партиции
  log(`Creating indexes for partition ${partitionName}`);
  try {
    await executeQuery(`CREATE INDEX IF NOT EXISTS ${partitionName}_user_id_idx ON ${partitionName} (user_id)`);
  } catch (err) {
    log(`Warning: Could not create index on user_id - ${err.message}`);
  }

  try {
    await executeQuery(`CREATE INDEX IF NOT EXISTS ${partitionName}_type_idx ON ${partitionName} (type)`);
  } catch (err) {
    log(`Warning: Could not create index on type - ${err.message}`);
  }

  try {
    await executeQuery(`CREATE INDEX IF NOT EXISTS ${partitionName}_created_at_idx ON ${partitionName} (created_at)`);
  } catch (err) {
    log(`Warning: Could not create index on created_at - ${err.message}`);
  }
  
  log(`Partition ${partitionName} created successfully`);
}

/**
 * Проверка, является ли таблица партиционированной
 */
async function isTablePartitioned(tableName = 'transactions') {
  try {
    const query = `
      SELECT pt.relname as parent_table, 
             c.relname as child_table,
             pg_get_expr(c.relpartbound, c.oid) as partition_expression
      FROM pg_inherits i
      JOIN pg_class pt ON pt.oid = i.inhparent
      JOIN pg_class c ON c.oid = i.inhrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE pt.relname = $1 
      AND n.nspname = 'public'
      LIMIT 1;
    `;
    
    const result = await pool.query(query, [tableName]);
    return (result.rowCount || 0) > 0;
  } catch (error) {
    console.error('Error checking if table is partitioned:', error);
    return false;
  }
}

/**
 * Основная функция миграции
 */
async function runMigration() {
  try {
    log('Starting migration: Converting transactions table to partitioned table');
    
    // Проверяем, существует ли таблица transactions
    const tableExistsResult = await executeQuery(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transactions')"
    );
    
    const tableExists = tableExistsResult.rows[0].exists;
    if (!tableExists) {
      log('Table transactions does not exist. Cannot proceed with migration.');
      return;
    }
    
    // Проверяем, является ли таблица уже партиционированной
    const isPartitioned = await isTablePartitioned();
    if (isPartitioned) {
      log('Table transactions is already partitioned. Skipping migration.');
      return;
    }
    
    // Начинаем транзакцию
    await executeQuery('BEGIN');
    
    try {
      log('Creating temporary table for transactions data');
      await executeQuery(`
        CREATE TABLE transactions_temp (
          id SERIAL PRIMARY KEY,
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
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      
      log('Copying data from transactions to temporary table');
      await executeQuery(`
        INSERT INTO transactions_temp 
        (id, user_id, amount, type, currency, status, source, category, tx_hash, 
         description, source_user_id, data, wallet_address, created_at)
        SELECT id, user_id, amount, type, currency, status, source, category, tx_hash, 
               description, source_user_id, data, wallet_address, created_at
        FROM transactions
      `);
      
      // Получаем текущий max id для сброса sequence
      const maxIdResult = await executeQuery('SELECT MAX(id) FROM transactions');
      const maxId = maxIdResult.rows[0].max || 0;
      
      log(`Current max transaction ID: ${maxId}`);
      
      log('Dropping old transactions table');
      await executeQuery('DROP TABLE transactions');
      
      log('Creating new partitioned transactions table');
      await executeQuery(`
        CREATE TABLE transactions (
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
      
      // Создаем партиции на текущий день и 5 дней вперед
      const today = new Date();
      for (let i = 0; i < 5; i++) {
        const date = addDays(today, i);
        await createPartitionForDate(date);
      }
      
      log('Copying data back from temporary table to partitioned table');
      await executeQuery(`
        INSERT INTO transactions 
        (id, user_id, amount, type, currency, status, source, category, tx_hash, 
         description, source_user_id, data, wallet_address, created_at)
        SELECT id, user_id, amount, type, currency, status, source, category, tx_hash, 
               description, source_user_id, data, wallet_address, created_at
        FROM transactions_temp
      `);
      
      log('Resetting transactions_id_seq');
      await executeQuery(`SELECT setval('transactions_id_seq', ${maxId}, true)`);
      
      log('Dropping temporary table');
      await executeQuery('DROP TABLE transactions_temp');
      
      // Создаем партиции для более старых данных, если они есть
      log('Creating partitions for older data if needed');
      const oldestDateResult = await executeQuery(`
        SELECT DATE_TRUNC('day', MIN(created_at)) as oldest_date
        FROM transactions
      `);
      
      const oldestDate = oldestDateResult.rows[0].oldest_date;
      if (oldestDate && oldestDate < today) {
        log(`Oldest transaction date: ${oldestDate}`);
        
        // Создаем партицию для всех старых записей
        const oldestDateStr = format(new Date(oldestDate), 'yyyy_MM_dd');
        const oldPartitionName = `transactions_old_before_${oldestDateStr}`;
        
        log(`Creating partition ${oldPartitionName} for all older data`);
        await executeQuery(`
          CREATE TABLE IF NOT EXISTS ${oldPartitionName}
          PARTITION OF transactions
          FOR VALUES FROM (MINVALUE) TO ('${format(today, 'yyyy-MM-dd')}');
        `);
        
        // Создаем индексы для старой партиции
        log(`Creating indexes for partition ${oldPartitionName}`);
        try {
          await executeQuery(`CREATE INDEX IF NOT EXISTS ${oldPartitionName}_user_id_idx ON ${oldPartitionName} (user_id)`);
        } catch (err) {
          log(`Warning: Could not create index on user_id - ${err.message}`);
        }

        try {
          await executeQuery(`CREATE INDEX IF NOT EXISTS ${oldPartitionName}_type_idx ON ${oldPartitionName} (type)`);
        } catch (err) {
          log(`Warning: Could not create index on type - ${err.message}`);
        }

        try {
          await executeQuery(`CREATE INDEX IF NOT EXISTS ${oldPartitionName}_created_at_idx ON ${oldPartitionName} (created_at)`);
        } catch (err) {
          log(`Warning: Could not create index on created_at - ${err.message}`);
        }
      }
      
      // Создаем партицию для будущих записей
      log('Creating default partition for future data');
      const futurePartitionName = 'transactions_future';
      await executeQuery(`
        CREATE TABLE IF NOT EXISTS ${futurePartitionName}
        PARTITION OF transactions
        FOR VALUES FROM ('${format(addDays(today, 5), 'yyyy-MM-dd')}') TO (MAXVALUE);
      `);
      
      // Создаем индексы для будущей партиции
      log(`Creating indexes for future partition ${futurePartitionName}`);
      try {
        await executeQuery(`CREATE INDEX IF NOT EXISTS ${futurePartitionName}_user_id_idx ON ${futurePartitionName} (user_id)`);
      } catch (err) {
        log(`Warning: Could not create index on user_id - ${err.message}`);
      }

      try {
        await executeQuery(`CREATE INDEX IF NOT EXISTS ${futurePartitionName}_type_idx ON ${futurePartitionName} (type)`);
      } catch (err) {
        log(`Warning: Could not create index on type - ${err.message}`);
      }

      try {
        await executeQuery(`CREATE INDEX IF NOT EXISTS ${futurePartitionName}_created_at_idx ON ${futurePartitionName} (created_at)`);
      } catch (err) {
        log(`Warning: Could not create index on created_at - ${err.message}`);
      }
      
      // Проверяем существование таблицы partition_logs
      const partitionLogsExistsResult = await executeQuery(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'partition_logs')"
      );
      
      const partitionLogsExists = partitionLogsExistsResult.rows[0].exists;
      if (!partitionLogsExists) {
        // Создаем таблицу partition_logs
        log('Creating partition_logs table');
        await executeQuery(`
          CREATE TABLE partition_logs (
            id SERIAL PRIMARY KEY,
            operation VARCHAR(50) NOT NULL,
            partition_name VARCHAR(100) NOT NULL,
            status VARCHAR(20) NOT NULL,
            notes TEXT,
            error_message TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          )
        `);
        
        // Создаем индексы для таблицы
        await executeQuery('CREATE INDEX partition_logs_operation_idx ON partition_logs (operation)');
        await executeQuery('CREATE INDEX partition_logs_partition_name_idx ON partition_logs (partition_name)');
        await executeQuery('CREATE INDEX partition_logs_status_idx ON partition_logs (status)');
        await executeQuery('CREATE INDEX partition_logs_created_at_idx ON partition_logs (created_at)');
      }
      
      // Добавляем запись в таблицу partition_logs
      log('Adding record to partition_logs table');
      await executeQuery(`
        INSERT INTO partition_logs 
        (operation, partition_name, status, notes) 
        VALUES 
        ('initial_setup', 'transactions', 'success', 'Initial partitioning setup completed successfully')
      `);
      
      log('Committing transaction');
      await executeQuery('COMMIT');
      
      log('Migration completed successfully');
    } catch (error) {
      log('Error during migration. Rolling back.');
      await executeQuery('ROLLBACK');
      throw error;
    } finally {
      // Закрываем соединение с базой данных
      await pool.end();
    }
  } catch (error) {
    log(`Migration failed: ${error.message}`);
    console.error(error);
    throw error;
  }
}

// Запуск миграции
console.log('🚀 Запуск миграции партиционирования для Neon DB...');

runMigration()
  .then(() => {
    console.log('✅ Миграция выполнена успешно!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка при выполнении миграции:', error);
    process.exit(1);
  });