/**
 * Скрипт прямого подключения к Neon DB с базовой проверкой работоспособности
 * 
 * Использует CommonJS вместо ES модулей для совместимости
 */

require('dotenv').config({ path: '.env.neon' });
const { Pool } = require('pg');
const fs = require('fs');

// Цвета для вывода в консоль
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// Главная функция проверки подключения
async function checkNeonConnection() {
  log('\n🌟 Прямое подключение к Neon DB...', colors.cyan + colors.bold);
  
  // Принудительно устанавливаем настройки для Neon DB
  process.env.FORCE_NEON_DB = 'true';
  process.env.DISABLE_REPLIT_DB = 'true';
  process.env.OVERRIDE_DB_PROVIDER = 'neon';
  process.env.DATABASE_PROVIDER = 'neon';
  process.env.USE_LOCAL_DB_ONLY = 'false';
  process.env.NODE_ENV = 'production';
  
  // Проверяем наличие переменной окружения
  if (!process.env.DATABASE_URL) {
    log('❌ Ошибка: Переменная DATABASE_URL не установлена', colors.red);
    log('Загружаем переменные из .env.neon...');
    
    // Пытаемся загрузить из .env.neon
    if (fs.existsSync('.env.neon')) {
      const envContent = fs.readFileSync('.env.neon', 'utf-8');
      const envLines = envContent.split('\n');
      
      envLines.forEach(line => {
        if (line && !line.startsWith('#')) {
          const [key, ...valueParts] = line.split('=');
          if (key && valueParts.length) {
            process.env[key.trim()] = valueParts.join('=').trim();
          }
        }
      });
      
      log('✅ Переменные из .env.neon загружены', colors.green);
    } else {
      log('❌ Файл .env.neon не найден', colors.red);
      process.exit(1);
    }
  }
  
  // Проверяем, что в строке подключения есть neon.tech
  if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes('neon.tech')) {
    log('❌ Ошибка: DATABASE_URL не указывает на Neon DB', colors.red);
    log(`Текущее значение: ${process.env.DATABASE_URL?.replace(/:[^:]*@/, ':***@')}`, colors.yellow);
    process.exit(1);
  }
  
  // Проверяем, что в строке подключения есть sslmode=require
  if (!process.env.DATABASE_URL.includes('sslmode=require')) {
    log('⚠️ Предупреждение: В строке подключения отсутствует sslmode=require', colors.yellow);
    log('Добавляем параметр sslmode=require в URL подключения', colors.yellow);
    
    const url = process.env.DATABASE_URL;
    process.env.DATABASE_URL = url.includes('?') 
      ? `${url}&sslmode=require` 
      : `${url}?sslmode=require`;
  }
  
  log(`🔑 Подключение к Neon DB с URL: ${process.env.DATABASE_URL.replace(/:[^:]*@/, ':***@')}`, colors.blue);
  
  let pool;
  try {
    // Создаем пул подключений
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: true
      },
      max: 10, // максимальное количество клиентов в пуле
      idleTimeoutMillis: 30000, // время ожидания перед закрытием неиспользуемых соединений
      connectionTimeoutMillis: 8000, // время ожидания при подключении нового клиента
    });
    
    pool.on('error', (err) => {
      log(`❌ Ошибка пула соединений: ${err.message}`, colors.red);
    });
    
    // Пытаемся подключиться
    const client = await pool.connect();
    
    // Проверяем соединение простым запросом
    const result = await client.query('SELECT NOW() as time');
    const time = result.rows[0].time;
    
    log(`✅ Подключение к Neon DB успешно установлено!`, colors.green);
    log(`📅 Время на сервере: ${time}`, colors.cyan);
    
    // Проверяем доступность таблиц
    try {
      const tablesResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `);
      
      if (tablesResult.rows.length > 0) {
        log(`\n📋 Обнаружены таблицы в базе данных (${tablesResult.rows.length}):`, colors.cyan);
        tablesResult.rows.forEach((row, index) => {
          if (index < 15) { // Ограничиваем вывод первыми 15 таблицами
            log(`   - ${row.table_name}`, colors.cyan);
          } else if (index === 15) {
            log(`   - ... и ещё ${tablesResult.rows.length - 15} таблиц`, colors.cyan);
          }
        });
      } else {
        log('⚠️ В базе данных не обнаружено таблиц в схеме public', colors.yellow);
      }
      
      // Проверяем наличие записей в таблице users
      const usersResult = await client.query('SELECT COUNT(*) FROM users');
      log(`\n👤 Количество пользователей в базе данных: ${usersResult.rows[0].count}`, colors.green);
      
      // Проверяем наличие записей в таблице transactions
      const transactionsResult = await client.query('SELECT COUNT(*) FROM transactions');
      log(`💰 Количество транзакций в базе данных: ${transactionsResult.rows[0].count}`, colors.green);
      
      // Проверяем наличие записей в таблице referrals
      const referralsResult = await client.query('SELECT COUNT(*) FROM referrals');
      log(`👥 Количество реферальных связей в базе данных: ${referralsResult.rows[0].count}`, colors.green);
      
      // Проверяем наличие партиций
      try {
        const partitionsResult = await client.query(`
          SELECT child.relname AS partition_name
          FROM pg_inherits
          JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
          JOIN pg_class child ON pg_inherits.inhrelid = child.oid
          JOIN pg_namespace nmsp_parent ON nmsp_parent.oid = parent.relnamespace
          JOIN pg_namespace nmsp_child ON nmsp_child.oid = child.relnamespace
          WHERE parent.relname = 'transactions'
          ORDER BY child.relname
        `);
        
        if (partitionsResult.rows.length > 0) {
          log(`\n📊 Обнаружены партиции для таблицы transactions (${partitionsResult.rows.length}):`, colors.magenta);
          partitionsResult.rows.forEach((row, index) => {
            if (index < 10) { // Ограничиваем вывод первыми 10 партициями
              log(`   - ${row.partition_name}`, colors.magenta);
            } else if (index === 10) {
              log(`   - ... и ещё ${partitionsResult.rows.length - 10} партиций`, colors.magenta);
            }
          });
        } else {
          log('⚠️ Для таблицы transactions не обнаружено партиций', colors.yellow);
        }
      } catch (err) {
        log(`⚠️ Ошибка при проверке партиций: ${err.message}`, colors.yellow);
      }
      
    } catch (err) {
      log(`⚠️ Не удалось выполнить запросы к базе данных: ${err.message}`, colors.yellow);
    }
    
    // Выполняем запрос к partition_logs
    try {
      // Проверяем структуру таблицы partition_logs
      const partitionLogsStructure = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'partition_logs'
      `);
      
      log('\n📝 Структура таблицы partition_logs:', colors.cyan);
      partitionLogsStructure.rows.forEach(row => {
        log(`   - ${row.column_name}: ${row.data_type}`, colors.cyan);
      });
      
      // Проверяем, правильная ли структура для исправления ошибки
      const hasOperationTypeField = partitionLogsStructure.rows.some(row => 
        row.column_name === 'operation_type'
      );
      
      const hasOperationField = partitionLogsStructure.rows.some(row => 
        row.column_name === 'operation'
      );
      
      if (hasOperationTypeField) {
        log('✅ В таблице partition_logs есть поле operation_type', colors.green);
      } else if (hasOperationField) {
        log('✅ В таблице partition_logs есть поле operation', colors.green);
        log('⚠️ Необходимо исправить код для использования поля operation вместо operation_type', colors.yellow);
      } else {
        log('❌ В таблице partition_logs нет ни operation_type, ни operation', colors.red);
      }
    } catch (err) {
      log(`⚠️ Ошибка при проверке структуры partition_logs: ${err.message}`, colors.yellow);
    }
    
    // Освобождаем клиента
    client.release();
    
    return true;
  } catch (err) {
    log(`❌ Ошибка подключения к Neon DB: ${err.message}`, colors.red);
    
    if (err.message.includes('self signed certificate')) {
      log('\n🔒 Проблема с SSL-сертификатом. Проверьте, что в DATABASE_URL указан параметр sslmode=require', colors.yellow);
    } else if (err.message.includes('connection refused')) {
      log('\n🌐 Не удалось установить соединение с сервером. Возможно, сервер недоступен', colors.yellow);
    } else if (err.message.includes('password authentication failed')) {
      log('\n🔑 Ошибка аутентификации. Проверьте правильность указанного пароля', colors.yellow);
    } else if (err.message.includes('database') && err.message.includes('does not exist')) {
      log('\n📁 Указанная база данных не существует', colors.yellow);
    }
    
    return false;
  } finally {
    if (pool) {
      await pool.end();
      log('🔄 Соединение с базой данных закрыто', colors.blue);
    }
  }
}

// Запускаем проверку при выполнении скрипта напрямую
if (require.main === module) {
  checkNeonConnection().then(success => {
    if (!success) {
      process.exit(1);
    }
  });
}

module.exports = { checkNeonConnection };