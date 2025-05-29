/**
 * Скрипт для диагностики подключения к базе данных PostgreSQL
 * Проверяет подключение с разными настройками и выводит подробную информацию
 */

import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;
dotenv.config();

// Журналирование
function log(message, type = 'INFO') {
  const time = new Date().toISOString();
  console.log(`[${time}] [${type}] ${message}`);
}

// Функция для тестирования подключения с определенными параметрами
async function testConnection(config) {
  log(`Тестирую подключение с настройками: ${JSON.stringify({
    ...config,
    password: config.password ? '***' : undefined,
    connectionString: config.connectionString ? '***' : undefined,
  })}`);
  
  const pool = new Pool(config);
  let client;
  
  try {
    // Получаем соединение из пула
    client = await pool.connect();
    log('✅ Соединение успешно установлено!');
    
    // Проверяем работу базы данных
    const result = await client.query('SELECT NOW() as time');
    log(`✅ Запрос выполнен успешно. Время на сервере БД: ${result.rows[0].time}`);
    
    // Проверяем схему
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    if (tablesResult.rows.length === 0) {
      log('⚠️ Схема пуста. Таблицы не найдены.', 'WARN');
    } else {
      log(`📋 Найдено ${tablesResult.rows.length} таблиц:`);
      tablesResult.rows.forEach((row, i) => {
        log(`   ${i+1}. ${row.table_name}`);
      });
    }
    
    // Получаем информацию о версии PostgreSQL
    const versionResult = await client.query('SELECT version()');
    log(`📊 Версия PostgreSQL: ${versionResult.rows[0].version}`);
    
    return { success: true, tables: tablesResult.rows, version: versionResult.rows[0].version };
  } catch (error) {
    log(`❌ Ошибка подключения: ${error.message}`, 'ERROR');
    log(`Детали ошибки: ${JSON.stringify(error)}`, 'DEBUG');
    return { success: false, error: error.message };
  } finally {
    // Обязательно закрываем соединение
    if (client) {
      try {
        client.release();
        log('🔄 Соединение закрыто');
      } catch (err) {
        log(`⚠️ Ошибка при закрытии соединения: ${err.message}`, 'WARN');
      }
    }
    
    // Закрываем пул
    try {
      await pool.end();
      log('🔄 Пул соединений закрыт');
    } catch (err) {
      log(`⚠️ Ошибка при закрытии пула: ${err.message}`, 'WARN');
    }
  }
}

// Главная функция
async function runDiagnostics() {
  log('🔍 Запуск диагностики подключения к PostgreSQL...');
  
  // Выводим переменные окружения (без sensitive данных)
  log('📋 Текущие переменные окружения:');
  log(`DATABASE_URL: ${process.env.DATABASE_URL ? '***' : 'не определена'}`);
  log(`PGHOST: ${process.env.PGHOST || 'не определена'}`);
  log(`PGPORT: ${process.env.PGPORT || 'не определена'}`);
  log(`PGUSER: ${process.env.PGUSER ? '***' : 'не определена'}`);
  log(`PGDATABASE: ${process.env.PGDATABASE || 'не определена'}`);
  log(`PGSSLMODE: ${process.env.PGSSLMODE || 'не определена'}`);
  log(`REPLIT_DB_URL: ${process.env.REPLIT_DB_URL ? '***' : 'не определена'}`);
  log(`NODE_ENV: ${process.env.NODE_ENV || 'не определена'}`);
  
  // Тест 1: Подключение через DATABASE_URL
  if (process.env.DATABASE_URL) {
    log('🔄 Тест 1: Подключение через DATABASE_URL...');
    await testConnection({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });
  } else {
    log('⚠️ Тест 1 пропущен: DATABASE_URL не определен', 'WARN');
  }
  
  // Тест 2: Подключение через отдельные параметры
  if (process.env.PGHOST && process.env.PGUSER) {
    log('🔄 Тест 2: Подключение через отдельные параметры...');
    await testConnection({
      host: process.env.PGHOST,
      port: process.env.PGPORT || 5432,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE,
      ssl: {
        rejectUnauthorized: false
      }
    });
  } else {
    log('⚠️ Тест 2 пропущен: Не хватает необходимых параметров', 'WARN');
  }
  
  // Тест 3: Подключение к локальной БД (если это Replit)
  log('🔄 Тест 3: Подключение к локальной БД на Replit...');
  await testConnection({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
    ssl: false
  });
  
  log('🏁 Диагностика завершена');
}

// Запускаем диагностику
runDiagnostics().catch(err => {
  log(`❌ Неожиданная ошибка в скрипте диагностики: ${err.message}`, 'ERROR');
  log(err.stack, 'DEBUG');
});

// Экспортируем для модульной структуры
export { runDiagnostics };