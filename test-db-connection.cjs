/**
 * Простой скрипт для проверки подключения к базе данных
 * Проверяет, что принудительные настройки Neon DB работают
 */

require('dotenv').config({ path: '.env.neon' });

// Форсируем настройки Neon DB
process.env.DATABASE_PROVIDER = 'neon';
process.env.FORCE_NEON_DB = 'true';
process.env.DISABLE_REPLIT_DB = 'true';
process.env.OVERRIDE_DB_PROVIDER = 'neon';

// Подключаемся к базе данных
const { Pool } = require('pg');

async function testDatabaseConnection() {
  console.log('Проверка подключения к базе данных...');
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✓ Установлено' : '❌ Отсутствует');
  console.log('DATABASE_PROVIDER:', process.env.DATABASE_PROVIDER);
  console.log('FORCE_NEON_DB:', process.env.FORCE_NEON_DB);
  
  // Подключаемся к базе данных
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    
    // Выполняем простой запрос для проверки соединения
    const client = await pool.connect();
    console.log('✓ Подключение к базе данных успешно установлено');
    
    // Проверяем список таблиц в базе данных
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log(`✓ Найдено ${result.rowCount} таблиц в базе данных:`);
    result.rows.forEach((row, index) => {
      console.log(`  ${index + 1}. ${row.table_name}`);
    });
    
    client.release();
    await pool.end();
  } catch (error) {
    console.error('❌ Ошибка подключения к базе данных:', error.message);
  }
}

testDatabaseConnection();