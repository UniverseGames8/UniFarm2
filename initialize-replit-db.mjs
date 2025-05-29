/**
 * Скрипт для инициализации схемы базы данных в Replit PostgreSQL
 * 
 * Этот скрипт создает все необходимые таблицы, индексы и ограничения
 * в локальной PostgreSQL базе данных на Replit, без зависимости от Neon DB.
 */

import pg from 'pg';
const { Pool } = pg;

// Настройки подключения к Replit PostgreSQL
const dbConfig = {
  host: 'localhost',
  port: 5432,
  user: 'runner',
  password: '',
  database: 'postgres'
};

// Создаем пул соединений
const pool = new Pool(dbConfig);

// Функция для выполнения SQL запроса
async function executeQuery(query, params = []) {
  try {
    const result = await pool.query(query, params);
    return result;
  } catch (error) {
    console.error(`❌ Ошибка выполнения запроса: ${query.slice(0, 100)}...`);
    console.error(error);
    throw error;
  }
}

// Функция для проверки существования таблицы
async function tableExists(tableName) {
  const query = `
    SELECT EXISTS (
      SELECT FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename = $1
    );
  `;
  
  const result = await executeQuery(query, [tableName]);
  return result.rows[0].exists;
}

// Объявления SQL для создания таблиц
const createTablesSql = [
  // Таблица auth_users
  `CREATE TABLE IF NOT EXISTS "auth_users" (
    "id" SERIAL PRIMARY KEY,
    "username" TEXT NOT NULL UNIQUE,
    "password" TEXT DEFAULT 'telegram_auth'
  )`,
  
  // Таблица users
  `CREATE TABLE IF NOT EXISTS "users" (
    "id" SERIAL PRIMARY KEY,
    "telegram_id" BIGINT UNIQUE,
    "guest_id" TEXT UNIQUE,
    "username" TEXT,
    "wallet" TEXT,
    "ton_wallet_address" TEXT,
    "ref_code" TEXT UNIQUE,
    "parent_ref_code" TEXT,
    "balance_uni" NUMERIC(18, 6) DEFAULT '0',
    "balance_ton" NUMERIC(18, 6) DEFAULT '0',
    "uni_deposit_amount" NUMERIC(18, 6) DEFAULT '0',
    "uni_farming_start_timestamp" TIMESTAMP,
    "uni_farming_balance" NUMERIC(18, 6) DEFAULT '0',
    "uni_farming_rate" NUMERIC(18, 6) DEFAULT '0',
    "uni_farming_last_update" TIMESTAMP,
    "uni_farming_deposit" NUMERIC(18, 6) DEFAULT '0',
    "uni_farming_activated_at" TIMESTAMP,
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "checkin_last_date" TIMESTAMP,
    "checkin_streak" INTEGER DEFAULT 0
  )`,
  
  // Таблица farming_deposits
  `CREATE TABLE IF NOT EXISTS "farming_deposits" (
    "id" SERIAL PRIMARY KEY,
    "user_id" INTEGER REFERENCES "users"("id"),
    "amount_uni" NUMERIC(18, 6),
    "rate_uni" NUMERIC(5, 2),
    "rate_ton" NUMERIC(5, 2),
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "last_claim" TIMESTAMP,
    "is_boosted" BOOLEAN DEFAULT FALSE,
    "deposit_type" TEXT DEFAULT 'regular',
    "boost_id" INTEGER,
    "expires_at" TIMESTAMP
  )`,
  
  // Таблица transactions
  `CREATE TABLE IF NOT EXISTS "transactions" (
    "id" SERIAL PRIMARY KEY,
    "user_id" INTEGER REFERENCES "users"("id"),
    "type" TEXT,
    "currency" TEXT,
    "amount" NUMERIC(18, 6),
    "status" TEXT DEFAULT 'confirmed',
    "source" TEXT,
    "category" TEXT,
    "tx_hash" TEXT,
    "description" TEXT,
    "source_user_id" INTEGER,
    "wallet_address" TEXT,
    "data" TEXT,
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  
  // Таблица referrals
  `CREATE TABLE IF NOT EXISTS "referrals" (
    "id" SERIAL PRIMARY KEY,
    "user_id" INTEGER REFERENCES "users"("id") NOT NULL,
    "inviter_id" INTEGER REFERENCES "users"("id") NOT NULL,
    "level" INTEGER NOT NULL,
    "reward_uni" NUMERIC(18, 6),
    "ref_path" JSONB[],
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  
  // Таблица missions
  `CREATE TABLE IF NOT EXISTS "missions" (
    "id" SERIAL PRIMARY KEY,
    "type" TEXT,
    "title" TEXT,
    "description" TEXT,
    "reward_uni" NUMERIC(18, 6),
    "is_active" BOOLEAN DEFAULT TRUE
  )`,
  
  // Таблица user_missions
  `CREATE TABLE IF NOT EXISTS "user_missions" (
    "id" SERIAL PRIMARY KEY,
    "user_id" INTEGER REFERENCES "users"("id"),
    "mission_id" INTEGER REFERENCES "missions"("id"),
    "completed_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  
  // Таблица uni_farming_deposits
  `CREATE TABLE IF NOT EXISTS "uni_farming_deposits" (
    "id" SERIAL PRIMARY KEY,
    "user_id" INTEGER REFERENCES "users"("id") NOT NULL,
    "amount" NUMERIC(18, 6) NOT NULL,
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "rate_per_second" NUMERIC(20, 18) NOT NULL,
    "last_updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "is_active" BOOLEAN DEFAULT TRUE
  )`,
  
  // Таблица ton_boost_deposits
  `CREATE TABLE IF NOT EXISTS "ton_boost_deposits" (
    "id" SERIAL PRIMARY KEY,
    "user_id" INTEGER REFERENCES "users"("id") NOT NULL,
    "ton_amount" NUMERIC(18, 5) NOT NULL,
    "bonus_uni" NUMERIC(18, 6) NOT NULL,
    "rate_ton_per_second" NUMERIC(20, 18) NOT NULL,
    "rate_uni_per_second" NUMERIC(20, 18) NOT NULL,
    "accumulated_ton" NUMERIC(18, 10) DEFAULT '0',
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "last_updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "is_active" BOOLEAN DEFAULT TRUE
  )`,
  
  // Таблица launch_logs
  `CREATE TABLE IF NOT EXISTS "launch_logs" (
    "id" SERIAL PRIMARY KEY,
    "telegram_user_id" BIGINT,
    "ref_code" TEXT,
    "platform" TEXT,
    "timestamp" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "user_agent" TEXT,
    "init_data" TEXT,
    "ip_address" TEXT,
    "request_id" TEXT,
    "user_id" INTEGER REFERENCES "users"("id")
  )`,
  
  // Таблица partition_logs
  `CREATE TABLE IF NOT EXISTS "partition_logs" (
    "id" SERIAL PRIMARY KEY,
    "operation" TEXT NOT NULL,
    "partition_name" TEXT,
    "message" TEXT NOT NULL,
    "timestamp" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "status" TEXT NOT NULL,
    "error_details" TEXT
  )`,
  
  // Таблица reward_distribution_logs
  `CREATE TABLE IF NOT EXISTS "reward_distribution_logs" (
    "id" SERIAL PRIMARY KEY,
    "batch_id" TEXT NOT NULL,
    "source_user_id" INTEGER NOT NULL,
    "earned_amount" NUMERIC(18, 6) NOT NULL,
    "currency" TEXT NOT NULL,
    "processed_at" TIMESTAMP,
    "status" TEXT DEFAULT 'pending',
    "levels_processed" INTEGER,
    "inviter_count" INTEGER,
    "total_distributed" NUMERIC(18, 6),
    "error_message" TEXT,
    "completed_at" TIMESTAMP
  )`,
  
  // Таблица performance_metrics
  `CREATE TABLE IF NOT EXISTS "performance_metrics" (
    "id" SERIAL PRIMARY KEY,
    "operation" TEXT NOT NULL,
    "batch_id" TEXT,
    "duration_ms" NUMERIC(12, 2) NOT NULL,
    "timestamp" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "details" TEXT
  )`
];

// SQL для создания индексов
const createIndexesSql = [
  // Индексы для таблицы users
  `CREATE INDEX IF NOT EXISTS "idx_users_parent_ref_code" ON "users" ("parent_ref_code")`,
  `CREATE INDEX IF NOT EXISTS "idx_users_ref_code" ON "users" ("ref_code")`,
  
  // Индексы для таблицы transactions
  `CREATE INDEX IF NOT EXISTS "idx_transactions_user_id" ON "transactions" ("user_id")`,
  `CREATE INDEX IF NOT EXISTS "idx_transactions_source_user_id" ON "transactions" ("source_user_id")`,
  `CREATE INDEX IF NOT EXISTS "idx_transactions_type_status" ON "transactions" ("type", "status")`,
  
  // Индексы для таблицы referrals
  `CREATE INDEX IF NOT EXISTS "idx_referrals_user_id" ON "referrals" ("user_id")`,
  `CREATE INDEX IF NOT EXISTS "idx_referrals_inviter_id" ON "referrals" ("inviter_id")`,
  `CREATE INDEX IF NOT EXISTS "idx_referrals_user_inviter" ON "referrals" ("user_id", "inviter_id")`,
  `CREATE INDEX IF NOT EXISTS "idx_referrals_level" ON "referrals" ("level")`,
  
  // Индексы для таблицы performance_metrics
  `CREATE INDEX IF NOT EXISTS "idx_performance_metrics_timestamp" ON "performance_metrics" ("timestamp")`,
  `CREATE INDEX IF NOT EXISTS "idx_performance_metrics_operation" ON "performance_metrics" ("operation")`,
  `CREATE INDEX IF NOT EXISTS "idx_performance_metrics_batch_id" ON "performance_metrics" ("batch_id")`
];

// Создание первоначальных данных
const insertInitialDataSql = [
  // Пример заполнения таблицы missions
  `INSERT INTO "missions" ("type", "title", "description", "reward_uni", "is_active")
  VALUES 
  ('invite', 'Пригласи друга', 'Пригласи друга и получи вознаграждение', 10, true),
  ('deposit', 'Сделай первый депозит', 'Внеси свой первый депозит в фарминг', 5, true),
  ('check-in', 'Ежедневный бонус', 'Получай бонус каждый день', 1, true)
  ON CONFLICT DO NOTHING`
];

// Основная функция инициализации базы данных
async function initializeDatabase() {
  console.log('🚀 Инициализация базы данных Replit PostgreSQL...');
  
  try {
    // Проверяем соединение
    await executeQuery('SELECT 1');
    console.log('✅ Соединение с PostgreSQL на Replit установлено');
    
    // Создаем таблицы
    console.log('📦 Создаем таблицы...');
    for (const sql of createTablesSql) {
      await executeQuery(sql);
    }
    console.log('✅ Таблицы успешно созданы');
    
    // Создаем индексы
    console.log('📇 Создаем индексы...');
    for (const sql of createIndexesSql) {
      await executeQuery(sql);
    }
    console.log('✅ Индексы успешно созданы');
    
    // Вставляем начальные данные
    console.log('📝 Вставляем начальные данные...');
    for (const sql of insertInitialDataSql) {
      await executeQuery(sql);
    }
    console.log('✅ Начальные данные успешно добавлены');
    
    // Проверяем созданные таблицы
    const tableNames = [
      'auth_users', 'users', 'farming_deposits', 'transactions',
      'referrals', 'missions', 'user_missions', 'uni_farming_deposits',
      'ton_boost_deposits', 'launch_logs', 'partition_logs', 
      'reward_distribution_logs', 'performance_metrics'
    ];
    
    console.log('\n📋 Проверка созданных таблиц:');
    for (const tableName of tableNames) {
      const exists = await tableExists(tableName);
      console.log(`   ${exists ? '✅' : '❌'} ${tableName}`);
    }
    
    console.log('\n🏁 Инициализация базы данных успешно завершена!');
    console.log('📊 База данных готова к использованию с приложением');
    
    // Закрываем соединение
    await pool.end();
  } catch (error) {
    console.error('❌ Ошибка инициализации базы данных:', error);
    
    // Закрываем соединение в случае ошибки
    try {
      await pool.end();
    } catch (e) {
      // Игнорируем ошибки при закрытии пула
    }
    
    process.exit(1);
  }
}

// Запускаем инициализацию
initializeDatabase();