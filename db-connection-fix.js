/**
 * Улучшенный фикс для подключения к базе данных Neon
 * Предотвращает использование Unix socket и принудительно настраивает TCP/IP соединение
 * 
 * Этот модуль должен быть импортирован в начале файлов, работающих с базой данных
 */

// Предотвращаем использование Unix socket для PostgreSQL
process.env.PGHOST = process.env.PGHOST || 'ep-misty-brook-a4dkea48.us-east-1.aws.neon.tech';  
process.env.PGSSLMODE = process.env.PGSSLMODE || 'prefer';
process.env.PGSOCKET = '';
process.env.PGCONNECT_TIMEOUT = process.env.PGCONNECT_TIMEOUT || '10';

// Принудительно настраиваем использование Neon DB
process.env.DATABASE_PROVIDER = 'neon';
process.env.FORCE_NEON_DB = 'true';
process.env.DISABLE_REPLIT_DB = 'true';
process.env.OVERRIDE_DB_PROVIDER = 'neon';

// Выводим сообщение о применении фикса только если запущен непосредственно
if (require.main === module) {
  console.log('[Database Fix] ✅ Фикс подключения к БД успешно настроен');
  console.log('[Database Fix] Настройки подключения:');
  console.log(`- DATABASE_PROVIDER = ${process.env.DATABASE_PROVIDER}`);
  console.log(`- PGHOST = ${process.env.PGHOST}`);
  console.log(`- PGSSLMODE = ${process.env.PGSSLMODE}`);
  console.log(`- PGCONNECT_TIMEOUT = ${process.env.PGCONNECT_TIMEOUT}`);
  
  // Проверяем наличие DATABASE_URL
  if (process.env.DATABASE_URL) {
    console.log('[Database Fix] ✅ DATABASE_URL настроен');
  } else {
    console.error('[Database Fix] ❌ DATABASE_URL не установлен!');
  }
}

/**
 * Функция для проверки подключения к базе данных
 * @returns {Promise<boolean>} Результат проверки подключения
 */
async function testDatabaseConnection() {
  const { Pool } = require('pg');
  
  // Проверяем DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.error('[Database Fix] ❌ DATABASE_URL не установлен!');
    return false;
  }
  
  // Создаем пул соединений с настройками Neon DB
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Для Neon DB
    },
    max: 3, // Ограничиваем размер пула
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000
  });

  try {
    // Пытаемся получить клиента из пула
    const client = await pool.connect();
    
    // Выполняем простой запрос
    const result = await client.query('SELECT NOW() as time');
    
    // Освобождаем клиента
    client.release();
    
    // Закрываем пул
    await pool.end();
    
    console.log(`[Database Fix] ✅ Подключение к БД успешно установлено. Текущее время: ${result.rows[0].time}`);
    return true;
  } catch (error) {
    console.error(`[Database Fix] ❌ Ошибка при подключении к базе данных: ${error.message}`);
    
    if (error.message.includes('ENOENT') || error.message.includes('socket')) {
      console.error('[Database Fix] 🔍 Обнаружена ошибка с Unix socket. Фикс не сработал.');
    }
    
    try {
      await pool.end();
    } catch (e) {
      // Игнорируем ошибки при закрытии пула
    }
    
    return false;
  }
}

// Экспортируем функцию проверки соединения
module.exports = {
  testDatabaseConnection
};

// Выполняем проверку соединения, если файл запущен напрямую
if (require.main === module) {
  testDatabaseConnection()
    .then(success => {
      if (!success) {
        console.error('[Database Fix] ❌ Проверка соединения с базой данных не пройдена');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error(`[Database Fix] ❌ Необработанная ошибка: ${error.message}`);
      process.exit(1);
    });
}