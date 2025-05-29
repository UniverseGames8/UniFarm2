/**
 * Міграція для уніфікації таблиці partition_logs
 * 
 * Ця міграція вирішує проблеми з різними схемами таблиці partition_logs,
 * створюючи уніфіковану версію з усіма необхідними полями.
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

// Завантажуємо змінні середовища
dotenv.config();

// Функція для логування
function log(message: string) {
  console.log(`[Migration] ${message}`);
}

// Функція для виконання SQL-запиту
async function executeQuery(query: string, params: any[] = []) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    const result = await pool.query(query, params);
    return result;
  } catch (error: any) {
    log(`SQL Error: ${error.message}`);
    log(`Query: ${query}`);
    log(`Params: ${JSON.stringify(params)}`);
    throw error;
  } finally {
    pool.end();
  }
}

// Основна функція міграції
export async function unifyPartitionLogsTable() {
  try {
    log('Starting migration: Unifying partition_logs table structure');
    
    // Перевіряємо існування таблиці
    const tableExistsResult = await executeQuery(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'partition_logs'
      );
    `);
    
    const tableExists = tableExistsResult.rows[0].exists;
    
    if (!tableExists) {
      // Якщо таблиця не існує, створюємо її з єдиною структурою
      log('Creating new partition_logs table with unified structure');
      
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
        
        CREATE INDEX idx_partition_logs_operation_type ON partition_logs(operation_type);
        CREATE INDEX idx_partition_logs_partition_name ON partition_logs(partition_name);
        CREATE INDEX idx_partition_logs_status ON partition_logs(status);
        CREATE INDEX idx_partition_logs_created_at ON partition_logs(created_at);
      `);
      
      log('Successfully created unified partition_logs table');
      return;
    }
    
    // Якщо таблиця існує, перевіряємо її структуру
    log('Table partition_logs exists, checking its structure');
    
    const columnsResult = await executeQuery(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public'
      AND table_name = 'partition_logs';
    `);
    
    const columns = columnsResult.rows.map((row: any) => row.column_name);
    log(`Existing columns: ${columns.join(', ')}`);
    
    // Розпочинаємо транзакцію для безпечного оновлення
    await executeQuery('BEGIN');
    
    try {
      // Перевіряємо/перейменовуємо колонки для уніфікації
      
      // 1. operation/operation_type
      if (!columns.includes('operation_type')) {
        if (columns.includes('operation')) {
          log('Renaming column operation to operation_type');
          await executeQuery('ALTER TABLE partition_logs RENAME COLUMN operation TO operation_type');
        } else {
          log('Adding column operation_type');
          await executeQuery('ALTER TABLE partition_logs ADD COLUMN operation_type VARCHAR(50) NOT NULL DEFAULT \'unknown\'');
        }
      }
      
      // 2. error_details/error_message
      if (!columns.includes('error_message')) {
        if (columns.includes('error_details')) {
          log('Renaming column error_details to error_message');
          await executeQuery('ALTER TABLE partition_logs RENAME COLUMN error_details TO error_message');
        } else {
          log('Adding column error_message');
          await executeQuery('ALTER TABLE partition_logs ADD COLUMN error_message TEXT');
        }
      }
      
      // 3. notes
      if (!columns.includes('notes')) {
        if (columns.includes('details')) {
          log('Renaming column details to notes');
          await executeQuery('ALTER TABLE partition_logs RENAME COLUMN details TO notes');
        } else {
          log('Adding column notes');
          await executeQuery('ALTER TABLE partition_logs ADD COLUMN notes TEXT');
        }
      }
      
      // 4. created_at/timestamp
      if (!columns.includes('created_at')) {
        if (columns.includes('timestamp')) {
          log('Renaming column timestamp to created_at');
          await executeQuery('ALTER TABLE partition_logs RENAME COLUMN timestamp TO created_at');
        } else {
          log('Adding column created_at');
          await executeQuery('ALTER TABLE partition_logs ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()');
        }
      }
      
      // Перевіряємо/створюємо індекси
      log('Checking and creating indexes');
      
      const indexesResult = await executeQuery(`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'partition_logs';
      `);
      
      const indexes = indexesResult.rows.map((row: any) => row.indexname);
      
      if (!indexes.includes('idx_partition_logs_operation_type')) {
        log('Creating index idx_partition_logs_operation_type');
        await executeQuery('CREATE INDEX idx_partition_logs_operation_type ON partition_logs(operation_type)');
      }
      
      if (!indexes.includes('idx_partition_logs_partition_name')) {
        log('Creating index idx_partition_logs_partition_name');
        await executeQuery('CREATE INDEX idx_partition_logs_partition_name ON partition_logs(partition_name)');
      }
      
      if (!indexes.includes('idx_partition_logs_status')) {
        log('Creating index idx_partition_logs_status');
        await executeQuery('CREATE INDEX idx_partition_logs_status ON partition_logs(status)');
      }
      
      if (!indexes.includes('idx_partition_logs_created_at')) {
        log('Creating index idx_partition_logs_created_at');
        await executeQuery('CREATE INDEX idx_partition_logs_created_at ON partition_logs(created_at)');
      }
      
      // Фіксуємо транзакцію
      await executeQuery('COMMIT');
      log('Successfully updated partition_logs table to unified structure');
    } catch (error) {
      // Відкат транзакції у разі помилки
      await executeQuery('ROLLBACK');
      throw error;
    }
    
  } catch (error: any) {
    log(`Error in migration: ${error.message}`);
    if (error.stack) {
      log(`Stack trace: ${error.stack}`);
    }
    throw error;
  }
}

// Автоматичний запуск міграції при виклику файлу напряму
if (require.main === module) {
  unifyPartitionLogsTable()
    .then(() => {
      log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      log(`Migration failed: ${error.message}`);
      process.exit(1);
    });
}

export default unifyPartitionLogsTable;