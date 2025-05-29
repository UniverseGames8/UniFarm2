#!/usr/bin/env node
/**
 * Скрипт для инициализации Neon DB базовыми таблицами
 * 
 * Создает основные таблицы в Neon DB на основе схемы из shared/schema.ts
 */

import fs from 'fs';
import { Pool } from 'pg';
import 'dotenv/config';

// Цвета для консоли
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Вывод в консоль с цветами
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// Загружаем переменные окружения из .env.neon
function loadEnvFromFile() {
  try {
    const envFile = fs.readFileSync('.env.neon', 'utf8');
    const envVars = {};
    
    envFile.split('\n').forEach(line => {
      if (line.trim() && !line.startsWith('#')) {
        const parts = line.split('=');
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const value = parts.slice(1).join('=').trim();
          
          if (key && value) {
            envVars[key] = value;
            process.env[key] = value;
          }
        }
      }
    });
    
    return envVars;
  } catch (error) {
    log(`Ошибка при загрузке .env.neon: ${error.message}`, colors.red);
    return {};
  }
}

// Основные SQL запросы для создания таблиц
const createTableQueries = [
  // Таблица auth_users
  `CREATE TABLE IF NOT EXISTS auth_users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT DEFAULT 'telegram_auth'
  );`,
  
  // Таблица users
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE,
    guest_id TEXT UNIQUE,
    username TEXT,
    wallet TEXT,
    ton_wallet_address TEXT,
    ref_code TEXT UNIQUE,
    parent_ref_code TEXT,
    balance_uni DECIMAL(18, 6) DEFAULT 0,
    balance_ton DECIMAL(18, 6) DEFAULT 0,
    uni_deposit_amount DECIMAL(18, 6) DEFAULT 0,
    uni_farming_start_timestamp TIMESTAMP,
    uni_farming_balance DECIMAL(18, 6) DEFAULT 0,
    uni_farming_rate DECIMAL(18, 6) DEFAULT 0,
    uni_farming_last_update TIMESTAMP,
    uni_farming_deposit DECIMAL(18, 6) DEFAULT 0,
    uni_farming_activated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    checkin_last_date TIMESTAMP,
    checkin_streak INTEGER DEFAULT 0
  );`,
  
  // Индексы для таблицы users
  `CREATE INDEX IF NOT EXISTS idx_users_parent_ref_code ON users(parent_ref_code);`,
  `CREATE INDEX IF NOT EXISTS idx_users_ref_code ON users(ref_code);`,
  
  // Таблица farming_deposits
  `CREATE TABLE IF NOT EXISTS farming_deposits (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    amount_uni DECIMAL(18, 6),
    rate_uni DECIMAL(5, 2),
    rate_ton DECIMAL(5, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_claim TIMESTAMP,
    is_boosted BOOLEAN DEFAULT FALSE,
    deposit_type TEXT DEFAULT 'regular',
    boost_id INTEGER,
    expires_at TIMESTAMP
  );`,
  
  // Таблица transactions
  `CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    type TEXT,
    currency TEXT,
    amount DECIMAL(18, 6),
    status TEXT DEFAULT 'confirmed',
    source TEXT,
    category TEXT,
    tx_hash TEXT,
    description TEXT,
    source_user_id INTEGER,
    wallet_address TEXT,
    data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`,
  
  // Индексы для таблицы transactions
  `CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_source_user_id ON transactions(source_user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_type_status ON transactions(type, status);`,
  
  // Таблица referrals
  `CREATE TABLE IF NOT EXISTS referrals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) NOT NULL,
    inviter_id INTEGER REFERENCES users(id) NOT NULL,
    level INTEGER NOT NULL,
    reward_uni DECIMAL(18, 6),
    ref_path JSONB[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`,
  
  // Индексы для таблицы referrals
  `CREATE INDEX IF NOT EXISTS idx_referrals_user_id ON referrals(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_referrals_inviter_id ON referrals(inviter_id);`,
  `CREATE INDEX IF NOT EXISTS idx_referrals_user_inviter ON referrals(user_id, inviter_id);`,
  `CREATE INDEX IF NOT EXISTS idx_referrals_level ON referrals(level);`,
  
  // Таблица missions
  `CREATE TABLE IF NOT EXISTS missions (
    id SERIAL PRIMARY KEY,
    type TEXT,
    title TEXT,
    description TEXT,
    reward_uni DECIMAL(18, 6),
    is_active BOOLEAN DEFAULT TRUE
  );`,
  
  // Таблица user_missions
  `CREATE TABLE IF NOT EXISTS user_missions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    mission_id INTEGER REFERENCES missions(id),
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`,
  
  // Таблица uni_farming_deposits
  `CREATE TABLE IF NOT EXISTS uni_farming_deposits (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    amount DECIMAL(18, 6) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rate_per_second DECIMAL(20, 18) NOT NULL,
    last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
  );`,
  
  // Таблица ton_boost_deposits
  `CREATE TABLE IF NOT EXISTS ton_boost_deposits (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    ton_amount DECIMAL(18, 5) NOT NULL,
    bonus_uni DECIMAL(18, 6) NOT NULL,
    rate_ton_per_second DECIMAL(20, 18) NOT NULL,
    rate_uni_per_second DECIMAL(20, 18) NOT NULL,
    accumulated_ton DECIMAL(18, 10) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
  );`,
  
  // Таблица launch_logs
  `CREATE TABLE IF NOT EXISTS launch_logs (
    id SERIAL PRIMARY KEY,
    telegram_user_id BIGINT,
    ref_code TEXT,
    platform TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    user_agent TEXT,
    init_data TEXT,
    ip_address TEXT,
    request_id TEXT,
    user_id INTEGER REFERENCES users(id)
  );`,
  
  // Таблица partition_logs
  `CREATE TABLE IF NOT EXISTS partition_logs (
    id SERIAL PRIMARY KEY,
    operation TEXT NOT NULL,
    partition_name TEXT,
    message TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status TEXT NOT NULL,
    error_details TEXT
  );`,
  
  // Таблица reward_distribution_logs
  `CREATE TABLE IF NOT EXISTS reward_distribution_logs (
    id SERIAL PRIMARY KEY,
    batch_id TEXT NOT NULL,
    source_user_id INTEGER NOT NULL,
    earned_amount DECIMAL(18, 6) NOT NULL,
    currency TEXT NOT NULL,
    processed_at TIMESTAMP,
    status TEXT DEFAULT 'pending',
    levels_processed INTEGER,
    inviter_count INTEGER,
    total_distributed DECIMAL(18, 6),
    error_message TEXT,
    completed_at TIMESTAMP
  );`,
  
  // Таблица performance_metrics
  `CREATE TABLE IF NOT EXISTS performance_metrics (
    id SERIAL PRIMARY KEY,
    operation TEXT NOT NULL,
    batch_id TEXT,
    duration_ms DECIMAL(12, 2) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    details TEXT
  );`,
  
  // Индексы для таблицы performance_metrics
  `CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp);`,
  `CREATE INDEX IF NOT EXISTS idx_performance_metrics_operation ON performance_metrics(operation);`,
  `CREATE INDEX IF NOT EXISTS idx_performance_metrics_batch_id ON performance_metrics(batch_id);`
];

// Функция для инициализации базы данных
async function initDatabase() {
  log('🚀 Запуск инициализации базовых таблиц в Neon DB...', colors.blue);
  
  // Загружаем настройки
  loadEnvFromFile();
  
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL не найден в .env.neon');
  }
  
  // Создаем пул соединений
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    },
    max: 5
  });
  
  try {
    // Проверяем подключение
    log('🔄 Проверка подключения к Neon DB...', colors.cyan);
    await pool.query('SELECT 1');
    log('✅ Подключение к Neon DB успешно установлено', colors.green);
    
    // Предупреждение пользователю
    log('\n⚠️ ВНИМАНИЕ! Скрипт создаст основные таблицы в Neon DB.', colors.yellow);
    log('⚠️ Существующие таблицы не будут перезаписаны (используется IF NOT EXISTS).', colors.yellow);
    log('⚠️ Нажмите Ctrl+C, если хотите отменить операцию.', colors.yellow);
    
    // Уменьшаем время ожидания
    log('\nПродолжение через 1 секунду...', colors.magenta);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Создаем таблицы
    log('\n🔄 Создание таблиц...', colors.cyan);
    
    // Выполняем запросы в транзакции
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const query of createTableQueries) {
        try {
          await client.query(query);
          // Выводим первые 40 символов запроса для понимания, какая таблица создается
          const queryPreview = query.replace(/\s+/g, ' ').trim().substring(0, 40) + '...';
          log(`✅ Выполнен запрос: ${queryPreview}`, colors.green);
        } catch (error) {
          log(`❌ Ошибка при выполнении запроса: ${error.message}`, colors.red);
          throw error;
        }
      }
      
      // Завершаем транзакцию
      await client.query('COMMIT');
      log('\n✅ Все таблицы успешно созданы!', colors.green);
    } catch (error) {
      // Откатываем транзакцию в случае ошибки
      await client.query('ROLLBACK');
      log(`\n❌ Произошла ошибка, транзакция отменена: ${error.message}`, colors.red);
      throw error;
    } finally {
      // Возвращаем клиента в пул
      client.release();
    }
    
    // Проверяем созданные таблицы
    log('\n🔄 Проверка созданных таблиц...', colors.cyan);
    
    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    log(`\n📋 Созданные таблицы (${tables.rowCount}):`, colors.magenta);
    tables.rows.forEach(row => {
      log(`- ${row.table_name}`, colors.reset);
    });
    
    log('\n🎉 Инициализация базы данных успешно завершена!', colors.green);
    
    // Закрываем пул соединений
    await pool.end();
    
    return true;
  } catch (error) {
    log(`\n💥 Критическая ошибка: ${error.message}`, colors.red);
    console.error(error);
    
    // Закрываем пул соединений
    await pool.end();
    
    return false;
  }
}

// Запускаем инициализацию
initDatabase()
  .then(success => {
    if (success) {
      log('\n✅ Скрипт успешно выполнен', colors.green);
    } else {
      log('\n❌ Скрипт завершился с ошибками', colors.red);
      process.exit(1);
    }
  })
  .catch(error => {
    log(`\n💥 Непредвиденная ошибка: ${error.message}`, colors.red);
    console.error(error);
    process.exit(1);
  });