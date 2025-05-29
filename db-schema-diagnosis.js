/**
 * Диагностический скрипт для анализа схемы базы данных
 * 
 * Проверяет структуру таблиц, индексы, зависимости между таблицами,
 * а также выполняет базовые проверки целостности данных
 * 
 * Использование:
 * node db-schema-diagnosis.js
 */

// Явное применение фикса для базы данных
console.log('[Диагностика Схемы] 📊 Применение фикса подключения к БД...');

// Принудительно отключаем Unix сокеты для PostgreSQL
process.env.PGHOST = process.env.PGHOST || 'localhost';  
process.env.PGSSLMODE = 'prefer';
process.env.PGSOCKET = ''; 
process.env.PGCONNECT_TIMEOUT = '10';

// Принудительно переключаем на Neon DB
process.env.DATABASE_PROVIDER = 'neon';
process.env.FORCE_NEON_DB = 'true';
process.env.DISABLE_REPLIT_DB = 'true';
process.env.OVERRIDE_DB_PROVIDER = 'neon';

console.log('[Диагностика Схемы] ✅ Фикс для БД применен');

// Импортируем модули для работы с БД
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Pool } = require('pg');

// Проверяем DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.error('[Диагностика Схемы] ❌ КРИТИЧЕСКАЯ ОШИБКА: DATABASE_URL не найден!');
  console.error('Проверьте настройки переменных окружения для подключения к Neon DB.');
  process.exit(1);
} else {
  // Маскируем URL для безопасности в логах
  const maskedUrl = process.env.DATABASE_URL.replace(/\/\/([^:]+):([^@]+)@/, '//\\1:***@');
  console.log('\n[Диагностика Схемы] 🔐 DATABASE_URL:', maskedUrl);
}

// Создаем пул соединений с настройками Neon DB
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Для Neon DB
  },
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000
});

// Добавляем обработчики событий
pool.on('error', (err) => {
  console.error('[Диагностика Схемы] ❌ Ошибка пула соединений:', err.message);
});

// Функция для выполнения запросов к БД
async function executeQuery(query, params = []) {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(query, params);
      return result.rows;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[Диагностика Схемы] ❌ Ошибка при выполнении запроса:', error.message);
    throw error;
  }
}

// Получение списка таблиц
async function getTables() {
  const query = `
    SELECT 
      table_name,
      (SELECT count(*) FROM information_schema.columns WHERE table_name = t.table_name) AS column_count,
      (SELECT pg_catalog.obj_description(pg_catalog.pg_class.oid)
       FROM pg_catalog.pg_class
       WHERE pg_catalog.pg_class.relname = t.table_name LIMIT 1) AS table_description
    FROM information_schema.tables t
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `;
  
  return await executeQuery(query);
}

// Получение структуры таблицы
async function getTableStructure(tableName) {
  const query = `
    SELECT 
      column_name, 
      data_type, 
      character_maximum_length,
      column_default,
      is_nullable,
      (SELECT pg_catalog.col_description(pg_catalog.pg_class.oid, cols.ordinal_position)
       FROM pg_catalog.pg_class
       WHERE pg_catalog.pg_class.relname = cols.table_name LIMIT 1) AS column_description
    FROM information_schema.columns cols
    WHERE table_name = $1
    ORDER BY ordinal_position;
  `;
  
  return await executeQuery(query, [tableName]);
}

// Получение информации о первичных ключах
async function getPrimaryKeys(tableName) {
  const query = `
    SELECT 
      tc.constraint_name, 
      kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = $1 
      AND tc.constraint_type = 'PRIMARY KEY'
    ORDER BY kcu.ordinal_position;
  `;
  
  return await executeQuery(query, [tableName]);
}

// Получение информации о внешних ключах
async function getForeignKeys(tableName) {
  const query = `
    SELECT
      tc.constraint_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.table_name = $1
      AND tc.constraint_type = 'FOREIGN KEY'
    ORDER BY kcu.ordinal_position;
  `;
  
  return await executeQuery(query, [tableName]);
}

// Получение информации об индексах
async function getIndexes(tableName) {
  const query = `
    SELECT
      indexname AS index_name,
      indexdef AS index_definition
    FROM pg_indexes
    WHERE tablename = $1
    ORDER BY indexname;
  `;
  
  return await executeQuery(query, [tableName]);
}

// Проверка целостности данных таблицы
async function checkTableIntegrity(tableName) {
  try {
    // Получаем общее количество строк
    const countQuery = `SELECT COUNT(*) as count FROM "${tableName}"`;
    const countResult = await executeQuery(countQuery);
    const rowCount = parseInt(countResult[0].count);
    
    // Получаем информацию о первичных ключах
    const primaryKeys = await getPrimaryKeys(tableName);
    
    // Если есть первичный ключ, проверяем уникальность
    if (primaryKeys.length > 0) {
      const pkColumns = primaryKeys.map(pk => `"${pk.column_name}"`).join(', ');
      
      // Проверяем наличие дубликатов первичных ключей
      const duplicatesQuery = `
        SELECT ${pkColumns}, COUNT(*) 
        FROM "${tableName}" 
        GROUP BY ${pkColumns} 
        HAVING COUNT(*) > 1
        LIMIT 5;
      `;
      
      const duplicates = await executeQuery(duplicatesQuery);
      
      return {
        rowCount,
        hasPrimaryKey: true,
        primaryKeyColumns: primaryKeys.map(pk => pk.column_name),
        hasDuplicates: duplicates.length > 0,
        duplicatesCount: duplicates.length > 0 ? duplicates.length : 0
      };
    } else {
      return {
        rowCount,
        hasPrimaryKey: false,
        warning: 'Таблица не имеет первичного ключа'
      };
    }
  } catch (error) {
    return {
      error: `Ошибка при проверке целостности таблицы: ${error.message}`
    };
  }
}

// Проверка партицирования таблицы transactions
async function checkTransactionsPartitioning() {
  try {
    // Проверяем существование таблицы transactions
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'transactions'
      ) AS exists;
    `;
    
    const tableExists = await executeQuery(tableExistsQuery);
    
    if (!tableExists[0].exists) {
      return {
        exists: false,
        message: 'Таблица transactions не существует'
      };
    }
    
    // Проверяем, является ли таблица партиционированной
    const isPartitionedQuery = `
      SELECT
        relkind = 'p' AS is_partitioned
      FROM pg_class
      WHERE relname = 'transactions';
    `;
    
    const isPartitioned = await executeQuery(isPartitionedQuery);
    
    if (!isPartitioned.length || !isPartitioned[0].is_partitioned) {
      return {
        exists: true,
        isPartitioned: false,
        message: 'Таблица transactions существует, но не партиционирована'
      };
    }
    
    // Получаем список партиций
    const partitionsQuery = `
      SELECT
        child.relname AS partition_name,
        pg_catalog.pg_get_expr(child.relpartbound, child.oid, true) AS partition_expression
      FROM pg_inherits
      JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
      JOIN pg_class child ON pg_inherits.inhrelid = child.oid
      WHERE parent.relname = 'transactions'
      ORDER BY child.relname;
    `;
    
    const partitions = await executeQuery(partitionsQuery);
    
    return {
      exists: true,
      isPartitioned: true,
      partitionsCount: partitions.length,
      partitions: partitions.map(p => ({
        name: p.partition_name,
        expression: p.partition_expression
      }))
    };
  } catch (error) {
    return {
      error: `Ошибка при проверке партиционирования: ${error.message}`
    };
  }
}

// Проверка наличия необходимых таблиц для аутентификации
async function checkAuthTablesExist() {
  const requiredTables = ['auth_users', 'sessions', 'telegram_users'];
  const results = {};
  
  for (const tableName of requiredTables) {
    try {
      const query = `
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = $1
        ) AS exists;
      `;
      
      const result = await executeQuery(query, [tableName]);
      results[tableName] = result[0].exists;
      
      if (result[0].exists) {
        // Если таблица существует, получаем количество строк
        const countQuery = `SELECT COUNT(*) AS count FROM "${tableName}"`;
        const countResult = await executeQuery(countQuery);
        results[`${tableName}_count`] = parseInt(countResult[0].count);
      }
    } catch (error) {
      results[tableName] = false;
      results[`${tableName}_error`] = error.message;
    }
  }
  
  return results;
}

// Основная функция диагностики
async function runDiagnostics() {
  console.log('[Диагностика Схемы] 🔍 Начало диагностики схемы базы данных');
  
  try {
    // Получаем список всех таблиц
    console.log('\n[Диагностика Схемы] 📋 Получение списка таблиц...');
    const tables = await getTables();
    console.log(`[Диагностика Схемы] ✅ Найдено ${tables.length} таблиц в схеме public`);
    
    // Выводим список таблиц с количеством колонок
    console.log('\n[Диагностика Схемы] 📊 Список таблиц:');
    tables.forEach((table, index) => {
      console.log(`   ${index + 1}. ${table.table_name} (колонок: ${table.column_count})${table.table_description ? ` - ${table.table_description}` : ''}`);
    });
    
    // Проверяем наличие таблиц авторизации
    console.log('\n[Диагностика Схемы] 🔑 Проверка таблиц авторизации...');
    const authTablesStatus = await checkAuthTablesExist();
    
    console.log('[Диагностика Схемы] 📋 Статус таблиц авторизации:');
    for (const [key, value] of Object.entries(authTablesStatus)) {
      if (!key.includes('_count') && !key.includes('_error')) {
        console.log(`   ${key}: ${value ? '✅ Существует' : '❌ Отсутствует'}`);
        
        if (value && authTablesStatus[`${key}_count`] !== undefined) {
          console.log(`      Количество записей: ${authTablesStatus[`${key}_count`]}`);
        }
        
        if (authTablesStatus[`${key}_error`]) {
          console.log(`      Ошибка: ${authTablesStatus[`${key}_error`]}`);
        }
      }
    }
    
    // Проверяем партиционирование таблицы transactions
    console.log('\n[Диагностика Схемы] 🔄 Проверка партиционирования таблицы transactions...');
    const transactionsPartitioning = await checkTransactionsPartitioning();
    
    if (transactionsPartitioning.error) {
      console.error(`[Диагностика Схемы] ❌ ${transactionsPartitioning.error}`);
    } else if (!transactionsPartitioning.exists) {
      console.log(`[Диагностика Схемы] ⚠️ ${transactionsPartitioning.message}`);
    } else if (!transactionsPartitioning.isPartitioned) {
      console.log(`[Диагностика Схемы] ⚠️ ${transactionsPartitioning.message}`);
    } else {
      console.log(`[Диагностика Схемы] ✅ Таблица transactions партиционирована, найдено ${transactionsPartitioning.partitionsCount} партиций`);
      
      // Выводим информацию о партициях, если их не слишком много
      if (transactionsPartitioning.partitionsCount <= 10) {
        console.log('[Диагностика Схемы] 📋 Список партиций:');
        transactionsPartitioning.partitions.forEach((partition, index) => {
          console.log(`   ${index + 1}. ${partition.name}: ${partition.expression}`);
        });
      }
    }
    
    // Детальный анализ критичных таблиц
    const criticalTables = ['auth_users', 'sessions', 'telegram_users', 'transactions', 'referrals'];
    
    for (const tableName of criticalTables) {
      // Проверяем существование таблицы
      const tableExists = tables.some(t => t.table_name === tableName);
      
      if (!tableExists) {
        console.log(`\n[Диагностика Схемы] ⚠️ Критичная таблица "${tableName}" отсутствует!`);
        continue;
      }
      
      console.log(`\n[Диагностика Схемы] 🔍 Анализ структуры таблицы "${tableName}"...`);
      
      // Получаем структуру таблицы
      const columns = await getTableStructure(tableName);
      console.log(`[Диагностика Схемы] 📋 Колонки таблицы "${tableName}":`);
      columns.forEach((column, index) => {
        console.log(`   ${index + 1}. ${column.column_name} (${column.data_type}${column.character_maximum_length ? `(${column.character_maximum_length})` : ''})${column.is_nullable === 'YES' ? ' NULL' : ' NOT NULL'}${column.column_default ? ` DEFAULT ${column.column_default}` : ''}`);
      });
      
      // Получаем первичные ключи
      const primaryKeys = await getPrimaryKeys(tableName);
      console.log(`[Диагностика Схемы] 🔑 Первичные ключи таблицы "${tableName}":`);
      if (primaryKeys.length === 0) {
        console.log(`   ⚠️ Таблица "${tableName}" не имеет первичного ключа!`);
      } else {
        primaryKeys.forEach((pk, index) => {
          console.log(`   ${index + 1}. ${pk.column_name} (${pk.constraint_name})`);
        });
      }
      
      // Получаем внешние ключи
      const foreignKeys = await getForeignKeys(tableName);
      console.log(`[Диагностика Схемы] 🔗 Внешние ключи таблицы "${tableName}":`);
      if (foreignKeys.length === 0) {
        console.log(`   ℹ️ Таблица "${tableName}" не имеет внешних ключей`);
      } else {
        foreignKeys.forEach((fk, index) => {
          console.log(`   ${index + 1}. ${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name} (${fk.constraint_name})`);
        });
      }
      
      // Получаем индексы
      const indexes = await getIndexes(tableName);
      console.log(`[Диагностика Схемы] 📑 Индексы таблицы "${tableName}":`);
      if (indexes.length === 0) {
        console.log(`   ⚠️ Таблица "${tableName}" не имеет индексов!`);
      } else {
        indexes.forEach((index, idx) => {
          console.log(`   ${idx + 1}. ${index.index_name}`);
          console.log(`      ${index.index_definition}`);
        });
      }
      
      // Проверяем целостность данных
      console.log(`[Диагностика Схемы] 🧪 Проверка целостности данных таблицы "${tableName}"...`);
      const integrity = await checkTableIntegrity(tableName);
      
      if (integrity.error) {
        console.error(`   ❌ ${integrity.error}`);
      } else {
        console.log(`   ✅ Количество записей: ${integrity.rowCount}`);
        
        if (integrity.hasPrimaryKey) {
          console.log(`   ✅ Первичный ключ: ${integrity.primaryKeyColumns.join(', ')}`);
          
          if (integrity.hasDuplicates) {
            console.log(`   ❌ Найдены дубликаты первичного ключа: ${integrity.duplicatesCount}`);
          } else {
            console.log(`   ✅ Дубликаты первичного ключа отсутствуют`);
          }
        } else if (integrity.warning) {
          console.log(`   ⚠️ ${integrity.warning}`);
        }
      }
    }
    
    console.log('\n[Диагностика Схемы] 🏁 Диагностика схемы базы данных завершена');
    
  } catch (error) {
    console.error('[Диагностика Схемы] ❌ Критическая ошибка при диагностике:', error);
  } finally {
    await pool.end();
    console.log('[Диагностика Схемы] 🔌 Соединение с базой данных закрыто');
  }
}

// Запускаем диагностику
runDiagnostics().catch(error => {
  console.error('[Диагностика Схемы] ⚠️ Необработанная ошибка в скрипте диагностики:', error);
  process.exit(1);
});