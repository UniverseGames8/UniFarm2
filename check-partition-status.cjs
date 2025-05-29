/**
 * Проверка статуса партиционирования таблицы transactions
 */

const dotenv = require('dotenv');
const { Pool } = require('pg');

// Загружаем переменные окружения
dotenv.config();

// Создаем пул соединений
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkPartitioning() {
  try {
    console.log('Checking partitioning status...');
    
    // Проверяем существование таблицы transactions
    const tableCheck = await pool.query(`
      SELECT EXISTS(
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema='public' 
        AND table_name='transactions'
      )
    `);
    
    const tableExists = tableCheck.rows[0].exists;
    console.log(`Transactions table exists: ${tableExists}`);
    
    if (!tableExists) {
      console.log('Table doesn\'t exist - partitioning in progress or failed.');
      return;
    }
    
    // Проверяем, является ли таблица партиционированной
    const partitionCheck = await pool.query(`
      SELECT c.relname as child_table
      FROM pg_inherits i
      JOIN pg_class p ON p.oid = i.inhparent
      JOIN pg_class c ON c.oid = i.inhrelid
      WHERE p.relname = 'transactions'
      LIMIT 5
    `);
    
    const isPartitioned = partitionCheck.rows.length > 0;
    console.log(`Table is partitioned: ${isPartitioned}`);
    
    if (isPartitioned) {
      console.log(`Found partitions: ${partitionCheck.rows.map(r => r.child_table).join(', ')}`);
      
      // Список всех партиций
      const allPartitions = await pool.query(`
        SELECT c.relname as partition_name
        FROM pg_inherits i
        JOIN pg_class p ON p.oid = i.inhparent
        JOIN pg_class c ON c.oid = i.inhrelid
        WHERE p.relname = 'transactions'
        ORDER BY c.relname
      `);
      
      console.log(`\nTotal partitions: ${allPartitions.rows.length}`);
      console.log('All partitions:');
      allPartitions.rows.forEach((row, index) => {
        console.log(`${index + 1}. ${row.partition_name}`);
      });
    }
  } catch (error) {
    console.error('Error checking partitioning:', error.message);
  } finally {
    await pool.end();
  }
}

// Запускаем проверку
checkPartitioning();