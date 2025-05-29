/**
 * Скрипт для создания таблицы reward_distribution_logs напрямую через SQL
 * Используется как альтернатива drizzle-kit push, который может работать медленно
 */

// Для работы с PostgreSQL
const { Pool } = require('pg');

// Подключение к базе данных
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

async function createRewardDistributionLogsTable() {
  try {
    console.log('Checking if reward_distribution_logs table exists...');
    
    // Проверяем, существует ли таблица
    const existsResult = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'reward_distribution_logs'
      );
    `);
    
    const tableExists = existsResult.rows[0].exists;
    
    if (tableExists) {
      console.log('Table reward_distribution_logs already exists. Skipping creation.');
      return;
    }
    
    console.log('Creating reward_distribution_logs table...');
    
    // Создаем таблицу
    await pool.query(`
      CREATE TABLE reward_distribution_logs (
        id SERIAL PRIMARY KEY,
        source_user_id INTEGER NOT NULL,
        batch_id TEXT NOT NULL UNIQUE,
        currency TEXT NOT NULL,
        earned_amount NUMERIC(18, 6) NOT NULL,
        total_distributed NUMERIC(18, 6) DEFAULT '0',
        levels_processed INTEGER DEFAULT 0,
        inviter_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        error_message TEXT,
        processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        completed_at TIMESTAMP
      )
    `);
    
    console.log('Table reward_distribution_logs created successfully.');
    
    // Создаем индексы
    console.log('Creating indexes for reward_distribution_logs...');
    
    await pool.query(`
      CREATE INDEX idx_reward_logs_source_user ON reward_distribution_logs (source_user_id);
      CREATE INDEX idx_reward_logs_status ON reward_distribution_logs (status);
      CREATE INDEX idx_reward_logs_processed_at ON reward_distribution_logs (processed_at);
    `);
    
    console.log('Indexes created successfully.');
    
    // Создаем индексы для таблицы referrals, если они не существуют
    console.log('Creating indexes for referrals table...');
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_referrals_user_id ON referrals(user_id);
      CREATE INDEX IF NOT EXISTS idx_referrals_inviter_id ON referrals(inviter_id);
      CREATE INDEX IF NOT EXISTS idx_referrals_level ON referrals(level);
    `);
    
    console.log('Referrals table indexes created successfully.');
    
    // Анализируем таблицы для обновления статистики
    console.log('Analyzing tables...');
    await pool.query(`ANALYZE referrals;`);
    await pool.query(`ANALYZE reward_distribution_logs;`);
    
    console.log('Database setup completed successfully.');
    
  } catch (error) {
    console.error('Error creating reward_distribution_logs table:', error);
  } finally {
    // Закрываем соединение с базой данных
    await pool.end();
    process.exit();
  }
}

// Запускаем функцию
createRewardDistributionLogsTable();