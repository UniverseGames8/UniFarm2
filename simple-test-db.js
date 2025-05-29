/**
 * Упрощенный скрипт для проверки подключения к базе данных
 * без внешних зависимостей
 */

// Подключаем фикс для базы данных
import './db-connect-fix.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Pool } = require('pg');

// Основные переменные для проверки
console.log('====== ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ ДЛЯ БАЗЫ ДАННЫХ ======');
console.log('DATABASE_PROVIDER =', process.env.DATABASE_PROVIDER || 'не установлена');
console.log('FORCE_NEON_DB =', process.env.FORCE_NEON_DB || 'не установлена');
console.log('DISABLE_REPLIT_DB =', process.env.DISABLE_REPLIT_DB || 'не установлена');
console.log('OVERRIDE_DB_PROVIDER =', process.env.OVERRIDE_DB_PROVIDER || 'не установлена');
console.log('PGSSLMODE =', process.env.PGSSLMODE || 'не установлена');
console.log('PGSOCKET =', process.env.PGSOCKET || 'не установлена (это нормально)');
console.log('PGCONNECT_TIMEOUT =', process.env.PGCONNECT_TIMEOUT || 'не установлена');

// Создание пула подключений
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL не найден');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Добавляем обработчики событий
pool.on('error', (err) => {
  console.error('❌ Ошибка пула соединений:', err.message);
});

pool.on('connect', () => {
  console.log('✅ Успешное соединение с базой данных');
});

// Тестовый запрос
(async () => {
  console.log('\n====== ТЕСТОВОЕ ПОДКЛЮЧЕНИЕ К БАЗЕ ДАННЫХ ======');
  
  try {
    console.log('🔄 Попытка соединения с базой данных...');
    const client = await pool.connect();
    console.log('✅ Соединение с базой данных успешно установлено');
    
    // Проверка версии PostgreSQL
    const versionResult = await client.query('SELECT version()');
    console.log('📊 Версия PostgreSQL:', versionResult.rows[0].version);
    
    // Проверка таблиц в базе данных
    console.log('\n🔄 Проверка таблиц в базе данных...');
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
      LIMIT 5;
    `);
    
    if (tablesResult.rows.length === 0) {
      console.log('⚠️ Таблицы не найдены в схеме public');
    } else {
      console.log(`✅ Найдено ${tablesResult.rows.length} таблиц, первые 5:`);
      tablesResult.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. ${row.table_name}`);
      });
    }
    
    client.release();
    console.log('\n✅ Проверка базы данных успешно завершена');
    
  } catch (error) {
    console.error('❌ Ошибка при подключении к базе данных:', error.message);
    console.error('  Полная ошибка:', error);
  } finally {
    await pool.end();
  }
})();