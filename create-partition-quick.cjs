/**
 * Быстрое создание партиционирования для таблицы transactions
 */

const dotenv = require('dotenv');
const { Pool } = require('pg');
const { format, addDays } = require('date-fns');

// Загружаем переменные окружения
dotenv.config();

// Проверяем наличие строки подключения
if (!process.env.DATABASE_URL) {
  console.error('❌ Переменная окружения DATABASE_URL не установлена');
  process.exit(1);
}

// Создаем пул соединений
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

/**
 * Выполняет SQL запрос
 */
async function executeQuery(query, params = []) {
  try {
    console.log(`Executing: ${query.slice(0, 80)}...`);
    const result = await pool.query(query, params);
    return result;
  } catch (error) {
    console.error(`SQL Error: ${error.message}`);
    throw error;
  }
}

/**
 * Создает партицию для указанной даты
 */
async function createPartitionForDate(date) {
  const dateStr = format(date, 'yyyy_MM_dd');
  const partitionName = `transactions_${dateStr}`;
  
  const startDate = format(date, 'yyyy-MM-dd');
  const endDate = format(addDays(date, 1), 'yyyy-MM-dd');
  
  console.log(`Creating partition ${partitionName} for ${startDate}`);
  
  try {
    // Create the partition
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS ${partitionName} 
      PARTITION OF transactions
      FOR VALUES FROM ('${startDate}') TO ('${endDate}');
    `);
    
    // Create indices
    await executeQuery(`CREATE INDEX IF NOT EXISTS ${partitionName}_user_id_idx ON ${partitionName} (user_id);`);
    await executeQuery(`CREATE INDEX IF NOT EXISTS ${partitionName}_type_idx ON ${partitionName} (type);`);
    await executeQuery(`CREATE INDEX IF NOT EXISTS ${partitionName}_created_at_idx ON ${partitionName} (created_at);`);
    
    console.log(`Partition ${partitionName} created successfully`);
    return true;
  } catch (error) {
    console.error(`Error creating partition ${partitionName}:`, error.message);
    return false;
  }
}

/**
 * Основная функция
 */
async function quickPartitioning() {
  try {
    console.log('Starting quick partitioning setup...');
    
    // Step 1: Check if there's a transactions_temp table (from a previous failed attempt)
    const tempTableExists = await executeQuery(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions_temp'
      );
    `);
    
    if (tempTableExists.rows[0].exists) {
      console.log('Found transactions_temp table from previous attempt, dropping it...');
      await executeQuery('DROP TABLE transactions_temp;');
    }
    
    // Step 2: Create a temporary backup of the transactions table
    console.log('Creating temporary backup of transactions table...');
    await executeQuery(`
      CREATE TABLE transactions_temp AS 
      SELECT * FROM transactions;
    `);
    
    // Get the max ID
    const maxIdResult = await executeQuery('SELECT MAX(id) FROM transactions;');
    const maxId = maxIdResult.rows[0].max || 0;
    console.log(`Max transaction ID: ${maxId}`);
    
    // Step 3: Drop the original table
    console.log('Dropping original transactions table...');
    await executeQuery('DROP TABLE transactions;');
    
    // Step 4: Create the partitioned table
    console.log('Creating partitioned transactions table...');
    await executeQuery(`
      CREATE TABLE transactions (
        id SERIAL,
        user_id INTEGER,
        amount NUMERIC(18, 9),
        type TEXT,
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
      ) PARTITION BY RANGE (created_at);
    `);
    
    // Step 5: Create partitions
    console.log('Creating partitions...');
    const today = new Date();
    
    // Create the default partition for older data
    console.log('Creating default partition for older data...');
    await executeQuery(`
      CREATE TABLE transactions_default
      PARTITION OF transactions
      FOR VALUES FROM (MINVALUE) TO ('${format(today, 'yyyy-MM-dd')}');
    `);
    
    // Create indices for default partition
    await executeQuery(`CREATE INDEX transactions_default_user_id_idx ON transactions_default (user_id);`);
    await executeQuery(`CREATE INDEX transactions_default_type_idx ON transactions_default (type);`);
    await executeQuery(`CREATE INDEX transactions_default_created_at_idx ON transactions_default (created_at);`);
    
    // Create partitions for next 7 days
    for (let i = 0; i < 7; i++) {
      const date = addDays(today, i);
      await createPartitionForDate(date);
    }
    
    // Create future partition
    console.log('Creating future partition...');
    await executeQuery(`
      CREATE TABLE transactions_future
      PARTITION OF transactions
      FOR VALUES FROM ('${format(addDays(today, 7), 'yyyy-MM-dd')}') TO (MAXVALUE);
    `);
    
    // Create indices for future partition
    await executeQuery(`CREATE INDEX transactions_future_user_id_idx ON transactions_future (user_id);`);
    await executeQuery(`CREATE INDEX transactions_future_type_idx ON transactions_future (type);`);
    await executeQuery(`CREATE INDEX transactions_future_created_at_idx ON transactions_future (created_at);`);
    
    // Step 6: Copy data back from temporary table
    console.log('Copying data back to partitioned table...');
    await executeQuery(`
      INSERT INTO transactions 
      (id, user_id, amount, type, currency, status, source, category, tx_hash, 
       description, source_user_id, data, wallet_address, created_at)
      SELECT id, user_id, amount, type, currency, status, source, category, tx_hash, 
             description, source_user_id, data, wallet_address, created_at
      FROM transactions_temp;
    `);
    
    // Step 7: Reset sequence
    console.log('Resetting sequence...');
    await executeQuery(`SELECT setval('transactions_id_seq', ${maxId}, true);`);
    
    // Step 8: Drop temporary table
    console.log('Dropping temporary table...');
    await executeQuery('DROP TABLE transactions_temp;');
    
    console.log('✅ Partitioning completed successfully!');
  } catch (error) {
    console.error('❌ Error during partitioning:', error.message);
  } finally {
    await pool.end();
  }
}

// Execute the function
quickPartitioning();