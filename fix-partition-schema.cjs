/**
 * Скрипт для настройки партиционирования таблицы transactions
 * 
 * 1. Создает резервную копию таблицы transactions
 * 2. Пересоздает таблицу transactions с партиционированием по дате
 * 3. Создает партиции для необходимых периодов
 * 4. Восстанавливает данные из резервной копии
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

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

// Функция логирования
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// Функция для получения клиента из пула
async function getClient() {
  const pool = new Pool(dbConfig);
  return await pool.connect();
}

// Функция для логирования операций с партициями
async function logPartitionOperation(client, operation, partitionName, message, status, errorDetails = null) {
  try {
    await client.query(
      `INSERT INTO partition_logs (operation, partition_name, message, status, error_details)
       VALUES ($1, $2, $3, $4, $5)`,
      [operation, partitionName, message, status, errorDetails]
    );
  } catch (error) {
    // Если таблица partition_logs не существует, создаем её
    if (error.message.includes('relation "partition_logs" does not exist')) {
      await client.query(`
        CREATE TABLE IF NOT EXISTS partition_logs (
          id SERIAL PRIMARY KEY,
          operation TEXT NOT NULL,
          partition_name TEXT,
          message TEXT NOT NULL,
          timestamp TIMESTAMP DEFAULT NOW() NOT NULL,
          status TEXT NOT NULL,
          error_details TEXT
        );
      `);
      
      await client.query(
        `INSERT INTO partition_logs (operation, partition_name, message, status, error_details)
         VALUES ($1, $2, $3, $4, $5)`,
        [operation, partitionName, message, status, errorDetails]
      );
    } else {
      log(`Ошибка при логировании операции с партициями: ${error.message}`, colors.red);
    }
  }
}

// Функция для проверки, партиционирована ли таблица transactions
async function isTablePartitioned(client) {
  try {
    const result = await client.query(
      `SELECT pc.relispartition
       FROM pg_class pc
       JOIN pg_namespace pn ON pc.relnamespace = pn.oid
       WHERE pc.relname = 'transactions' AND pn.nspname = 'public'`
    );
    
    if (result.rows.length > 0) {
      return result.rows[0].relispartition;
    }
    
    return false;
  } catch (error) {
    log(`Ошибка при проверке партиционирования: ${error.message}`, colors.red);
    return false;
  }
}

// Функция для проверки существования таблицы transactions_backup
async function backupTableExists(client) {
  try {
    const result = await client.query(
      `SELECT EXISTS (
         SELECT FROM pg_tables 
         WHERE schemaname = 'public' 
         AND tablename = 'transactions_backup'
       )`
    );
    
    return result.rows[0].exists;
  } catch (error) {
    log(`Ошибка при проверке существования резервной таблицы: ${error.message}`, colors.red);
    return false;
  }
}

// Функция для создания резервной копии таблицы transactions
async function backupTransactionsTable(client) {
  try {
    log('Создание резервной копии таблицы transactions...', colors.blue);
    
    // Проверяем существование резервной таблицы
    const backupExists = await backupTableExists(client);
    
    if (backupExists) {
      log('Резервная таблица transactions_backup уже существует', colors.yellow);
      return true;
    }
    
    // Проверяем наличие данных в таблице transactions
    const dataResult = await client.query('SELECT COUNT(*) FROM transactions');
    const rowCount = parseInt(dataResult.rows[0].count);
    
    log(`Найдено ${rowCount} транзакций для резервного копирования`, colors.blue);
    
    if (rowCount > 0) {
      // Создаем резервную таблицу
      await client.query(`
        CREATE TABLE transactions_backup AS
        SELECT * FROM transactions;
      `);
      
      // Проверяем, что данные были скопированы
      const backupResult = await client.query('SELECT COUNT(*) FROM transactions_backup');
      const backupCount = parseInt(backupResult.rows[0].count);
      
      if (backupCount === rowCount) {
        log(`Успешно создана резервная копия таблицы transactions с ${rowCount} записями`, colors.green);
        
        // Логируем операцию
        await logPartitionOperation(
          client, 
          'BACKUP', 
          'transactions_backup', 
          `Создана резервная копия с ${rowCount} транзакциями`, 
          'success'
        );
        
        return true;
      } else {
        const errorMsg = `Количество скопированных записей (${backupCount}) не соответствует оригиналу (${rowCount})`;
        log(errorMsg, colors.red);
        
        // Логируем ошибку
        await logPartitionOperation(
          client, 
          'BACKUP', 
          'transactions_backup', 
          errorMsg, 
          'error', 
          'Несоответствие количества записей'
        );
        
        return false;
      }
    } else {
      log('Таблица transactions пуста, создаем пустую резервную копию', colors.yellow);
      
      // Создаем пустую резервную таблицу со структурой
      await client.query(`
        CREATE TABLE transactions_backup AS
        SELECT * FROM transactions WHERE 1=0;
      `);
      
      // Логируем операцию
      await logPartitionOperation(
        client, 
        'BACKUP', 
        'transactions_backup', 
        'Создана пустая резервная копия (таблица transactions пуста)', 
        'success'
      );
      
      return true;
    }
  } catch (error) {
    log(`Ошибка при создании резервной копии: ${error.message}`, colors.red);
    
    // Логируем ошибку
    await logPartitionOperation(
      client, 
      'BACKUP', 
      'transactions_backup', 
      `Ошибка при создании резервной копии: ${error.message}`, 
      'error', 
      error.stack
    );
    
    return false;
  }
}

// Функция для пересоздания таблицы transactions с партиционированием
async function recreateTransactionsTableWithPartitioning(client) {
  try {
    log('Пересоздание таблицы transactions с партиционированием...', colors.blue);
    
    // Удаляем существующую таблицу transactions
    await client.query('DROP TABLE IF EXISTS transactions CASCADE');
    
    // Создаем новую таблицу с партиционированием по дате
    await client.query(`
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
      ) PARTITION BY RANGE (created_at);
    `);
    
    // Создаем необходимые индексы на родительской таблице
    await client.query('CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_transactions_source_user_id ON transactions(source_user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_transactions_type_status ON transactions(type, status)');
    
    // Логируем успешную операцию
    await logPartitionOperation(
      client, 
      'CREATE', 
      'transactions', 
      'Пересоздана таблица transactions с партиционированием по дате', 
      'success'
    );
    
    log('Таблица transactions успешно пересоздана с партиционированием по дате', colors.green);
    return true;
  } catch (error) {
    log(`Ошибка при пересоздании таблицы: ${error.message}`, colors.red);
    
    // Логируем ошибку
    await logPartitionOperation(
      client, 
      'CREATE', 
      'transactions', 
      `Ошибка при пересоздании таблицы: ${error.message}`, 
      'error', 
      error.stack
    );
    
    return false;
  }
}

// Функция для создания партиции
async function createPartition(client, startDate, endDate) {
  const partitionName = `transactions_${startDate.replace(/-/g, '_')}`;
  
  try {
    // Формируем SQL-запрос для создания партиции
    const sql = `
      CREATE TABLE IF NOT EXISTS ${partitionName} PARTITION OF transactions
      FOR VALUES FROM ('${startDate}') TO ('${endDate}');
    `;
    
    await client.query(sql);
    
    // Создаем индексы на партиции для оптимизации запросов
    await client.query(`CREATE INDEX IF NOT EXISTS idx_${partitionName}_user_id ON ${partitionName}(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_${partitionName}_created_at ON ${partitionName}(created_at)`);
    
    // Логируем успешную операцию
    await logPartitionOperation(
      client, 
      'CREATE', 
      partitionName, 
      `Создана партиция для диапазона дат: ${startDate} - ${endDate}`, 
      'success'
    );
    
    log(`Партиция ${partitionName} успешно создана для диапазона: ${startDate} - ${endDate}`, colors.green);
    return true;
  } catch (error) {
    log(`Ошибка при создании партиции ${partitionName}: ${error.message}`, colors.red);
    
    // Логируем ошибку
    await logPartitionOperation(
      client, 
      'CREATE', 
      partitionName, 
      `Ошибка при создании партиции: ${error.message}`, 
      'error', 
      error.stack
    );
    
    return false;
  }
}

// Функция для создания партиций для заданного периода
async function createPartitionsForPeriod(client, startDate, endDate, interval = 'month') {
  try {
    log(`Создание ${interval} партиций для периода: ${startDate} - ${endDate}...`, colors.blue);
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    let current = new Date(start);
    
    let successCount = 0;
    let errorCount = 0;
    
    while (current < end) {
      // Определяем конец текущего интервала
      let nextDate = new Date(current);
      
      if (interval === 'month') {
        nextDate.setMonth(nextDate.getMonth() + 1);
      } else if (interval === 'day') {
        nextDate.setDate(nextDate.getDate() + 1);
      } else if (interval === 'year') {
        nextDate.setFullYear(nextDate.getFullYear() + 1);
      }
      
      // Если конец интервала выходит за пределы endDate, используем endDate
      if (nextDate > end) {
        nextDate = new Date(end);
      }
      
      // Форматируем даты для SQL
      const startFormatted = current.toISOString().substring(0, 10);
      const endFormatted = nextDate.toISOString().substring(0, 10);
      
      // Создаем партицию
      const success = await createPartition(client, startFormatted, endFormatted);
      
      if (success) {
        successCount++;
      } else {
        errorCount++;
      }
      
      // Перемещаемся к следующему интервалу
      current = nextDate;
    }
    
    log(`Создание партиций завершено: ${successCount} успешно, ${errorCount} с ошибками`, 
        errorCount > 0 ? colors.yellow : colors.green);
    
    // Логируем итоги операции
    await logPartitionOperation(
      client, 
      'CREATE_BATCH', 
      'multiple', 
      `Создание партиций завершено: ${successCount} успешно, ${errorCount} с ошибками`, 
      errorCount > 0 ? 'partial' : 'success'
    );
    
    return successCount > 0;
  } catch (error) {
    log(`Ошибка при создании партиций: ${error.message}`, colors.red);
    
    // Логируем ошибку
    await logPartitionOperation(
      client, 
      'CREATE_BATCH', 
      'multiple', 
      `Ошибка при создании партиций: ${error.message}`, 
      'error', 
      error.stack
    );
    
    return false;
  }
}

// Функция для восстановления данных из резервной копии
async function restoreDataFromBackup(client) {
  try {
    log('Восстановление данных из резервной копии...', colors.blue);
    
    // Проверяем наличие данных в резервной таблице
    const backupResult = await client.query('SELECT COUNT(*) FROM transactions_backup');
    const backupCount = parseInt(backupResult.rows[0].count);
    
    if (backupCount === 0) {
      log('Резервная таблица пуста, нет данных для восстановления', colors.yellow);
      
      // Логируем операцию
      await logPartitionOperation(
        client, 
        'RESTORE', 
        'transactions', 
        'Резервная таблица пуста, нет данных для восстановления', 
        'success'
      );
      
      return true;
    }
    
    // Определяем диапазон дат для партиций на основе данных резервной копии
    const dateRangeResult = await client.query(`
      SELECT 
        MIN(created_at) as min_date,
        MAX(created_at) as max_date
      FROM transactions_backup
    `);
    
    const minDate = dateRangeResult.rows[0].min_date;
    const maxDate = dateRangeResult.rows[0].max_date;
    
    if (!minDate || !maxDate) {
      log('Резервная таблица содержит некорректные даты', colors.yellow);
      
      // Логируем операцию
      await logPartitionOperation(
        client, 
        'RESTORE', 
        'transactions', 
        'Резервная таблица содержит некорректные даты', 
        'warning'
      );
      
      return false;
    }
    
    log(`Диапазон дат транзакций: ${minDate} - ${maxDate}`, colors.blue);
    
    // Форматируем даты для создания партиций
    const startDate = new Date(minDate);
    // Добавляем дополнительную партицию для будущих транзакций
    const endDate = new Date(maxDate);
    endDate.setMonth(endDate.getMonth() + 2);
    
    const startFormatted = startDate.toISOString().substring(0, 10);
    const endFormatted = endDate.toISOString().substring(0, 10);
    
    // Создаем партиции для необходимого периода
    await createPartitionsForPeriod(client, startFormatted, endFormatted, 'month');
    
    // Восстанавливаем данные из резервной копии в партиционированную таблицу
    await client.query(`
      INSERT INTO transactions (
        id, user_id, type, currency, amount, status, 
        source, category, tx_hash, description, 
        source_user_id, wallet_address, data, created_at
      )
      SELECT 
        id, user_id, type, currency, amount, status, 
        source, category, tx_hash, description, 
        source_user_id, wallet_address, data, created_at
      FROM transactions_backup
    `);
    
    // Проверяем, что все данные были восстановлены
    const restoredResult = await client.query('SELECT COUNT(*) FROM transactions');
    const restoredCount = parseInt(restoredResult.rows[0].count);
    
    if (restoredCount === backupCount) {
      log(`Восстановлено ${restoredCount} транзакций из резервной копии`, colors.green);
      
      // Логируем успешную операцию
      await logPartitionOperation(
        client, 
        'RESTORE', 
        'transactions', 
        `Восстановлено ${restoredCount} транзакций из резервной копии`, 
        'success'
      );
      
      return true;
    } else {
      const errorMsg = `Восстановлено только ${restoredCount} из ${backupCount} транзакций`;
      log(errorMsg, colors.red);
      
      // Логируем ошибку
      await logPartitionOperation(
        client, 
        'RESTORE', 
        'transactions', 
        errorMsg, 
        'error', 
        'Несоответствие количества записей'
      );
      
      return false;
    }
  } catch (error) {
    log(`Ошибка при восстановлении данных: ${error.message}`, colors.red);
    
    // Логируем ошибку
    await logPartitionOperation(
      client, 
      'RESTORE', 
      'transactions', 
      `Ошибка при восстановлении данных: ${error.message}`, 
      'error', 
      error.stack
    );
    
    return false;
  }
}

// Функция для создания партиций на будущие даты
async function createFuturePartitions(client) {
  try {
    log('Создание партиций для будущих дат...', colors.blue);
    
    const now = new Date();
    const future = new Date(now);
    future.setMonth(future.getMonth() + 3); // Создаем партиции на 3 месяца вперед
    
    const startFormatted = now.toISOString().substring(0, 10);
    const endFormatted = future.toISOString().substring(0, 10);
    
    await createPartitionsForPeriod(client, startFormatted, endFormatted, 'month');
    
    return true;
  } catch (error) {
    log(`Ошибка при создании будущих партиций: ${error.message}`, colors.red);
    return false;
  }
}

// Функция для проверки партиций таблицы
async function listPartitions(client) {
  try {
    log('Список партиций таблицы transactions:', colors.blue);
    
    const result = await client.query(`
      SELECT 
        nmsp_parent.nspname AS parent_schema,
        parent.relname AS parent,
        nmsp_child.nspname AS child_schema,
        child.relname AS child,
        pg_get_expr(child.relpartbound, child.oid) AS partition_expression
      FROM pg_inherits
      JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
      JOIN pg_class child ON pg_inherits.inhrelid = child.oid
      JOIN pg_namespace nmsp_parent ON parent.relnamespace = nmsp_parent.oid
      JOIN pg_namespace nmsp_child ON child.relnamespace = nmsp_child.oid
      WHERE parent.relname = 'transactions'
      ORDER BY child.relname;
    `);
    
    if (result.rows.length === 0) {
      log('Партиции не найдены', colors.yellow);
    } else {
      result.rows.forEach((row, index) => {
        log(`${index + 1}. ${row.child} - ${row.partition_expression}`, colors.reset);
      });
    }
    
    return result.rows;
  } catch (error) {
    log(`Ошибка при получении списка партиций: ${error.message}`, colors.red);
    return [];
  }
}

// Функция для вывода информации о таблице transactions
async function getTableInfo(client) {
  try {
    log('Сбор информации о таблице transactions...', colors.blue);
    
    // Проверяем тип таблицы (партиционированная или обычная)
    const typeResult = await client.query(`
      SELECT 
        c.relname as table_name,
        CASE WHEN c.relkind = 'p' THEN 'partitioned' ELSE 'regular' END as table_type,
        obj_description(c.oid) as table_description
      FROM pg_class c
      JOIN pg_namespace n ON c.relnamespace = n.oid
      WHERE c.relname = 'transactions' AND n.nspname = 'public';
    `);
    
    if (typeResult.rows.length === 0) {
      log('Таблица transactions не найдена', colors.yellow);
      return null;
    }
    
    // Проверяем количество записей
    const countResult = await client.query('SELECT COUNT(*) FROM transactions');
    
    // Проверяем индексы
    const indexResult = await client.query(`
      SELECT 
        i.relname as index_name,
        a.attname as column_name,
        am.amname as index_type
      FROM pg_index x
      JOIN pg_class c ON c.oid = x.indrelid
      JOIN pg_class i ON i.oid = x.indexrelid
      JOIN pg_am am ON i.relam = am.oid
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(x.indkey)
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = 'transactions'
      AND n.nspname = 'public'
      ORDER BY i.relname, a.attnum;
    `);
    
    // Выводим информацию
    log(`\nИнформация о таблице transactions:`, colors.cyan);
    log(`Тип: ${typeResult.rows[0].table_type}`, colors.reset);
    log(`Количество записей: ${countResult.rows[0].count}`, colors.reset);
    
    if (typeResult.rows[0].table_type === 'partitioned') {
      // Получаем количество партиций
      const partitionResult = await client.query(`
        SELECT COUNT(*) FROM pg_inherits
        JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
        JOIN pg_namespace nmsp_parent ON parent.relnamespace = nmsp_parent.oid
        WHERE parent.relname = 'transactions' AND nmsp_parent.nspname = 'public';
      `);
      
      log(`Количество партиций: ${partitionResult.rows[0].count}`, colors.reset);
    }
    
    log(`\nИндексы:`, colors.cyan);
    if (indexResult.rows.length === 0) {
      log(`Индексы не найдены`, colors.yellow);
    } else {
      indexResult.rows.forEach((row, index) => {
        log(`${index + 1}. ${row.index_name} на колонке ${row.column_name} (тип: ${row.index_type})`, colors.reset);
      });
    }
    
    return {
      type: typeResult.rows[0].table_type,
      count: countResult.rows[0].count,
      indexes: indexResult.rows
    };
  } catch (error) {
    log(`Ошибка при получении информации о таблице: ${error.message}`, colors.red);
    return null;
  }
}

// Главная функция
async function main() {
  log('=== Настройка партиционирования таблицы transactions ===', colors.magenta);
  
  let client;
  
  try {
    client = await getClient();
    
    // Проверяем, партиционирована ли уже таблица
    const isPartitioned = await isTablePartitioned(client);
    
    if (isPartitioned) {
      log('Таблица transactions уже партиционирована', colors.green);
      
      // Проверяем партиции
      await listPartitions(client);
      
      // Создаем партиции на будущие даты
      await createFuturePartitions(client);
      
    } else {
      log('Таблица transactions НЕ партиционирована. Начинаем настройку...', colors.yellow);
      
      // Шаг 1: Создаем резервную копию таблицы
      const backupSuccess = await backupTransactionsTable(client);
      
      if (!backupSuccess) {
        throw new Error('Не удалось создать резервную копию таблицы transactions');
      }
      
      // Шаг 2: Пересоздаем таблицу с партиционированием
      const recreateSuccess = await recreateTransactionsTableWithPartitioning(client);
      
      if (!recreateSuccess) {
        throw new Error('Не удалось пересоздать таблицу transactions с партиционированием');
      }
      
      // Шаг 3: Восстанавливаем данные из резервной копии
      await restoreDataFromBackup(client);
      
      // Шаг 4: Создаем партиции на будущие даты
      await createFuturePartitions(client);
    }
    
    // Вывод информации о таблице
    await getTableInfo(client);
    
    log('\n✅ Настройка партиционирования успешно завершена', colors.green);
  } catch (error) {
    log(`\n❌ Критическая ошибка: ${error.message}`, colors.red);
    
    if (client) {
      await logPartitionOperation(
        client, 
        'ERROR', 
        'transactions', 
        `Критическая ошибка: ${error.message}`, 
        'error', 
        error.stack
      );
    }
    
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
  }
}

// Запускаем скрипт
main();