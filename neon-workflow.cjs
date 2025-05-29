/**
 * Скрипт для запуска приложения через рабочий процесс (workflow) Replit
 * с принудительным использованием Neon DB
 */

// Загружаем переменные окружения из .env.neon
require('dotenv').config({ path: '.env.neon' });

// Принудительно устанавливаем переменные окружения для Neon DB
process.env.DATABASE_PROVIDER = 'neon';
process.env.FORCE_NEON_DB = 'true';
process.env.DISABLE_REPLIT_DB = 'true';
process.env.OVERRIDE_DB_PROVIDER = 'neon';
process.env.NODE_ENV = 'production';

console.log('===============================================');
console.log('🚀 Запуск UniFarm с принудительным использованием Neon DB');
console.log('===============================================');
console.log('📊 Настройки базы данных:');
console.log('  DATABASE_PROVIDER:', process.env.DATABASE_PROVIDER);
console.log('  FORCE_NEON_DB:', process.env.FORCE_NEON_DB);
console.log('  DISABLE_REPLIT_DB:', process.env.DISABLE_REPLIT_DB);
console.log('  NODE_ENV:', process.env.NODE_ENV);
console.log('===============================================');

// Проверка наличия строки подключения
if (!process.env.DATABASE_URL) {
  console.error('❌ ERROR: Переменная DATABASE_URL не найдена!');
  console.error('Убедитесь, что файл .env.neon существует и содержит DATABASE_URL');
  process.exit(1);
}

// Проверка доступности базы данных перед запуском
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.query('SELECT NOW() as now')
  .then(result => {
    console.log('✅ Подключение к Neon DB успешно установлено');
    console.log(`  Время сервера: ${result.rows[0].now}`);
    console.log('===============================================');
    
    // Запускаем приложение
    console.log('🚀 Запуск сервера...');
    require('./dist/index.js');
  })
  .catch(err => {
    console.error('❌ Ошибка при подключении к Neon DB:', err.message);
    console.error('Проверьте настройки подключения в .env.neon');
    process.exit(1);
  });