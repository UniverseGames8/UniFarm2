/**
 * Скрипт для проверки подключения к Neon DB
 */

require('dotenv').config({ path: '.env.neon' });
const { Pool } = require('pg');
const fs = require('fs');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function loadEnvFromFile() {
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
    log('⚠️ Файл .env.neon не найден', colors.yellow);
  }
}

async function checkNeonConnection() {
  log('\n🔍 Проверка подключения к Neon DB...', colors.cyan);
  
  // Загружаем переменные из .env.neon, если необходимо
  if (!process.env.DATABASE_URL) {
    loadEnvFromFile();
  }
  
  // Проверяем наличие переменной окружения
  if (!process.env.DATABASE_URL) {
    log('❌ Ошибка: Переменная DATABASE_URL не установлена', colors.red);
    process.exit(1);
  }
  
  // Проверяем, что в строке подключения есть neon.tech
  if (!process.env.DATABASE_URL.includes('neon.tech')) {
    log('❌ Ошибка: DATABASE_URL не указывает на Neon DB', colors.red);
    log(`Текущее значение: ${process.env.DATABASE_URL.replace(/:[^:]*@/, ':***@')}`, colors.yellow);
    process.exit(1);
  }
  
  // Проверяем, что в строке подключения есть sslmode=require
  if (!process.env.DATABASE_URL.includes('sslmode=require')) {
    log('⚠️ Предупреждение: В строке подключения отсутствует sslmode=require', colors.yellow);
    log('Попытаемся добавить параметр sslmode=require в URL подключения', colors.cyan);
    
    const url = process.env.DATABASE_URL;
    process.env.DATABASE_URL = url.includes('?') 
      ? `${url}&sslmode=require` 
      : `${url}?sslmode=require`;
  }
  
  let pool;
  try {
    // Создаем пул подключений
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: true }
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
    } catch (err) {
      log(`⚠️ Не удалось получить список таблиц: ${err.message}`, colors.yellow);
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
      pool.end();
    }
  }
}

// Самостоятельный запуск скрипта
if (require.main === module) {
  (async () => {
    const success = await checkNeonConnection();
    if (!success) {
      process.exit(1);
    }
  })();
}

module.exports = { checkNeonConnection };