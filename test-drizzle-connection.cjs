/**
 * Скрипт для проверки подключения к базе данных через Drizzle ORM
 */

require('dotenv').config({ path: '.env.neon' });

// Форсируем настройки Neon DB
process.env.DATABASE_PROVIDER = 'neon';
process.env.FORCE_NEON_DB = 'true';
process.env.DISABLE_REPLIT_DB = 'true';
process.env.OVERRIDE_DB_PROVIDER = 'neon';

// Импортируем пул подключений PostgreSQL
const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');

async function testDrizzleConnection() {
  console.log('Проверка подключения через Drizzle ORM...');
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✓ Установлено' : '❌ Отсутствует');
  
  try {
    // Создаем подключение к базе данных
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    
    // Инициализируем Drizzle ORM
    const db = drizzle(pool);
    
    // Выполняем запрос для проверки соединения
    const query = 'SELECT NOW() as current_time';
    const result = await db.execute(query);
    
    console.log('✓ Drizzle ORM подключение успешно');
    console.log('Текущее время сервера:', result[0].current_time);
    
    // Запрашиваем метаданные схемы
    console.log('Проверка структуры базы данных...');
    
    const schemaQuery = `
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
      LIMIT 20;
    `;
    
    const schemaResult = await db.execute(schemaQuery);
    
    console.log('Образец структуры таблиц (первые 20 колонок):');
    let currentTable = '';
    
    schemaResult.forEach(row => {
      if (currentTable !== row.table_name) {
        currentTable = row.table_name;
        console.log(`\nТаблица: ${currentTable}`);
      }
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });
    
    await pool.end();
  } catch (error) {
    console.error('❌ Ошибка при работе с Drizzle ORM:', error.message);
    if (error.stack) {
      console.error('Стек ошибки:', error.stack);
    }
  }
}

testDrizzleConnection();