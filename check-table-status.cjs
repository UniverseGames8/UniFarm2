/**
 * Скрипт для проверки статуса таблицы transactions
 * Проверяет существование таблицы и её партиционирование
 */

const dotenv = require('dotenv');
const { Pool } = require('pg');

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

// Получает список партиций для таблицы
async function getPartitions(tableName) {
  try {
    const query = `
      SELECT 
        c.relname as partition_name,
        pg_size_pretty(pg_total_relation_size(c.oid)) as size,
        pg_get_expr(c.relpartbound, c.oid) as partition_expression
      FROM pg_inherits i
      JOIN pg_class p ON p.oid = i.inhparent
      JOIN pg_class c ON c.oid = i.inhrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE p.relname = $1
      AND n.nspname = 'public'
      ORDER BY c.relname;
    `;
    
    const result = await executeQuery(query, [tableName]);
    return result.rows;
  } catch (error) {
    console.error('Ошибка при получении списка партиций:', error);
    return [];
  }
}

// Получает структуру таблицы
async function getTableStructure(tableName) {
  try {
    const query = `
      SELECT 
        column_name, 
        data_type, 
        is_nullable
      FROM 
        information_schema.columns
      WHERE 
        table_name = $1
      ORDER BY 
        ordinal_position;
    `;
    
    const result = await executeQuery(query, [tableName]);
    return result.rows;
  } catch (error) {
    console.error('Ошибка при получении структуры таблицы:', error);
    return [];
  }
}

// Основная функция проверки
async function checkTableStatus() {
  try {
    console.log('🔍 Проверка статуса таблицы transactions...');
    
    // Проверяем соединение с базой данных
    const connectionTest = await executeQuery('SELECT NOW() as time');
    console.log(`✅ Соединение с базой данных установлено: ${connectionTest.rows[0].time}`);
    
    // Проверяем существование таблицы
    const tableName = 'transactions';
    const exists = await checkTableExists(tableName);
    
    if (!exists) {
      console.log(`❌ Таблица ${tableName} не существует в базе данных`);
      return;
    }
    
    console.log(`✅ Таблица ${tableName} существует в базе данных`);
    
    // Получаем структуру таблицы
    const structure = await getTableStructure(tableName);
    console.log(`\n📋 Структура таблицы ${tableName}:`);
    console.table(structure);
    
    // Проверяем партиционирование
    const isPartitioned = await isTablePartitioned(tableName);
    
    if (isPartitioned) {
      console.log(`✅ Таблица ${tableName} партиционирована`);
      
      // Получаем список партиций
      const partitions = await getPartitions(tableName);
      console.log(`\n📋 Список партиций таблицы ${tableName} (${partitions.length}):`);
      console.table(partitions);
    } else {
      console.log(`⚠️ Таблица ${tableName} НЕ партиционирована`);
    }
  } catch (error) {
    console.error('❌ Ошибка при проверке статуса таблицы:', error);
  } finally {
    // Закрываем соединение с базой данных
    await pool.end();
  }
}

// Запускаем проверку
checkTableStatus();