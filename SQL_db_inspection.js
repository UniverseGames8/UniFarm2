/**
 * Скрипт для проверки структуры базы данных и выявления потенциальных проблем
 * 
 * Этот скрипт подключается к базе данных PostgreSQL и выполняет 
 * серию запросов для анализа таблиц, полей и отношений.
 */

import pg from 'pg';
const { Pool } = pg;

// Подключение к базе данных
const pool = new Pool({
  connectionString: process.env.DATABASE_URL 
});

const LOG_SEPARATOR = '='.repeat(80);

// Основные запросы для анализа базы данных
const DB_QUERIES = {
  // Список всех таблиц
  listTables: `
    SELECT 
      table_name 
    FROM 
      information_schema.tables 
    WHERE 
      table_schema = 'public' 
    ORDER BY 
      table_name
  `,
  
  // Структура конкретной таблицы
  tableStructure: `
    SELECT 
      column_name, 
      data_type, 
      character_maximum_length,
      column_default,
      is_nullable
    FROM 
      information_schema.columns 
    WHERE 
      table_schema = 'public' 
      AND table_name = $1 
    ORDER BY 
      ordinal_position
  `,
  
  // Первичные ключи для таблицы
  primaryKeys: `
    SELECT
      kcu.column_name
    FROM
      information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
    WHERE
      tc.constraint_type = 'PRIMARY KEY'
      AND tc.table_name = $1
  `,
  
  // Внешние ключи для таблицы
  foreignKeys: `
    SELECT
      kcu.column_name,
      ccu.table_name AS references_table,
      ccu.column_name AS references_column
    FROM
      information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
    WHERE
      tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = $1
  `,
  
  // Индексы для таблицы
  indexes: `
    SELECT
      indexname,
      indexdef
    FROM
      pg_indexes
    WHERE
      tablename = $1
  `,
  
  // Проверка наличия потенциально проблемных типов данных
  problematicTypes: `
    SELECT 
      table_name,
      column_name,
      data_type
    FROM 
      information_schema.columns 
    WHERE 
      table_schema = 'public' 
      AND (
        (data_type = 'numeric' AND numeric_precision IS NULL) OR
        (data_type = 'character varying' AND character_maximum_length IS NULL) OR
        (data_type LIKE '%json%')
      )
    ORDER BY 
      table_name, column_name
  `,
  
  // Проверка больших размеров таблиц
  tableSizes: `
    SELECT
      relname AS table_name,
      pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
      pg_size_pretty(pg_relation_size(relid)) AS data_size
    FROM
      pg_catalog.pg_statio_user_tables
    ORDER BY
      pg_total_relation_size(relid) DESC
  `,
  
  // Проверка миссинг индексов
  missingIndexes: `
    SELECT
      schemaname || '.' || relname AS table,
      seq_scan,
      idx_scan,
      CASE 
        WHEN seq_scan > 0 THEN round(100.0 * idx_scan / (seq_scan + idx_scan), 2)
        ELSE 0 
      END AS percent_of_times_index_used
    FROM
      pg_stat_user_tables
    WHERE
      seq_scan > idx_scan
    ORDER BY
      seq_scan DESC
  `,
  
  // Проверка дубликатов в реферальных кодах
  duplicateRefCodes: `
    SELECT 
      ref_code, 
      COUNT(*) as count
    FROM 
      users
    WHERE 
      ref_code IS NOT NULL
    GROUP BY 
      ref_code
    HAVING 
      COUNT(*) > 1
  `,
  
  // Проверка непроиндексированных внешних ключей
  nonIndexedForeignKeys: `
    SELECT
      tc.table_schema, 
      tc.table_name, 
      kcu.column_name, 
      ccu.table_name AS referenced_table,
      ccu.column_name AS referenced_column
    FROM 
      information_schema.table_constraints tc
    JOIN 
      information_schema.key_column_usage kcu
      ON tc.constraint_catalog = kcu.constraint_catalog
      AND tc.constraint_schema = kcu.constraint_schema
      AND tc.constraint_name = kcu.constraint_name
    JOIN 
      information_schema.constraint_column_usage ccu
      ON tc.constraint_catalog = ccu.constraint_catalog
      AND tc.constraint_schema = ccu.constraint_schema
      AND tc.constraint_name = ccu.constraint_name
    LEFT JOIN 
      pg_indexes pi
      ON pi.tablename = tc.table_name
      AND pi.indexdef LIKE '%' || kcu.column_name || '%'
    WHERE 
      tc.constraint_type = 'FOREIGN KEY'
      AND pi.indexname IS NULL
  `,
  
  // Проверка целостности реферальной системы
  refCodeIntegrity: `
    SELECT
      u.id,
      u.ref_code,
      u.parent_ref_code,
      p.id AS parent_id,
      p.ref_code AS actual_parent_ref_code
    FROM
      users u
    LEFT JOIN
      users p ON u.parent_ref_code = p.ref_code
    WHERE
      u.parent_ref_code IS NOT NULL
      AND p.id IS NULL
  `,
  
  // Проверка отрицательных балансов
  negativeBalances: `
    SELECT
      id,
      username,
      balance_uni,
      balance_ton
    FROM
      users
    WHERE
      CAST(balance_uni AS numeric) < 0
      OR CAST(balance_ton AS numeric) < 0
  `,
  
  // Проверка активности депозитов
  depositActivity: `
    SELECT
      user_id,
      COUNT(*) as deposit_count,
      SUM(CAST(amount AS numeric)) as total_amount,
      MIN(created_at) as oldest_deposit,
      MAX(created_at) as newest_deposit
    FROM
      uni_farming_deposits
    WHERE
      is_active = true
    GROUP BY
      user_id
    ORDER BY
      COUNT(*) DESC
  `,
};

/**
 * Выполнение SQL запроса
 */
async function executeQuery(query, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(query, params);
    return result.rows;
  } catch (error) {
    console.error(`Ошибка выполнения запроса: ${error.message}`);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Анализ таблицы
 */
async function analyzeTable(tableName) {
  console.log(`\nАнализ таблицы: ${tableName}`);
  console.log('-'.repeat(50));
  
  // Получение структуры таблицы
  const structure = await executeQuery(DB_QUERIES.tableStructure, [tableName]);
  console.log(`Структура таблицы (${structure.length} колонок):`);
  structure.forEach(column => {
    console.log(`  - ${column.column_name}: ${column.data_type}${column.character_maximum_length ? `(${column.character_maximum_length})` : ''} ${column.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'} ${column.column_default ? `DEFAULT ${column.column_default}` : ''}`);
  });
  
  // Получение первичных ключей
  const primaryKeys = await executeQuery(DB_QUERIES.primaryKeys, [tableName]);
  console.log(`\nПервичные ключи (${primaryKeys.length}):`);
  if (primaryKeys.length > 0) {
    primaryKeys.forEach(pk => {
      console.log(`  - ${pk.column_name}`);
    });
  } else {
    console.log(`  Внимание: Таблица не имеет первичного ключа!`);
  }
  
  // Получение внешних ключей
  const foreignKeys = await executeQuery(DB_QUERIES.foreignKeys, [tableName]);
  console.log(`\nВнешние ключи (${foreignKeys.length}):`);
  if (foreignKeys.length > 0) {
    foreignKeys.forEach(fk => {
      console.log(`  - ${fk.column_name} -> ${fk.references_table}(${fk.references_column})`);
    });
  } else {
    console.log(`  Нет внешних ключей`);
  }
  
  // Получение индексов
  const indexes = await executeQuery(DB_QUERIES.indexes, [tableName]);
  console.log(`\nИндексы (${indexes.length}):`);
  if (indexes.length > 0) {
    indexes.forEach(idx => {
      console.log(`  - ${idx.indexname}: ${idx.indexdef}`);
    });
  } else {
    console.log(`  Нет индексов`);
  }
  
  // Проверка непроиндексированных внешних ключей
  if (foreignKeys.length > 0) {
    const indexedColumns = indexes
      .map(idx => idx.indexdef)
      .join(' ');
    
    const nonIndexedFKs = foreignKeys.filter(fk => 
      !indexedColumns.includes(fk.column_name)
    );
    
    if (nonIndexedFKs.length > 0) {
      console.log(`\nВнимание: Обнаружены внешние ключи без индексов!`);
      nonIndexedFKs.forEach(fk => {
        console.log(`  - ${fk.column_name} -> ${fk.references_table}(${fk.references_column})`);
      });
      console.log(`  Рекомендация: Создайте индексы для этих внешних ключей для повышения производительности.`);
    }
  }
  
  return {
    name: tableName,
    columns: structure.length,
    primaryKeys: primaryKeys.length,
    foreignKeys: foreignKeys.length,
    indexes: indexes.length
  };
}

/**
 * Проверка реферальной целостности
 */
async function checkReferralIntegrity() {
  console.log(LOG_SEPARATOR);
  console.log('ПРОВЕРКА ЦЕЛОСТНОСТИ РЕФЕРАЛОВ');
  console.log(LOG_SEPARATOR);
  
  // Проверка дубликатов в реферальных кодах
  const duplicates = await executeQuery(DB_QUERIES.duplicateRefCodes);
  if (duplicates.length > 0) {
    console.log('Обнаружены дубликаты реферальных кодов:');
    duplicates.forEach(dup => {
      console.log(`  - ${dup.ref_code}: ${dup.count} записей`);
    });
    console.log('КРИТИЧЕСКАЯ ОШИБКА: Реферальные коды должны быть уникальными!');
  } else {
    console.log('✅ Дубликатов реферальных кодов не обнаружено.');
  }
  
  // Проверка целостности parent_ref_code
  const orphanedRefs = await executeQuery(DB_QUERIES.refCodeIntegrity);
  if (orphanedRefs.length > 0) {
    console.log('\nОбнаружены "сироты" в реферальной системе:');
    orphanedRefs.forEach(ref => {
      console.log(`  - Пользователь ${ref.id} имеет parent_ref_code=${ref.parent_ref_code}, но такой реферальный код не существует`);
    });
    console.log('ОШИБКА: Нарушение целостности реферальной системы!');
  } else {
    console.log('✅ Реферальная система целостна.');
  }
}

/**
 * Проверка балансов
 */
async function checkBalances() {
  console.log(LOG_SEPARATOR);
  console.log('ПРОВЕРКА БАЛАНСОВ ПОЛЬЗОВАТЕЛЕЙ');
  console.log(LOG_SEPARATOR);
  
  // Проверка отрицательных балансов
  const negativeBalances = await executeQuery(DB_QUERIES.negativeBalances);
  if (negativeBalances.length > 0) {
    console.log('Обнаружены пользователи с отрицательным балансом:');
    negativeBalances.forEach(user => {
      console.log(`  - Пользователь ${user.id} (${user.username}): UNI=${user.balance_uni}, TON=${user.balance_ton}`);
    });
    console.log('ОШИБКА: Отрицательные балансы недопустимы!');
  } else {
    console.log('✅ Отрицательных балансов не обнаружено.');
  }
  
  // Проверка активности депозитов
  const depositActivity = await executeQuery(DB_QUERIES.depositActivity);
  console.log('\nСтатистика депозитов фарминга:');
  console.log(`  - Всего пользователей с активными депозитами: ${depositActivity.length}`);
  if (depositActivity.length > 0) {
    const totalDeposits = depositActivity.reduce((sum, user) => sum + parseInt(user.deposit_count), 0);
    const totalAmount = depositActivity.reduce((sum, user) => sum + parseFloat(user.total_amount), 0);
    console.log(`  - Всего активных депозитов: ${totalDeposits}`);
    console.log(`  - Общая сумма депозитов: ${totalAmount} UNI`);
    
    // Топ пользователей по количеству депозитов
    console.log('\nТоп 5 пользователей по количеству депозитов:');
    depositActivity.slice(0, 5).forEach((user, index) => {
      console.log(`  ${index + 1}. Пользователь ${user.user_id}: ${user.deposit_count} депозитов на сумму ${user.total_amount} UNI`);
    });
  }
}

/**
 * Запуск полного анализа базы данных
 */
async function runDatabaseAnalysis() {
  try {
    console.log(LOG_SEPARATOR);
    console.log('АНАЛИЗ БАЗЫ ДАННЫХ UNIFARM');
    console.log(`Начало: ${new Date().toISOString()}`);
    console.log(LOG_SEPARATOR);
    
    // Получение списка всех таблиц
    const tables = await executeQuery(DB_QUERIES.listTables);
    console.log(`Обнаружено ${tables.length} таблиц в базе данных:`);
    tables.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });
    
    // Размеры таблиц
    const sizes = await executeQuery(DB_QUERIES.tableSizes);
    console.log('\nРазмеры таблиц:');
    sizes.forEach(size => {
      console.log(`  - ${size.table_name}: ${size.total_size} (data: ${size.data_size})`);
    });
    
    // Проверка потенциально проблемных типов данных
    const problematicTypes = await executeQuery(DB_QUERIES.problematicTypes);
    if (problematicTypes.length > 0) {
      console.log('\nОбнаружены потенциально проблемные типы данных:');
      problematicTypes.forEach(col => {
        console.log(`  - ${col.table_name}.${col.column_name}: ${col.data_type}`);
      });
      console.log('  Рекомендация: Проверьте, что эти колонки имеют ограничения или валидацию на уровне приложения.');
    } else {
      console.log('\n✅ Не обнаружено потенциально проблемных типов данных.');
    }
    
    // Анализ отдельных таблиц
    const tableAnalysis = [];
    for (const table of tables) {
      const analysis = await analyzeTable(table.table_name);
      tableAnalysis.push(analysis);
    }
    
    // Проверка отсутствующих индексов
    const missingIndexes = await executeQuery(DB_QUERIES.missingIndexes);
    if (missingIndexes.length > 0) {
      console.log('\nТаблицы с потенциально отсутствующими индексами:');
      missingIndexes.forEach(idx => {
        console.log(`  - ${idx.table}: ${idx.seq_scan} последовательных сканирований vs ${idx.idx_scan} индексных сканирований (${idx.percent_of_times_index_used}% использования индекса)`);
      });
      console.log('  Рекомендация: Рассмотрите добавление индексов для таблиц с большим количеством последовательных сканирований.');
    } else {
      console.log('\n✅ Все таблицы эффективно используют индексы.');
    }
    
    // Проверка целостности реферальной системы
    await checkReferralIntegrity();
    
    // Проверка балансов пользователей
    await checkBalances();
    
    console.log(LOG_SEPARATOR);
    console.log('АНАЛИЗ ЗАВЕРШЕН');
    console.log(`Окончание: ${new Date().toISOString()}`);
    console.log(LOG_SEPARATOR);
    
  } catch (error) {
    console.error(`Ошибка анализа базы данных: ${error.message}`);
  } finally {
    await pool.end();
  }
}

// Запуск анализа
runDatabaseAnalysis().catch(console.error);