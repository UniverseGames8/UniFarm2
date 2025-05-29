/**
 * Скрипт для проверки соединения с базой данных PostgreSQL
 * 
 * Запускает тестовое подключение к БД и выполняет простой запрос
 */

import { Pool } from 'pg';

// Определяем настройки подключения в зависимости от DATABASE_URL
let connectionConfig;
let dbProvider = 'replit'; // По умолчанию используем Replit

// Если есть DATABASE_URL, используем его для подключения
if (process.env.DATABASE_URL) {
  connectionConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
  };
  dbProvider = process.env.DATABASE_URL.includes('neon') ? 'neon' : 'external';
} else {
  // Настройки для локального PostgreSQL от Replit
  connectionConfig = {
    host: 'localhost',
    port: 5432,
    user: 'runner',
    password: '',
    database: 'postgres',
  };
}

console.log(`🔍 Проверка соединения с ${dbProvider} PostgreSQL...`);
console.log('📝 Настройки подключения:');

if (connectionConfig.connectionString) {
  // Для подключения через URL скрываем пароль, если он есть
  let safeUrl = connectionConfig.connectionString.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
  console.log(`  Connection URL: ${safeUrl}`);
} else {
  // Для прямого подключения
  console.log(`  Host: ${connectionConfig.host}`);
  console.log(`  Port: ${connectionConfig.port}`);
  console.log(`  User: ${connectionConfig.user}`);
  console.log(`  Database: ${connectionConfig.database}`);
}

async function checkDatabaseConnection() {
  const pool = new Pool(connectionConfig);
  
  try {
    // Тестовое подключение
    console.log('🔄 Выполнение подключения...');
    const client = await pool.connect();
    console.log('✅ Подключение установлено успешно');
    
    // Тестовый запрос
    console.log('🔄 Выполнение тестового запроса...');
    const result = await client.query('SELECT current_timestamp as time, current_database() as db_name');
    console.log('✅ Запрос выполнен успешно');
    console.log('📊 Результат запроса:');
    console.log(`  Текущее время сервера: ${result.rows[0].time}`);
    console.log(`  Текущая база данных: ${result.rows[0].db_name}`);
    
    // Проверка таблиц
    console.log('🔄 Получение списка таблиц...');
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    if (tables.rows.length > 0) {
      console.log(`✅ Найдено ${tables.rows.length} таблиц в базе данных:`);
      tables.rows.forEach((row, index) => {
        console.log(`  ${index + 1}. ${row.table_name}`);
      });
    } else {
      console.log('ℹ️ Таблицы не найдены. База данных пуста или требуется миграция.');
    }
    
    // Освобождение соединения
    client.release();
    await pool.end();
    
    console.log('✅ Проверка соединения завершена успешно');
    return true;
  } catch (error) {
    console.error('❌ Ошибка при подключении к базе данных:', error.message);
    if (error.code) {
      console.error(`📌 Код ошибки: ${error.code}`);
    }
    
    try {
      await pool.end();
    } catch (endError) {
      // Игнорируем ошибку закрытия пула
    }
    
    console.log('💡 Рекомендации:');
    console.log('  1. Убедитесь, что сервис PostgreSQL запущен в Replit');
    console.log('  2. Проверьте, что переменные окружения установлены корректно');
    console.log('  3. Используйте DATABASE_PROVIDER=replit при запуске приложения');
    
    return false;
  }
}

// Запускаем проверку
checkDatabaseConnection();