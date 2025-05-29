/**
 * Скрипт для создания партиционированной таблицы transactions
 * 
 * Этот скрипт добавляет поддержку партиционирования для таблицы transactions,
 * что позволяет эффективно работать с большим объемом данных
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const { execSync } = require('child_process');

// Цвета для вывода
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

/**
 * Вывод сообщения в консоль с цветом
 */
function log(message, color = colors.reset) {
  console.log(color + message + colors.reset);
}

/**
 * Загрузка переменных окружения из .env.replit
 */
function loadEnvFromReplit() {
  const replitEnvPath = path.join(process.cwd(), '.env.replit');
  
  if (!fs.existsSync(replitEnvPath)) {
    log(`❌ Файл .env.replit не найден!`, colors.red);
    process.exit(1);
  }
  
  log(`📝 Загрузка переменных окружения из .env.replit...`, colors.blue);
  const envConfig = dotenv.parse(fs.readFileSync(replitEnvPath));
  
  // Устанавливаем принудительное использование Replit PostgreSQL
  envConfig.DATABASE_PROVIDER = 'replit';
  envConfig.USE_LOCAL_DB_ONLY = 'true';
  
  // Применяем переменные окружения
  for (const key in envConfig) {
    process.env[key] = envConfig[key];
  }
  
  log(`✅ Переменные окружения успешно загружены из .env.replit`, colors.green);
}

/**
 * Проверяет, запущен ли PostgreSQL
 */
function checkPostgreSQLRunning() {
  log(`🔍 Проверка состояния PostgreSQL...`, colors.blue);
  
  try {
    const pgSocketPath = process.env.PGSOCKET || path.join(process.env.HOME, '.postgresql', 'sockets');
    const result = execSync(`PGHOST=${pgSocketPath} PGUSER=${process.env.PGUSER} psql -d postgres -c "SELECT 1" -t`).toString().trim();
    
    if (result === '1') {
      log(`✅ PostgreSQL запущен и доступен`, colors.green);
      return true;
    } else {
      log(`⚠️ PostgreSQL запущен, но возвращает неожиданный результат: ${result}`, colors.yellow);
      return false;
    }
  } catch (err) {
    log(`❌ PostgreSQL не запущен или недоступен: ${err.message}`, colors.red);
    return false;
  }
}

/**
 * Запускает PostgreSQL через скрипт start-postgres.sh
 */
function startPostgreSQL() {
  log(`🚀 Запуск PostgreSQL...`, colors.blue);
  
  try {
    execSync('bash ./start-postgres.sh', { stdio: 'inherit' });
    log(`✅ PostgreSQL успешно запущен`, colors.green);
    return true;
  } catch (err) {
    log(`❌ Не удалось запустить PostgreSQL: ${err.message}`, colors.red);
    return false;
  }
}

/**
 * Создает партиционированную схему для таблицы transactions
 */
async function createPartitionSchema() {
  log(`\n${colors.blue}=== Создание партиционированной схемы ===${colors.reset}`);
  
  // Создаем подключение к базе данных
  const pgSocketPath = process.env.PGSOCKET || path.join(process.env.HOME, '.postgresql', 'sockets');
  const pool = new Pool({
    host: pgSocketPath,
    user: process.env.PGUSER || 'runner',
    database: process.env.PGDATABASE || 'postgres',
    password: process.env.PGPASSWORD || '',
    port: parseInt(process.env.PGPORT || '5432'),
  });
  
  try {
    // Проверяем, существует ли таблица transactions
    const existsResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'transactions'
      )
    `);
    
    const tableExists = existsResult.rows[0].exists;
    if (!tableExists) {
      log(`❌ Таблица transactions не существует, сначала создайте базовую схему`, colors.red);
      return false;
    }
    
    // Проверяем, является ли таблица transactions уже партиционированной
    const partitionResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM pg_partitioned_table pt
        JOIN pg_class c ON c.oid = pt.partrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'transactions'
      )
    `);
    
    const isPartitioned = partitionResult.rows[0].exists;
    if (isPartitioned) {
      log(`✅ Таблица transactions уже партиционирована`, colors.green);
      return true;
    }
    
    // Получаем данные из таблицы transactions перед удалением
    log(`📊 Сохранение данных из таблицы transactions...`, colors.blue);
    const dataResult = await pool.query(`SELECT * FROM transactions`);
    const transactions = dataResult.rows;
    log(`📊 Сохранено ${transactions.length} транзакций`, colors.blue);
    
    // Создаем временную таблицу и сохраняем данные
    log(`📦 Создание временной таблицы...`, colors.blue);
    await pool.query(`CREATE TABLE transactions_temp AS SELECT * FROM transactions`);
    
    // Удаляем старую таблицу
    log(`🔄 Удаление старой таблицы transactions...`, colors.blue);
    await pool.query(`DROP TABLE transactions CASCADE`);
    
    // Создаем новую партиционированную таблицу
    log(`🔄 Создание новой партиционированной таблицы transactions...`, colors.blue);
    await pool.query(`
      CREATE TABLE transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        type TEXT,
        currency TEXT,
        amount NUMERIC(18, 6),
        status TEXT DEFAULT 'confirmed',
        source TEXT,
        category TEXT,
        tx_hash TEXT,
        description TEXT,
        source_user_id INTEGER,
        wallet_address TEXT,
        data TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      ) PARTITION BY RANGE (created_at)
    `);
    
    // Создаем партиции для различных периодов
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    // Создаем партиции для прошлых месяцев и будущего месяца
    log(`🔄 Создание партиций по месяцам...`, colors.blue);
    
    // Партиция для данных до текущего года
    await pool.query(`
      CREATE TABLE transactions_before_${currentYear} PARTITION OF transactions
      FOR VALUES FROM (MINVALUE) TO ('${currentYear}-01-01')
    `);
    
    // Партиции для каждого месяца текущего года до текущего месяца
    for (let month = 1; month < currentMonth; month++) {
      const nextMonth = month + 1;
      const monthStr = month.toString().padStart(2, '0');
      const nextMonthStr = nextMonth.toString().padStart(2, '0');
      
      await pool.query(`
        CREATE TABLE transactions_${currentYear}_${monthStr} PARTITION OF transactions
        FOR VALUES FROM ('${currentYear}-${monthStr}-01') TO ('${currentYear}-${nextMonthStr}-01')
      `);
    }
    
    // Партиция для текущего месяца
    const nextMonth = currentMonth + 1 > 12 ? 1 : currentMonth + 1;
    const nextYear = currentMonth + 1 > 12 ? currentYear + 1 : currentYear;
    const currentMonthStr = currentMonth.toString().padStart(2, '0');
    const nextMonthStr = nextMonth.toString().padStart(2, '0');
    
    await pool.query(`
      CREATE TABLE transactions_${currentYear}_${currentMonthStr} PARTITION OF transactions
      FOR VALUES FROM ('${currentYear}-${currentMonthStr}-01') TO ('${nextYear}-${nextMonthStr}-01')
    `);
    
    // Партиция для следующего месяца
    const afterNextMonth = nextMonth + 1 > 12 ? 1 : nextMonth + 1;
    const afterNextYear = nextMonth + 1 > 12 ? nextYear + 1 : nextYear;
    
    await pool.query(`
      CREATE TABLE transactions_${nextYear}_${nextMonthStr} PARTITION OF transactions
      FOR VALUES FROM ('${nextYear}-${nextMonthStr}-01') TO ('${afterNextYear}-${afterNextMonth.toString().padStart(2, '0')}-01')
    `);
    
    // Партиция для будущих данных
    await pool.query(`
      CREATE TABLE transactions_future PARTITION OF transactions
      FOR VALUES FROM ('${afterNextYear}-${afterNextMonth.toString().padStart(2, '0')}-01') TO (MAXVALUE)
    `);
    
    // Создаем индексы для партиционированной таблицы
    log(`📝 Создание индексов для партиционированной таблицы...`, colors.blue);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions (user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_transactions_source_user_id ON transactions (source_user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_transactions_type_status ON transactions (type, status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions (created_at)`);
    
    // Восстанавливаем данные из временной таблицы
    if (transactions.length > 0) {
      log(`🔄 Восстановление данных из временной таблицы...`, colors.blue);
      await pool.query(`INSERT INTO transactions SELECT * FROM transactions_temp`);
      log(`✅ Восстановлено ${transactions.length} транзакций`, colors.green);
    }
    
    // Удаляем временную таблицу
    log(`🧹 Удаление временной таблицы...`, colors.blue);
    await pool.query(`DROP TABLE transactions_temp`);
    
    // Создаем таблицу для логов партиционирования, если еще не создана
    log(`📝 Проверка наличия таблицы partition_logs...`, colors.blue);
    const logsExistResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'partition_logs'
      )
    `);
    
    if (!logsExistResult.rows[0].exists) {
      log(`📝 Создание таблицы partition_logs...`, colors.blue);
      await pool.query(`
        CREATE TABLE partition_logs (
          id SERIAL PRIMARY KEY,
          operation TEXT NOT NULL,
          partition_name TEXT,
          message TEXT NOT NULL,
          timestamp TIMESTAMP DEFAULT NOW() NOT NULL,
          status TEXT NOT NULL,
          error_details TEXT
        )
      `);
    }
    
    // Добавляем запись в логи о успешном создании партиционной схемы
    await pool.query(`
      INSERT INTO partition_logs 
      (operation, message, status) 
      VALUES 
      ('schema_creation', 'Партиционная схема успешно создана', 'success')
    `);
    
    log(`✅ Партиционная схема для таблицы transactions успешно создана`, colors.green);
    return true;
  } catch (error) {
    log(`❌ Ошибка при создании партиционной схемы: ${error.message}`, colors.red);
    console.error(error);
    
    // Пытаемся добавить запись в логи о неудачной попытке
    try {
      await pool.query(`
        INSERT INTO partition_logs 
        (operation, message, status, error_details) 
        VALUES 
        ('schema_creation', 'Ошибка при создании партиционной схемы', 'error', $1)
      `, [error.message]);
    } catch (logError) {
      log(`⚠️ Не удалось записать ошибку в логи: ${logError.message}`, colors.yellow);
    }
    
    return false;
  } finally {
    // Закрываем подключение
    await pool.end();
  }
}

/**
 * Основная функция
 */
async function main() {
  // Показываем заголовок
  log(`\n${colors.magenta}=============================================${colors.reset}`);
  log(`${colors.magenta}= СОЗДАНИЕ ПАРТИЦИОНИРОВАНИЯ ДЛЯ REPLIT PG =${colors.reset}`);
  log(`${colors.magenta}=============================================${colors.reset}\n`);
  
  // Загружаем переменные окружения
  loadEnvFromReplit();
  
  // Проверяем, запущен ли PostgreSQL
  if (!checkPostgreSQLRunning()) {
    log(`🔄 PostgreSQL не запущен, пытаемся запустить...`, colors.yellow);
    if (!startPostgreSQL()) {
      log(`❌ Не удалось запустить PostgreSQL, операция невозможна`, colors.red);
      process.exit(1);
    }
  }
  
  // Создаем партиционную схему
  if (await createPartitionSchema()) {
    log(`\n${colors.green}✅ Партиционная схема успешно создана!${colors.reset}`);
  } else {
    log(`\n${colors.red}❌ Не удалось создать партиционную схему${colors.reset}`);
    process.exit(1);
  }
}

// Запускаем основную функцию
main().catch(err => {
  log(`\n❌ Критическая ошибка: ${err.message}`, colors.red);
  console.error(err);
  process.exit(1);
});