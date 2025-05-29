/**
 * Скрипт для диагностики и проверки состояния базы данных
 *
 * Этот скрипт подключается к базе данных PostgreSQL и выполняет серию проверок:
 * 1. Проверяет подключение к базе данных
 * 2. Получает список всех таблиц
 * 3. Получает информацию о каждой таблице (количество строк, размер и т.д.)
 * 4. Проверяет структуру таблицы users
 * 5. Выводит подробный отчет о состоянии базы данных
 */

import pg from 'pg';
const { Pool } = pg;

// Подключаемся к базе данных
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

/**
 * Выполнение SQL запроса
 */
async function executeQuery(query, params = []) {
  try {
    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Ошибка выполнения запроса:', error);
    throw error;
  }
}

/**
 * Получение списка всех таблиц
 */
async function getAllTables() {
  const query = `
    SELECT 
      table_name 
    FROM 
      information_schema.tables 
    WHERE 
      table_schema = 'public' 
    ORDER BY 
      table_name;
  `;
  
  return await executeQuery(query);
}

/**
 * Получение информации о количестве строк в таблице
 */
async function getTableRowCount(tableName) {
  const query = `SELECT COUNT(*) as row_count FROM "${tableName}";`;
  const result = await executeQuery(query);
  return parseInt(result[0].row_count);
}

/**
 * Получение информации о размере таблицы
 */
async function getTableSize(tableName) {
  const query = `
    SELECT 
      pg_size_pretty(pg_total_relation_size('"${tableName}"')) as total_size,
      pg_size_pretty(pg_relation_size('"${tableName}"')) as table_size,
      pg_size_pretty(pg_total_relation_size('"${tableName}"') - pg_relation_size('"${tableName}"')) as index_size
    FROM 
      pg_catalog.pg_tables 
    WHERE 
      schemaname = 'public' 
      AND tablename = $1;
  `;
  
  const result = await executeQuery(query, [tableName]);
  return result[0] || { total_size: '0 B', table_size: '0 B', index_size: '0 B' };
}

/**
 * Получение структуры таблицы
 */
async function getTableStructure(tableName) {
  const query = `
    SELECT 
      column_name, 
      data_type,
      is_nullable,
      column_default
    FROM 
      information_schema.columns 
    WHERE 
      table_schema = 'public' 
      AND table_name = $1 
    ORDER BY 
      ordinal_position;
  `;
  
  return await executeQuery(query, [tableName]);
}

/**
 * Получение индексов таблицы
 */
async function getTableIndexes(tableName) {
  const query = `
    SELECT
      indexname,
      indexdef
    FROM
      pg_indexes
    WHERE
      schemaname = 'public'
      AND tablename = $1
    ORDER BY
      indexname;
  `;
  
  return await executeQuery(query, [tableName]);
}

/**
 * Получение информации о внешних ключах
 */
async function getForeignKeys(tableName) {
  const query = `
    SELECT
      tc.constraint_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM
      information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
    WHERE
      tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = $1;
  `;
  
  return await executeQuery(query, [tableName]);
}

/**
 * Проверка подключения к базе данных
 */
async function checkDatabaseConnection() {
  try {
    await pool.query('SELECT NOW() as time');
    console.log('✅ Успешное подключение к базе данных');
    return true;
  } catch (error) {
    console.error('❌ Ошибка подключения к базе данных:', error);
    return false;
  }
}

/**
 * Получение общей информации о базе данных
 */
async function getDatabaseInfo() {
  const query = `
    SELECT
      current_database() as db_name,
      current_user as db_user,
      version() as db_version,
      pg_size_pretty(pg_database_size(current_database())) as db_size;
  `;
  
  return await executeQuery(query);
}

/**
 * Запуск полного анализа базы данных
 */
async function runDatabaseAnalysis() {
  console.log('🔍 Начинаем анализ базы данных...\n');
  
  // Проверяем подключение
  const isConnected = await checkDatabaseConnection();
  if (!isConnected) {
    console.error('❌ Анализ отменен из-за ошибки подключения');
    return;
  }
  
  // Общая информация о базе данных
  const dbInfo = await getDatabaseInfo();
  console.log('\n📊 Общая информация о базе данных:');
  console.log(`Название: ${dbInfo[0].db_name}`);
  console.log(`Пользователь: ${dbInfo[0].db_user}`);
  console.log(`Версия PostgreSQL: ${dbInfo[0].db_version}`);
  console.log(`Общий размер: ${dbInfo[0].db_size}`);
  
  // Получаем список всех таблиц
  const tables = await getAllTables();
  console.log(`\n📋 Найдено таблиц: ${tables.length}`);
  
  // Анализируем каждую таблицу
  for (const table of tables) {
    const tableName = table.table_name;
    console.log(`\n📝 Анализ таблицы: ${tableName}`);
    
    try {
      // Структура таблицы
      const structure = await getTableStructure(tableName);
      console.log(`  Колонок: ${structure.length}`);
      
      // Количество строк
      const rowCount = await getTableRowCount(tableName);
      console.log(`  Количество записей: ${rowCount}`);
      
      // Размер таблицы
      const sizeInfo = await getTableSize(tableName);
      console.log(`  Общий размер: ${sizeInfo.total_size}`);
      console.log(`  Размер данных: ${sizeInfo.table_size}`);
      console.log(`  Размер индексов: ${sizeInfo.index_size}`);
      
      // Индексы
      const indexes = await getTableIndexes(tableName);
      console.log(`  Индексов: ${indexes.length}`);
      
      // Внешние ключи
      const foreignKeys = await getForeignKeys(tableName);
      console.log(`  Внешних ключей: ${foreignKeys.length}`);
      
      if (foreignKeys.length > 0) {
        console.log('  Связи с другими таблицами:');
        foreignKeys.forEach(fk => {
          console.log(`    - ${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
        });
      }
    } catch (error) {
      console.error(`  ❌ Ошибка при анализе таблицы ${tableName}:`, error);
    }
  }
  
  console.log('\n✅ Анализ базы данных завершен');
}

// Запуск анализа
runDatabaseAnalysis()
  .then(() => {
    console.log('\nАнализ успешно завершен');
    pool.end();
  })
  .catch(error => {
    console.error('Ошибка при выполнении анализа:', error);
    pool.end();
    process.exit(1);
  });