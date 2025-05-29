/**
 * Скрипт для проверки подключения к Neon DB и существующих данных
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

async function testNeonDbConnection() {
  log('='.repeat(60), colors.blue);
  log('🔍 ПРОВЕРКА ПОДКЛЮЧЕНИЯ К NEON DB', colors.bright + colors.blue);
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
    log('🔄 Проверка соединения...', colors.yellow);
    const timeResult = await pool.query('SELECT NOW() as time');
    log('✅ Соединение успешно установлено!', colors.green);
    log(`⏰ Время на сервере: ${timeResult.rows[0].time}`, colors.green);
    
    // Проверка существующих таблиц
    log('\n📋 Список таблиц в базе данных:', colors.blue);
    const tablesResult = await pool.query(`
      SELECT table_name, 
             (SELECT COUNT(*) FROM information_schema.columns 
              WHERE table_name = t.table_name AND table_schema = 'public') as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    if (tablesResult.rows.length === 0) {
      log('⚠️ Не найдено ни одной таблицы в базе данных!', colors.yellow);
    } else {
      tablesResult.rows.forEach(table => {
        log(`📝 ${table.table_name} (${table.column_count} колонок)`, colors.green);
      });
    }
    
    // Проверка количества пользователей и транзакций
    const userCount = await pool.query('SELECT COUNT(*) FROM users');
    log(`\n👤 Количество пользователей: ${userCount.rows[0].count}`, colors.blue);
    
    // Проверим теперь партиционирование таблицы transactions
    log('\n📊 Проверка партиционирования таблицы transactions:', colors.blue);
    try {
      const partitionCheck = await pool.query(`
        SELECT p.relname as parent_table,
               c.relname as child_table,
               pg_get_expr(c.relpartbound, c.oid) as partition_expression
        FROM pg_inherits i
        JOIN pg_class p ON i.inhparent = p.oid
        JOIN pg_class c ON i.inhrelid = c.oid
        WHERE p.relname = 'transactions'
      `);
      
      if (partitionCheck.rows.length === 0) {
        log('⚠️ Таблица transactions не партиционирована!', colors.yellow);
      } else {
        log(`✅ Таблица transactions партиционирована на ${partitionCheck.rows.length} частей:`, colors.green);
        partitionCheck.rows.forEach(partition => {
          log(`   - ${partition.child_table}: ${partition.partition_expression}`, colors.green);
        });
      }
    } catch (error) {
      log(`❌ Ошибка при проверке партиционирования: ${error.message}`, colors.red);
    }
    
    // Проверяем наличие хранимых процедур
    log('\n🧪 Проверка хранимых процедур для управления партициями:', colors.blue);
    const proceduresResult = await pool.query(`
      SELECT proname, prosrc
      FROM pg_proc 
      WHERE proname LIKE '%partition%'
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    `);
    
    if (proceduresResult.rows.length === 0) {
      log('⚠️ Не найдено хранимых процедур для управления партициями!', colors.yellow);
    } else {
      log(`✅ Найдено ${proceduresResult.rows.length} хранимых процедур:`, colors.green);
      proceduresResult.rows.forEach(proc => {
        log(`   - ${proc.proname}`, colors.green);
      });
    }
    
  } catch (error) {
    log(`❌ Ошибка подключения к базе данных: ${error.message}`, colors.red);
    console.error(error);
  } finally {
    await pool.end();
    log('\n📝 Проверка завершена!', colors.blue);
  }
}

testNeonDbConnection().catch(error => {
  console.error('Необработанная ошибка:', error);
});