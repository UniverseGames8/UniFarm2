/**
 * Скрипт для прямой миграции базы данных из схемы Drizzle
 * 
 * Этот скрипт автоматически создает SQL запросы на основе схемы Drizzle
 * и выполняет их напрямую в базе данных.
 * 
 * Используйте этот скрипт, когда стандартные миграции не работают
 * или когда вам нужно быстро создать схему базы данных.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

// Директория для логов SQL
const SQL_LOGS_DIR = path.join(__dirname, 'migrations', 'logs');

// Имя файла с миграцией
const MIGRATION_FILE = path.join(SQL_LOGS_DIR, `migration_${new Date().toISOString().replace(/[:.]/g, '_')}.sql`);

// Конфигурация базы данных
const dbConfig = {
  host: process.env.PGHOST || `${process.env.HOME}/.postgresql/sockets`,
  database: process.env.PGDATABASE || 'postgres',
  user: process.env.PGUSER || 'runner',
  port: parseInt(process.env.PGPORT || '5432'),
  // Устанавливаем разумные таймауты
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 10000,
};

// Функция логирования с цветом
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// Функция для создания SQL-схемы из Drizzle
async function generateSchemaFromDrizzle() {
  try {
    log('Генерация SQL из схемы Drizzle...', colors.blue);
    
    // Создаем директорию, если она не существует
    if (!fs.existsSync(SQL_LOGS_DIR)) {
      fs.mkdirSync(SQL_LOGS_DIR, { recursive: true });
    }
    
    // Запускаем Drizzle Kit для генерации SQL
    execSync('npx drizzle-kit generate:pg', { stdio: 'inherit' });
    
    log('SQL успешно сгенерирован', colors.green);
    
    // Находим последний сгенерированный файл миграции
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir);
    
    // Фильтруем только директории (не файлы)
    const migrationDirs = files.filter(file => {
      const fullPath = path.join(migrationsDir, file);
      return fs.statSync(fullPath).isDirectory() && file.startsWith('0');
    });
    
    if (migrationDirs.length === 0) {
      throw new Error('Не найдены сгенерированные миграции');
    }
    
    // Сортируем директории по времени создания (последняя будет первой)
    migrationDirs.sort((a, b) => parseInt(b) - parseInt(a));
    
    // Берем последнюю сгенерированную миграцию
    const latestMigrationDir = path.join(migrationsDir, migrationDirs[0]);
    const migrationFile = path.join(latestMigrationDir, 'migration.sql');
    
    if (!fs.existsSync(migrationFile)) {
      throw new Error(`Файл миграции не найден в директории ${latestMigrationDir}`);
    }
    
    // Читаем содержимое файла миграции
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    // Сохраняем в наш лог-файл для истории
    fs.writeFileSync(MIGRATION_FILE, sql);
    
    log(`Миграция сохранена в файл: ${MIGRATION_FILE}`, colors.green);
    
    return sql;
  } catch (error) {
    log(`Ошибка генерации схемы: ${error.message}`, colors.red);
    
    // Попробуем создать схему вручную, если генерация не удалась
    return generateManualSchema();
  }
}

// Функция для ручной генерации схемы базы данных
function generateManualSchema() {
  log('Генерация SQL схемы вручную...', colors.yellow);
  
  // SQL для создания всех таблиц
  const sql = `
-- Таблица аутентификации
CREATE TABLE IF NOT EXISTS "auth_users" (
  "id" SERIAL PRIMARY KEY,
  "username" TEXT NOT NULL UNIQUE,
  "password" TEXT DEFAULT 'telegram_auth'
);

-- Основная таблица пользователей
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
  "created_at" TIMESTAMP DEFAULT NOW(),
  "checkin_last_date" TIMESTAMP,
  "checkin_streak" INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "idx_users_parent_ref_code" ON "users" ("parent_ref_code");
CREATE INDEX IF NOT EXISTS "idx_users_ref_code" ON "users" ("ref_code");

-- Таблица для фарминг-депозитов
CREATE TABLE IF NOT EXISTS "farming_deposits" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER REFERENCES "users" ("id"),
  "amount_uni" NUMERIC(18, 6),
  "rate_uni" NUMERIC(5, 2),
  "rate_ton" NUMERIC(5, 2),
  "created_at" TIMESTAMP DEFAULT NOW(),
  "last_claim" TIMESTAMP,
  "is_boosted" BOOLEAN DEFAULT false,
  "deposit_type" TEXT DEFAULT 'regular',
  "boost_id" INTEGER,
  "expires_at" TIMESTAMP
);

-- Таблица для транзакций
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
  "created_at" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_transactions_user_id" ON "transactions" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_transactions_source_user_id" ON "transactions" ("source_user_id");
CREATE INDEX IF NOT EXISTS "idx_transactions_type_status" ON "transactions" ("type", "status");

-- Таблица для реферальной системы
CREATE TABLE IF NOT EXISTS "referrals" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users" ("id"),
  "inviter_id" INTEGER NOT NULL REFERENCES "users" ("id"),
  "level" INTEGER NOT NULL,
  "reward_uni" NUMERIC(18, 6),
  "ref_path" JSONB[],
  "created_at" TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_referrals_user_id" ON "referrals" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_referrals_inviter_id" ON "referrals" ("inviter_id");
CREATE INDEX IF NOT EXISTS "idx_referrals_user_inviter" ON "referrals" ("user_id", "inviter_id");
CREATE INDEX IF NOT EXISTS "idx_referrals_level" ON "referrals" ("level");

-- Таблица для заданий (миссий)
CREATE TABLE IF NOT EXISTS "missions" (
  "id" SERIAL PRIMARY KEY,
  "type" TEXT,
  "title" TEXT,
  "description" TEXT,
  "reward_uni" NUMERIC(18, 6),
  "is_active" BOOLEAN DEFAULT true
);

-- Таблица для отслеживания выполнения заданий пользователями
CREATE TABLE IF NOT EXISTS "user_missions" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER REFERENCES "users" ("id"),
  "mission_id" INTEGER REFERENCES "missions" ("id"),
  "completed_at" TIMESTAMP DEFAULT NOW()
);

-- Таблица для хранения UNI фарминг-депозитов
CREATE TABLE IF NOT EXISTS "uni_farming_deposits" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users" ("id"),
  "amount" NUMERIC(18, 6) NOT NULL,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "rate_per_second" NUMERIC(20, 18) NOT NULL,
  "last_updated_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "is_active" BOOLEAN DEFAULT true
);

-- Таблица для хранения TON Boost-депозитов
CREATE TABLE IF NOT EXISTS "ton_boost_deposits" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users" ("id"),
  "ton_amount" NUMERIC(18, 5) NOT NULL,
  "bonus_uni" NUMERIC(18, 6) NOT NULL,
  "rate_ton_per_second" NUMERIC(20, 18) NOT NULL,
  "rate_uni_per_second" NUMERIC(20, 18) NOT NULL,
  "accumulated_ton" NUMERIC(18, 10) DEFAULT '0',
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "last_updated_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "is_active" BOOLEAN DEFAULT true
);

-- Таблица для логирования запусков Mini App
CREATE TABLE IF NOT EXISTS "launch_logs" (
  "id" SERIAL PRIMARY KEY,
  "telegram_user_id" BIGINT,
  "ref_code" TEXT,
  "platform" TEXT,
  "timestamp" TIMESTAMP DEFAULT NOW() NOT NULL,
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
  "timestamp" TIMESTAMP DEFAULT NOW() NOT NULL,
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
  "timestamp" TIMESTAMP DEFAULT NOW() NOT NULL,
  "details" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_performance_metrics_timestamp" ON "performance_metrics" ("timestamp");
CREATE INDEX IF NOT EXISTS "idx_performance_metrics_operation" ON "performance_metrics" ("operation");
CREATE INDEX IF NOT EXISTS "idx_performance_metrics_batch_id" ON "performance_metrics" ("batch_id");
`;

  // Сохраняем SQL в файл для отслеживания
  fs.mkdirSync(SQL_LOGS_DIR, { recursive: true });
  fs.writeFileSync(MIGRATION_FILE, sql);
  
  log(`Ручная миграция сохранена в файл: ${MIGRATION_FILE}`, colors.green);
  
  return sql;
}

// Функция для выполнения SQL-запросов
async function executeSQL(sql) {
  const pool = new Pool(dbConfig);
  
  try {
    log('Подключение к базе данных...', colors.blue);
    
    const client = await pool.connect();
    log('Соединение установлено', colors.green);
    
    try {
      // Разделяем SQL на отдельные запросы
      const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
      
      log(`Выполнение ${statements.length} SQL-запросов...`, colors.blue);
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i].trim();
        if (!statement) continue;
        
        try {
          log(`Выполнение запроса ${i + 1}/${statements.length}...`, colors.cyan);
          await client.query(statement + ';');
          log(`✅ Запрос ${i + 1}/${statements.length} успешно выполнен`, colors.green);
        } catch (error) {
          // Если ошибка связана с уже существующим объектом, продолжаем
          if (error.message.includes('already exists')) {
            log(`⚠️ Запрос ${i + 1}/${statements.length} пропущен: объект уже существует`, colors.yellow);
          } else {
            // Для других ошибок выводим предупреждение и продолжаем
            log(`⚠️ Ошибка в запросе ${i + 1}/${statements.length}: ${error.message}`, colors.red);
          }
        }
      }
      
      log('Миграция базы данных завершена успешно', colors.green);
    } finally {
      client.release();
    }
  } catch (error) {
    log(`Критическая ошибка: ${error.message}`, colors.red);
    throw error;
  } finally {
    await pool.end();
  }
}

// Функция для проверки таблиц в базе данных
async function checkDatabaseTables() {
  const pool = new Pool(dbConfig);
  
  try {
    log('Проверка созданных таблиц...', colors.blue);
    
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name;
      `);
      
      log(`Найдено ${result.rows.length} таблиц:`, colors.green);
      
      result.rows.forEach((row, index) => {
        log(`  ${index + 1}. ${row.table_name}`, colors.reset);
      });
      
      return result.rows.length;
    } finally {
      client.release();
    }
  } catch (error) {
    log(`Ошибка при проверке таблиц: ${error.message}`, colors.red);
    return -1;
  } finally {
    await pool.end();
  }
}

// Главная функция
async function main() {
  log('=== Миграция базы данных Replit PostgreSQL ===', colors.magenta);
  
  try {
    // Получаем SQL для миграции
    const sql = await generateSchemaFromDrizzle();
    
    // Выполняем SQL
    await executeSQL(sql);
    
    // Проверяем таблицы после миграции
    const tableCount = await checkDatabaseTables();
    
    if (tableCount > 0) {
      log(`\n🎉 Миграция успешно завершена. Создано ${tableCount} таблиц.`, colors.green);
    } else {
      log('\n⚠️ Миграция выполнена, но таблицы не обнаружены. Проверьте ошибки выше.', colors.yellow);
    }
  } catch (error) {
    log(`\n❌ Миграция не выполнена: ${error.message}`, colors.red);
    process.exit(1);
  }
}

// Запускаем скрипт
main();