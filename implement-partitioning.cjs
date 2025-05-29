/**
 * Скрипт для создания партиционирования таблицы transactions
 * 
 * ВАЖНО: Этот скрипт создаст партиционирование с нуля!
 * Если у вас есть данные в таблице transactions, они будут сохранены
 * во временной таблице и затем перенесены обратно после преобразования.
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

// Функция для выполнения SQL запросов
async function executeQuery(query, params = []) {
  try {
    const result = await pool.query(query, params);
    return result;
  } catch (error) {
    console.error(`SQL ошибка: ${error.message}`);
    console.error(`Запрос: ${query}`);
    throw error;
  }
}

// Проверяет существование таблицы
async function checkTableExists(tableName) {
  const query = `
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    );
  `;
  
  const result = await executeQuery(query, [tableName]);
  return result.rows[0].exists;
}

// Проверяет, является ли таблица партиционированной
async function isTablePartitioned(tableName) {
  try {
    const query = `
      SELECT pt.relname as parent_table, 
             c.relname as child_table,
             pg_get_expr(c.relpartbound, c.oid) as partition_expression
      FROM pg_inherits i
      JOIN pg_class pt ON pt.oid = i.inhparent
      JOIN pg_class c ON c.oid = i.inhrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE pt.relname = $1 
      AND n.nspname = 'public'
      LIMIT 1;
    `;
    
    const result = await executeQuery(query, [tableName]);
    return (result.rowCount || 0) > 0;
  } catch (error) {
    console.error('Ошибка при проверке партиционирования:', error);
    return false;
  }
}

// Создает партицию для указанной даты
async function createPartitionForDate(date) {
  const dateStr = format(date, 'yyyy_MM_dd');
  const partitionName = `transactions_${dateStr}`;
  
  const startDate = format(date, 'yyyy-MM-dd');
  const endDate = format(addDays(date, 1), 'yyyy-MM-dd');
  
  console.log(`[Migration] Создание партиции ${partitionName} для даты ${startDate}`);
  
  // Создаем партицию
  const query = `
    CREATE TABLE IF NOT EXISTS ${partitionName}
    PARTITION OF transactions
    FOR VALUES FROM ('${startDate}') TO ('${endDate}');
  `;
  
  await executeQuery(query);
  
  // Создаем индексы для партиции
  console.log(`[Migration] Создание индексов для партиции ${partitionName}`);
  
  try {
    await executeQuery(`CREATE INDEX IF NOT EXISTS ${partitionName}_user_id_idx ON ${partitionName} (user_id)`);
  } catch (err) {
    console.warn(`[Migration] Предупреждение: не удалось создать индекс user_id - ${err.message}`);
  }

  try {
    await executeQuery(`CREATE INDEX IF NOT EXISTS ${partitionName}_type_idx ON ${partitionName} (type)`);
  } catch (err) {
    console.warn(`[Migration] Предупреждение: не удалось создать индекс type - ${err.message}`);
  }

  try {
    await executeQuery(`CREATE INDEX IF NOT EXISTS ${partitionName}_created_at_idx ON ${partitionName} (created_at)`);
  } catch (err) {
    console.warn(`[Migration] Предупреждение: не удалось создать индекс created_at - ${err.message}`);
  }
  
  console.log(`[Migration] Партиция ${partitionName} создана успешно`);
}

// Создает или проверяет таблицу partition_logs
async function ensurePartitionLogsTable() {
  // Проверяем, существует ли таблица partition_logs
  const tableExists = await checkTableExists('partition_logs');
  
  if (!tableExists) {
    console.log('[Migration] Создание таблицы partition_logs');
    
    await executeQuery(`
      CREATE TABLE partition_logs (
        id SERIAL PRIMARY KEY,
        operation VARCHAR(50) NOT NULL,
        partition_name VARCHAR(100) NOT NULL,
        status VARCHAR(20) NOT NULL,
        notes TEXT,
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    
    // Создаем индексы для таблицы
    await executeQuery('CREATE INDEX partition_logs_operation_idx ON partition_logs (operation)');
    await executeQuery('CREATE INDEX partition_logs_partition_name_idx ON partition_logs (partition_name)');
    await executeQuery('CREATE INDEX partition_logs_status_idx ON partition_logs (status)');
    await executeQuery('CREATE INDEX partition_logs_created_at_idx ON partition_logs (created_at)');
    
    console.log('[Migration] Таблица partition_logs создана успешно');
  } else {
    console.log('[Migration] Таблица partition_logs уже существует');
  }
}

// Добавляет запись в журнал операций с партициями
async function logPartitionOperation(operation, partitionName, status, notes, errorMessage) {
  await executeQuery(`
    INSERT INTO partition_logs 
    (operation, partition_name, status, notes, error_message) 
    VALUES 
    ($1, $2, $3, $4, $5)
  `, [operation, partitionName, status, notes, errorMessage]);
}

// Основная функция миграции
async function runMigration() {
  try {
    console.log('[Migration] Начало миграции: Преобразование таблицы transactions в партиционированную');
    
    // Проверяем, существует ли таблица transactions
    const transactionsExist = await checkTableExists('transactions');
    
    if (!transactionsExist) {
      console.log('[Migration] Таблица transactions не существует. Невозможно продолжить миграцию.');
      return;
    }
    
    // Проверяем, является ли таблица уже партиционированной
    const isPartitioned = await isTablePartitioned('transactions');
    
    if (isPartitioned) {
      console.log('[Migration] Таблица transactions уже партиционирована. Пропускаем миграцию.');
      return;
    }
    
    // Создаем или проверяем таблицу partition_logs
    await ensurePartitionLogsTable();
    
    // Начинаем транзакцию
    await executeQuery('BEGIN');
    
    try {
      console.log('[Migration] Создание временной таблицы для данных transactions');
      await executeQuery(`
        CREATE TABLE transactions_temp (
          id SERIAL PRIMARY KEY,
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
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      
      console.log('[Migration] Копирование данных из transactions во временную таблицу');
      await executeQuery(`
        INSERT INTO transactions_temp 
        (id, user_id, amount, type, currency, status, source, category, tx_hash, 
         description, source_user_id, data, wallet_address, created_at)
        SELECT id, user_id, amount, type, currency, status, source, category, tx_hash, 
               description, source_user_id, data, wallet_address, created_at
        FROM transactions
      `);
      
      // Получаем текущий max id для сброса sequence
      const maxIdResult = await executeQuery('SELECT MAX(id) FROM transactions');
      const maxId = maxIdResult.rows[0].max || 0;
      
      console.log(`[Migration] Текущий максимальный ID транзакции: ${maxId}`);
      
      console.log('[Migration] Удаление старой таблицы transactions');
      await executeQuery('DROP TABLE transactions');
      
      console.log('[Migration] Создание новой партиционированной таблицы transactions');
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
        ) PARTITION BY RANGE (created_at)
      `);
      
      // Создаем партиции на текущий день и 5 дней вперед
      const today = new Date();
      for (let i = 0; i < 5; i++) {
        const date = addDays(today, i);
        await createPartitionForDate(date);
      }
      
      console.log('[Migration] Копирование данных обратно из временной таблицы в партиционированную');
      await executeQuery(`
        INSERT INTO transactions 
        (id, user_id, amount, type, currency, status, source, category, tx_hash, 
         description, source_user_id, data, wallet_address, created_at)
        SELECT id, user_id, amount, type, currency, status, source, category, tx_hash, 
               description, source_user_id, data, wallet_address, created_at
        FROM transactions_temp
      `);
      
      console.log('[Migration] Сброс transactions_id_seq');
      await executeQuery(`SELECT setval('transactions_id_seq', ${maxId}, true)`);
      
      console.log('[Migration] Удаление временной таблицы');
      await executeQuery('DROP TABLE transactions_temp');
      
      // Создаем партиции для более старых данных, если они есть
      console.log('[Migration] Создание партиций для старых данных, если необходимо');
      const oldestDateResult = await executeQuery(`
        SELECT DATE_TRUNC('day', MIN(created_at)) as oldest_date
        FROM transactions
      `);
      
      const oldestDate = oldestDateResult.rows[0].oldest_date;
      if (oldestDate && new Date(oldestDate) < today) {
        console.log(`[Migration] Самая старая дата транзакции: ${oldestDate}`);
        
        // Создаем партицию для всех старых записей
        const oldestDateStr = format(new Date(oldestDate), 'yyyy_MM_dd');
        const oldPartitionName = `transactions_old_before_${oldestDateStr}`;
        
        console.log(`[Migration] Создание партиции ${oldPartitionName} для всех старых данных`);
        await executeQuery(`
          CREATE TABLE IF NOT EXISTS ${oldPartitionName}
          PARTITION OF transactions
          FOR VALUES FROM (MINVALUE) TO ('${format(today, 'yyyy-MM-dd')}');
        `);
        
        // Создаем индексы для старой партиции
        console.log(`[Migration] Создание индексов для партиции ${oldPartitionName}`);
        try {
          await executeQuery(`CREATE INDEX IF NOT EXISTS ${oldPartitionName}_user_id_idx ON ${oldPartitionName} (user_id)`);
          await executeQuery(`CREATE INDEX IF NOT EXISTS ${oldPartitionName}_type_idx ON ${oldPartitionName} (type)`);
          await executeQuery(`CREATE INDEX IF NOT EXISTS ${oldPartitionName}_created_at_idx ON ${oldPartitionName} (created_at)`);
        } catch (err) {
          console.warn(`[Migration] Предупреждение при создании индексов для ${oldPartitionName}: ${err.message}`);
        }
      }
      
      // Создаем партицию для будущих записей
      console.log('[Migration] Создание партиции по умолчанию для будущих данных');
      const futurePartitionName = 'transactions_future';
      await executeQuery(`
        CREATE TABLE IF NOT EXISTS ${futurePartitionName}
        PARTITION OF transactions
        FOR VALUES FROM ('${format(addDays(today, 5), 'yyyy-MM-dd')}') TO (MAXVALUE);
      `);
      
      // Создаем индексы для будущей партиции
      console.log(`[Migration] Создание индексов для будущей партиции ${futurePartitionName}`);
      try {
        await executeQuery(`CREATE INDEX IF NOT EXISTS ${futurePartitionName}_user_id_idx ON ${futurePartitionName} (user_id)`);
        await executeQuery(`CREATE INDEX IF NOT EXISTS ${futurePartitionName}_type_idx ON ${futurePartitionName} (type)`);
        await executeQuery(`CREATE INDEX IF NOT EXISTS ${futurePartitionName}_created_at_idx ON ${futurePartitionName} (created_at)`);
      } catch (err) {
        console.warn(`[Migration] Предупреждение при создании индексов для ${futurePartitionName}: ${err.message}`);
      }
      
      // Добавляем запись в таблицу partition_logs
      console.log('[Migration] Добавление записи в таблицу partition_logs');
      await logPartitionOperation(
        'initial_setup', 
        'transactions', 
        'success', 
        'Начальная настройка партиционирования завершена успешно', 
        null
      );
      
      console.log('[Migration] Фиксация транзакции');
      await executeQuery('COMMIT');
      
      console.log('[Migration] Миграция завершена успешно');
    } catch (error) {
      console.log('[Migration] Ошибка во время миграции. Откат.');
      await executeQuery('ROLLBACK');
      
      // Логируем ошибку
      try {
        await logPartitionOperation(
          'initial_setup', 
          'transactions', 
          'error', 
          'Ошибка при настройке партиционирования', 
          error.message
        );
      } catch (logError) {
        console.error('[Migration] Не удалось записать ошибку в журнал:', logError.message);
      }
      
      throw error;
    }
  } catch (error) {
    console.error(`[Migration] Миграция не удалась: ${error.message}`);
    console.error(error);
    throw error;
  } finally {
    // Закрываем соединение с базой данных
    await pool.end();
  }
}

// Запускаем миграцию
console.log('🚀 Запуск миграции партиционирования для Neon DB...');

runMigration()
  .then(() => {
    console.log('✅ Миграция выполнена успешно!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка при выполнении миграции:', error);
    process.exit(1);
  });