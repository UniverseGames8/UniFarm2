/**
 * Скрипт для создания партиционированной таблицы transactions в Neon DB
 * 
 * Создает партиции по месяцам и добавляет хранимые процедуры для управления ими
 */
require('dotenv').config({ path: '.env.neon' });
const { Pool } = require('pg');

// Функция для логирования с цветами
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

function log(message, color = colors.reset) {
  console.log(color + message + colors.reset);
}

async function createTransactionsPartitions() {
  log('='.repeat(60), colors.blue);
  log('🔧 СОЗДАНИЕ ПАРТИЦИОНИРОВАНИЯ ДЛЯ ТАБЛИЦЫ TRANSACTIONS', colors.bright + colors.blue);
  log('='.repeat(60), colors.blue);
  
  const CONNECTION_STRING = process.env.DATABASE_URL;
  if (!CONNECTION_STRING) {
    log('❌ Ошибка: переменная окружения DATABASE_URL не установлена.', colors.red);
    log('Убедитесь, что вы загрузили переменные из .env.neon', colors.yellow);
    return;
  }
  
  log(`📊 Используемая строка подключения: ${CONNECTION_STRING.replace(/:[^:]*@/, ':***@')}`, colors.yellow);
  
  const pool = new Pool({
    connectionString: CONNECTION_STRING,
    ssl: {
      rejectUnauthorized: false
    }
  });
  
  try {
    // Проверка соединения
    const timeResult = await pool.query('SELECT NOW() as time');
    log(`✅ Соединение установлено в ${timeResult.rows[0].time}`, colors.green);
    
    // Проверяем, партиционирована ли уже таблица transactions
    const isPartitioned = await checkIfPartitioned(pool);
    
    if (isPartitioned) {
      log('ℹ️ Таблица transactions уже партиционирована. Пропускаем создание.', colors.yellow);
      await listPartitions(pool);
      return;
    }
    
    // Спрашиваем подтверждение
    log('\n⚠️ ВНИМАНИЕ! Скрипт пересоздаст таблицу transactions и все данные будут потеряны!', colors.red);
    log('⚠️ Убедитесь, что у вас есть резервная копия данных перед продолжением!', colors.red);
    log('ℹ️ Продолжение через 5 секунд...', colors.yellow);
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Создаем резервную копию данных из таблицы transactions
    log('\n🔄 Создание резервной копии данных...', colors.yellow);
    const backupResult = await pool.query('SELECT * FROM transactions');
    log(`✅ Создана резервная копия с ${backupResult.rows.length} записями`, colors.green);
    
    // Удаляем старую таблицу
    log('\n🔄 Удаление существующей таблицы transactions...', colors.yellow);
    await pool.query('DROP TABLE IF EXISTS transactions CASCADE');
    log('✅ Таблица удалена', colors.green);
    
    // Создаем партиционированную таблицу
    log('\n🔄 Создание партиционированной таблицы transactions...', colors.yellow);
    
    await pool.query(`
      CREATE TABLE transactions (
        id SERIAL,
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
      ) PARTITION BY RANGE (created_at);
      
      -- Создаем индексы на партиционированной таблице
      CREATE INDEX idx_transactions_user_id ON transactions(user_id);
      CREATE INDEX idx_transactions_source_user_id ON transactions(source_user_id);
      CREATE INDEX idx_transactions_type_status ON transactions(type, status);
      CREATE INDEX idx_transactions_created_at ON transactions(created_at);
      
      -- Делаем id сквозным автоинкрементным
      CREATE SEQUENCE transactions_id_seq OWNED BY transactions.id;
      ALTER TABLE transactions ALTER COLUMN id SET DEFAULT nextval('transactions_id_seq');
    `);
    
    log('✅ Партиционированная таблица transactions создана', colors.green);
    
    // Создаем партиции для последних нескольких месяцев и следующих нескольких месяцев
    log('\n🔄 Создание партиций...', colors.yellow);
    
    // Получаем текущую дату
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    // Создаем партиции для 3 прошлых, текущего и 6 будущих месяцев
    for (let monthOffset = -3; monthOffset <= 6; monthOffset++) {
      let year = currentYear;
      let month = currentMonth + monthOffset;
      
      // Корректируем год и месяц, если выходим за пределы 0-11
      if (month < 0) {
        year--;
        month = 12 + month;
      }
      
      if (month > 11) {
        year++;
        month = month - 12;
      }
      
      const partitionName = `transactions_${year}_${String(month + 1).padStart(2, '0')}`;
      
      // Начало и конец месяца для партиции
      const startDate = new Date(year, month, 1).toISOString();
      const endDate = new Date(year, month + 1, 1).toISOString();
      
      // Создаем партицию
      await pool.query(`
        CREATE TABLE ${partitionName} PARTITION OF transactions
        FOR VALUES FROM ('${startDate}') TO ('${endDate}');
      `);
      
      log(`✅ Создана партиция ${partitionName} для периода ${startDate.slice(0, 10)} - ${endDate.slice(0, 10)}`, colors.green);
    }
    
    // Создаем партицию по умолчанию для всех остальных дат
    await pool.query(`
      CREATE TABLE transactions_default PARTITION OF transactions
      DEFAULT;
    `);
    
    log('✅ Создана партиция transactions_default для остальных дат', colors.green);
    
    // Восстанавливаем данные из резервной копии
    log('\n🔄 Восстановление данных из резервной копии...', colors.yellow);
    
    if (backupResult.rows.length > 0) {
      // Формируем массивы значений для массового вставки
      const columnsToInsert = Object.keys(backupResult.rows[0])
        .filter(col => col !== 'id') // Исключаем id, чтобы он генерировался автоматически
        .join(', ');
      
      const valuesList = backupResult.rows.map(row => {
        const values = Object.entries(row)
          .filter(([key, _]) => key !== 'id')
          .map(([_, value]) => {
            if (value === null) return 'NULL';
            if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
            if (value instanceof Date) return `'${value.toISOString()}'`;
            return value;
          });
        
        return `(${values.join(', ')})`;
      });
      
      // Разбиваем вставку на порции по 100 записей для предотвращения переполнения запроса
      const chunkSize = 100;
      for (let i = 0; i < valuesList.length; i += chunkSize) {
        const chunk = valuesList.slice(i, i + chunkSize);
        await pool.query(`
          INSERT INTO transactions (${columnsToInsert})
          VALUES ${chunk.join(',\n')}
        `);
      }
    }
    
    log(`✅ Восстановлено ${backupResult.rows.length} записей`, colors.green);
    
    // Создаем функции для автоматического управления партициями
    log('\n🔄 Создание функций для автоматического управления партициями...', colors.yellow);
    
    await pool.query(`
      -- Функция для создания партиций на будущие месяцы
      CREATE OR REPLACE FUNCTION create_future_transaction_partitions(months_ahead integer DEFAULT 3)
      RETURNS void AS $$
      DECLARE
          partition_date date;
          partition_name text;
          start_date timestamp;
          end_date timestamp;
      BEGIN
          FOR i IN 1..months_ahead LOOP
              partition_date := date_trunc('month', current_date + (i || ' month')::interval);
              partition_name := 'transactions_' || to_char(partition_date, 'YYYY_MM');
              start_date := date_trunc('month', partition_date);
              end_date := date_trunc('month', partition_date + '1 month'::interval);
              
              -- Проверяем, существует ли уже такая партиция
              PERFORM 1
              FROM pg_class c
              JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE c.relname = partition_name AND n.nspname = 'public';
              
              IF NOT FOUND THEN
                  -- Создаем партицию
                  EXECUTE format(
                      'CREATE TABLE %I PARTITION OF transactions FOR VALUES FROM (%L) TO (%L)',
                      partition_name, start_date, end_date
                  );
                  
                  -- Логируем создание партиции
                  INSERT INTO partition_logs (operation, partition_name, message, status)
                  VALUES ('CREATE', partition_name, format('Created partition for %s to %s', start_date, end_date), 'success');
              END IF;
          END LOOP;
      END;
      $$ LANGUAGE plpgsql;
      
      -- Функция для автоматического запуска по триггеру
      CREATE OR REPLACE FUNCTION check_and_create_transaction_partitions()
      RETURNS trigger AS $$
      BEGIN
          -- Проверяем раз в день, нужно ли создать новые партиции
          IF NOT EXISTS (
              SELECT 1 FROM partition_logs
              WHERE operation = 'AUTO_CHECK'
              AND date_trunc('day', timestamp) = date_trunc('day', current_timestamp)
          ) THEN
              -- Логируем проверку
              INSERT INTO partition_logs (operation, message, status)
              VALUES ('AUTO_CHECK', 'Automatic check for future partitions', 'success');
              
              -- Создаем партиции на 3 месяца вперед
              PERFORM create_future_transaction_partitions(3);
          END IF;
          
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      
      -- Создаем триггер для автоматической проверки и создания партиций
      DROP TRIGGER IF EXISTS trg_check_partitions ON transactions;
      CREATE TRIGGER trg_check_partitions
      AFTER INSERT ON transactions
      FOR EACH STATEMENT
      EXECUTE FUNCTION check_and_create_transaction_partitions();
    `);
    
    log('✅ Функции для управления партициями созданы', colors.green);
    
    // Проверяем, что все создано правильно
    log('\n📋 Проверка созданных партиций:', colors.blue);
    await listPartitions(pool);
    
    log('\n🎉 Партиционирование успешно создано!', colors.green);
    log('ℹ️ Теперь вы можете использовать функцию create_future_transaction_partitions() для создания партиций на будущие месяцы', colors.blue);
    
  } catch (error) {
    log(`❌ Ошибка: ${error.message}`, colors.red);
    console.error(error);
  } finally {
    await pool.end();
    log('\n📝 Операция завершена!', colors.blue);
  }
}

// Функция для проверки, партиционирована ли таблица transactions
async function checkIfPartitioned(pool) {
  try {
    const result = await pool.query(`
      SELECT p.relname as parent_table
      FROM pg_class p
      WHERE p.relname = 'transactions' AND p.relkind = 'p'
    `);
    
    return result.rows.length > 0;
  } catch (error) {
    return false;
  }
}

// Функция для вывода списка партиций
async function listPartitions(pool) {
  try {
    const partitions = await pool.query(`
      SELECT c.relname as partition_name,
             pg_get_expr(c.relpartbound, c.oid) as partition_expression
      FROM pg_inherits i
      JOIN pg_class p ON i.inhparent = p.oid
      JOIN pg_class c ON i.inhrelid = c.oid
      WHERE p.relname = 'transactions'
      ORDER BY c.relname
    `);
    
    if (partitions.rows.length === 0) {
      log('⚠️ Не найдено партиций для таблицы transactions', colors.yellow);
    } else {
      log(`✅ Найдено ${partitions.rows.length} партиций:`, colors.green);
      partitions.rows.forEach(partition => {
        log(`   - ${partition.partition_name}: ${partition.partition_expression}`, colors.green);
      });
    }
  } catch (error) {
    log(`❌ Ошибка при получении списка партиций: ${error.message}`, colors.red);
  }
}

// Запускаем скрипт
createTransactionsPartitions().catch(error => {
  console.error('Необработанная ошибка:', error);
});