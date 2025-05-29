/**
 * Скрипт для проверки статуса подключения к Neon DB
 * и сбора информации о таблицах и количестве записей
 */

const { Pool } = require('pg');
const fs = require('fs');
const dotenv = require('dotenv');
const { table } = require('console');

// Цвета для вывода в консоль
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
 * Загрузка переменных окружения для Neon DB
 */
function loadNeonEnvironment() {
  // Загружаем настройки из .env.neon
  const neonEnvPath = '.env.neon';
  if (fs.existsSync(neonEnvPath)) {
    log(`📝 Загрузка переменных из .env.neon...`, colors.blue);
    const neonConfig = dotenv.parse(fs.readFileSync(neonEnvPath));
    
    // Применяем переменные окружения из .env.neon
    for (const key in neonConfig) {
      process.env[key] = neonConfig[key];
    }
    
    log(`✅ Переменные окружения из .env.neon успешно загружены`, colors.green);
  } else {
    log(`❌ Ошибка: Файл .env.neon не найден!`, colors.red);
    return false;
  }
  
  return true;
}

/**
 * Проверка подключения к Neon DB
 */
async function checkNeonDB() {
  try {
    log(`\n${colors.blue}=== Проверка подключения к Neon DB ===${colors.reset}`);
    
    if (!process.env.DATABASE_URL) {
      log(`❌ Ошибка: DATABASE_URL не найден!`, colors.red);
      return false;
    }

    // Проверка URL на соответствие Neon DB
    if (!process.env.DATABASE_URL.includes('neon.tech')) {
      log(`⚠️ Предупреждение: DATABASE_URL не содержит neon.tech!`, colors.yellow);
      log(`⚠️ URL: ${process.env.DATABASE_URL.replace(/:[^:]*@/, ':***@')}`, colors.yellow);
    }
    
    // Подключение к базе данных
    log(`🔌 Подключение к базе данных...`, colors.blue);
    const pool = new Pool({ 
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false // Для подключения к Neon DB через SSL
      }
    });
    
    // Проверка подключения
    const client = await pool.connect();
    log(`✅ Подключение к Neon DB успешно установлено!`, colors.green);
    
    // Получение списка таблиц
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    log(`\n📋 Список таблиц в базе данных (${tablesResult.rows.length}):`, colors.blue);
    const tableNames = tablesResult.rows.map(row => row.table_name);
    tableNames.forEach((name, index) => {
      log(`   ${index + 1}. ${name}`, colors.cyan);
    });
    
    // Получение количества записей для основных таблиц
    log(`\n${colors.blue}=== Статистика основных таблиц ===${colors.reset}`);
    
    const tables = ['users', 'wallets', 'transactions', 'referrals', 'farming_deposits'];
    const counts = {};
    
    for (const tableName of tables) {
      if (tableNames.includes(tableName)) {
        const countResult = await client.query(`SELECT COUNT(*) FROM ${tableName}`);
        counts[tableName] = parseInt(countResult.rows[0].count);
        log(`📊 ${tableName}: ${counts[tableName]} записей`, colors.cyan);
      } else {
        log(`⚠️ Таблица ${tableName} не найдена в базе данных!`, colors.yellow);
      }
    }
    
    // Проверка партиционирования
    log(`\n${colors.blue}=== Проверка партиционирования транзакций ===${colors.reset}`);
    
    if (tableNames.includes('transactions')) {
      try {
        const partitionResult = await client.query(`
          SELECT
            parent.relname AS parent_table,
            child.relname AS partition_name
          FROM pg_inherits
          JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
          JOIN pg_class child ON pg_inherits.inhrelid = child.oid
          JOIN pg_namespace nmsp_parent ON nmsp_parent.oid = parent.relnamespace
          JOIN pg_namespace nmsp_child ON nmsp_child.oid = child.relnamespace
          WHERE parent.relname = 'transactions'
          ORDER BY child.relname;
        `);
        
        if (partitionResult.rows.length > 0) {
          log(`✅ Транзакции разделены на ${partitionResult.rows.length} партиций:`, colors.green);
          partitionResult.rows.forEach((row, index) => {
            log(`   ${index + 1}. ${row.partition_name}`, colors.cyan);
          });
        } else {
          log(`⚠️ Партиционирование для таблицы transactions не настроено!`, colors.yellow);
        }
      } catch (error) {
        log(`⚠️ Не удалось проверить партиционирование: ${error.message}`, colors.yellow);
      }
    }
    
    // Освобождение соединения
    client.release();
    await pool.end();
    
    return true;
  } catch (error) {
    log(`\n❌ Ошибка при проверке Neon DB: ${error.message}`, colors.red);
    console.error(error);
    return false;
  }
}

/**
 * Основная функция
 */
async function main() {
  log(`\n${colors.magenta}=========================================${colors.reset}`);
  log(`${colors.magenta}= ПРОВЕРКА СТАТУСА NEON DB ДЛЯ UNIFARM =${colors.reset}`);
  log(`${colors.magenta}=========================================${colors.reset}`);
  
  // Загрузка переменных окружения
  if (!loadNeonEnvironment()) {
    log(`\n❌ Не удалось загрузить переменные окружения для Neon DB`, colors.red);
    process.exit(1);
  }
  
  // Проверка подключения к Neon DB
  const success = await checkNeonDB();
  
  if (success) {
    log(`\n${colors.green}✅ Проверка подключения к Neon DB успешно завершена!${colors.reset}`);
    log(`${colors.blue}💡 Подсказка: Для запуска приложения с Neon DB используйте:${colors.reset}`);
    log(`   node start-neon.cjs`, colors.cyan);
  } else {
    log(`\n${colors.red}❌ Проверка подключения к Neon DB завершилась с ошибками!${colors.reset}`);
    process.exit(1);
  }
}

// Запуск основной функции
main();