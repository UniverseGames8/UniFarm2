/**
 * Скрипт для проверки соединения с локальной базой данных PostgreSQL на Replit
 * Принудительно использует локальное подключение, игнорируя переменные окружения
 */

import { Pool } from 'pg';

// Явные настройки подключения к локальному PostgreSQL от Replit
const connectionConfig = {
  host: 'localhost',
  port: 5432,
  user: 'runner',
  password: '',
  database: 'postgres',
};

console.log('🔍 Проверка принудительного соединения с локальной PostgreSQL на Replit...');
console.log('📝 Настройки подключения:');
console.log(`  Host: ${connectionConfig.host}`);
console.log(`  Port: ${connectionConfig.port}`);
console.log(`  User: ${connectionConfig.user}`);
console.log(`  Database: ${connectionConfig.database}`);

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
    
    // Создание тестовой таблицы, если ещё не существует
    console.log('🔄 Создание тестовой таблицы...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS test_connection (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        message TEXT
      )
    `);
    console.log('✅ Тестовая таблица создана или уже существует');
    
    // Вставка тестовой записи
    console.log('🔄 Вставка тестовой записи...');
    const insertResult = await client.query(`
      INSERT INTO test_connection (message) 
      VALUES ('Тест подключения выполнен успешно в ' || CURRENT_TIMESTAMP::TEXT)
      RETURNING id
    `);
    console.log(`✅ Тестовая запись добавлена с ID: ${insertResult.rows[0].id}`);
    
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
    console.log('  1. Проверьте, запущен ли сервис PostgreSQL в вашем Replit');
    console.log('  2. Перезапустите Replit или создайте новую базу данных PostgreSQL в интерфейсе Replit');
    console.log('  3. Если ошибка сохраняется, обратитесь в поддержку Replit');
    
    return false;
  }
}

// Запускаем проверку
checkDatabaseConnection();