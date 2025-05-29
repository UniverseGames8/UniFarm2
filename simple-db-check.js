/**
 * Простой скрипт для проверки подключения к базе данных
 */

import { Pool } from 'pg';

// Создание пула соединений
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  // Установка таймаута подключения в 5 секунд
  connectionTimeoutMillis: 5000,
});

// Быстрая проверка подключения
pool.query('SELECT 1')
  .then(() => {
    console.log('✅ Успешное подключение к базе данных');
    return pool.query('SELECT current_database() as db, current_schema() as schema');
  })
  .then(res => {
    console.log(`🔍 База данных: ${res.rows[0].db}, Схема: ${res.rows[0].schema}`);
    console.log('Закрытие соединения...');
    return pool.end();
  })
  .then(() => {
    console.log('✅ Соединение закрыто');
  })
  .catch(err => {
    console.error('❌ Ошибка подключения к базе данных:', err.message);
    pool.end();
  });