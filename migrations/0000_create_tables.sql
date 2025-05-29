-- Создаем таблицы базы данных для проекта UniFarm
-- Миграция для первоначального создания всех таблиц

-- Таблица для аутентификации пользователей
CREATE TABLE IF NOT EXISTS "auth_users" (
  "id" SERIAL PRIMARY KEY,
  "username" TEXT NOT NULL UNIQUE,
  "password" TEXT DEFAULT 'telegram_auth'
);

-- Таблица пользователей
CREATE TABLE IF NOT EXISTS "users" (
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
);

-- Индексы для таблицы пользователей
CREATE INDEX IF NOT EXISTS "idx_users_parent_ref_code" ON "users" ("parent_ref_code");
CREATE INDEX IF NOT EXISTS "idx_users_ref_code" ON "users" ("ref_code");

-- Таблица farming_deposits
CREATE TABLE IF NOT EXISTS "farming_deposits" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER REFERENCES "users" ("id"),
  "amount_uni" NUMERIC(18, 6),
  "rate_uni" NUMERIC(5, 2),
  "rate_ton" NUMERIC(5, 2),
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "last_claim" TIMESTAMP,
  "is_boosted" BOOLEAN DEFAULT FALSE,
  "deposit_type" TEXT DEFAULT 'regular',
  "boost_id" INTEGER,
  "expires_at" TIMESTAMP
);

-- Таблица transactions
CREATE TABLE IF NOT EXISTS "transactions" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER REFERENCES "users" ("id"),
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
);

-- Индексы для таблицы transactions
CREATE INDEX IF NOT EXISTS "idx_transactions_user_id" ON "transactions" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_transactions_source_user_id" ON "transactions" ("source_user_id");
CREATE INDEX IF NOT EXISTS "idx_transactions_type_status" ON "transactions" ("type", "status");

-- Таблица referrals
CREATE TABLE IF NOT EXISTS "referrals" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users" ("id"),
  "inviter_id" INTEGER NOT NULL REFERENCES "users" ("id"),
  "level" INTEGER NOT NULL,
  "reward_uni" NUMERIC(18, 6),
  "ref_path" JSONB[],
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для таблицы referrals
CREATE INDEX IF NOT EXISTS "idx_referrals_user_id" ON "referrals" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_referrals_inviter_id" ON "referrals" ("inviter_id");
CREATE INDEX IF NOT EXISTS "idx_referrals_user_inviter" ON "referrals" ("user_id", "inviter_id");
CREATE INDEX IF NOT EXISTS "idx_referrals_level" ON "referrals" ("level");

-- Таблица missions
CREATE TABLE IF NOT EXISTS "missions" (
  "id" SERIAL PRIMARY KEY,
  "type" TEXT,
  "title" TEXT,
  "description" TEXT,
  "reward_uni" NUMERIC(18, 6),
  "is_active" BOOLEAN DEFAULT TRUE
);

-- Таблица user_missions
CREATE TABLE IF NOT EXISTS "user_missions" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER REFERENCES "users" ("id"),
  "mission_id" INTEGER REFERENCES "missions" ("id"),
  "completed_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица uni_farming_deposits
CREATE TABLE IF NOT EXISTS "uni_farming_deposits" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users" ("id"),
  "amount" NUMERIC(18, 6) NOT NULL,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "rate_per_second" NUMERIC(20, 18) NOT NULL,
  "last_updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "is_active" BOOLEAN DEFAULT TRUE
);

-- Таблица ton_boost_deposits
CREATE TABLE IF NOT EXISTS "ton_boost_deposits" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users" ("id"),
  "ton_amount" NUMERIC(18, 5) NOT NULL,
  "bonus_uni" NUMERIC(18, 6) NOT NULL,
  "rate_ton_per_second" NUMERIC(20, 18) NOT NULL,
  "rate_uni_per_second" NUMERIC(20, 18) NOT NULL,
  "accumulated_ton" NUMERIC(18, 10) DEFAULT '0',
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "last_updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "is_active" BOOLEAN DEFAULT TRUE
);

-- Таблица boost_packages для хранения доступных буст-пакетов
CREATE TABLE IF NOT EXISTS "boost_packages" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "price_uni" NUMERIC(18, 6) NOT NULL,
  "rate_multiplier" NUMERIC(5, 2) NOT NULL,
  "duration_days" INTEGER DEFAULT 365,
  "is_active" BOOLEAN DEFAULT TRUE,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица для логирования запусков Mini App
CREATE TABLE IF NOT EXISTS "launch_logs" (
  "id" SERIAL PRIMARY KEY,
  "telegram_user_id" BIGINT,
  "ref_code" TEXT,
  "platform" TEXT,
  "timestamp" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "user_agent" TEXT,
  "init_data" TEXT,
  "ip_address" TEXT,
  "request_id" TEXT,
  "user_id" INTEGER REFERENCES "users" ("id")
);

-- Таблица для логирования операций с партициями
CREATE TABLE IF NOT EXISTS "partition_logs" (
  "id" SERIAL PRIMARY KEY,
  "operation" TEXT NOT NULL,
  "partition_name" TEXT,
  "message" TEXT NOT NULL,
  "timestamp" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "status" TEXT NOT NULL,
  "error_details" TEXT
);

-- Таблица для логов распределения реферальных вознаграждений
CREATE TABLE IF NOT EXISTS "reward_distribution_logs" (
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
);

-- Таблица для метрик производительности
CREATE TABLE IF NOT EXISTS "performance_metrics" (
  "id" SERIAL PRIMARY KEY,
  "operation" TEXT NOT NULL,
  "batch_id" TEXT,
  "duration_ms" NUMERIC(12, 2) NOT NULL,
  "timestamp" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "details" TEXT
);

-- Индексы для таблицы performance_metrics
CREATE INDEX IF NOT EXISTS "idx_performance_metrics_timestamp" ON "performance_metrics" ("timestamp");
CREATE INDEX IF NOT EXISTS "idx_performance_metrics_operation" ON "performance_metrics" ("operation");
CREATE INDEX IF NOT EXISTS "idx_performance_metrics_batch_id" ON "performance_metrics" ("batch_id");