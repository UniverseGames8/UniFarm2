/**
 * Скрипт для создания базы данных Neon с полной схемой Drizzle
 * 
 * ВНИМАНИЕ: Это прямой скрипт, который обходит селектор базы данных
 * и напрямую создает таблицы в Neon DB через схему Drizzle
 */

import 'dotenv/config';
import fs from 'fs';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pkg from 'pg';
const { Pool } = pkg;

// Загружаем настройки из .env.neon
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
  
  console.log('✅ Переменные из .env.neon загружены');
}

// Проверка наличия строки подключения к Neon DB
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes('neon.tech')) {
  console.error('❌ Ошибка: DATABASE_URL не указывает на Neon DB');
  console.error('Убедитесь, что в файле .env.neon указан правильный URL для Neon DB');
  process.exit(1);
}

// Создаем пул соединений с Neon DB
console.log('🔄 Инициализация соединения с Neon DB...');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: true
  }
});

// Импортируем схему Drizzle
import * as schema from './shared/schema.js';

// Создаем экземпляр Drizzle с нашей схемой
const db = drizzle(pool, { schema });

console.log('🛠️ Начало создания таблиц в базе Neon DB...');

// Проверяем соединение и создаем таблицы
try {
  // Проверка соединения
  const result = await pool.query('SELECT NOW() AS time');
  console.log(`✅ Соединение с Neon DB установлено. Время на сервере: ${result.rows[0].time}`);
  
  // Получаем список существующих таблиц
  const existingTables = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
  `);
  
  if (existingTables.rows.length > 0) {
    console.log('📋 В базе данных уже есть таблицы:');
    existingTables.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });
    
    console.log('\n⚠️ Некоторые таблицы уже существуют. Проверьте схему перед созданием новых таблиц.');
    
    // Проверяем основные таблицы приложения
    const requiredTables = ['users', 'transactions', 'referrals'];
    const missingTables = requiredTables.filter(tableName => 
      !existingTables.rows.some(row => row.table_name === tableName)
    );
    
    if (missingTables.length > 0) {
      console.log(`❌ Отсутствуют важные таблицы: ${missingTables.join(', ')}`);
    } else {
      console.log('✅ Все основные таблицы приложения присутствуют.');
    }
  } else {
    console.log('📋 База данных пуста. Создаем таблицы...');
    
    // Создаем таблицы через drizzle-orm
    try {
      // Создаем временную директорию для миграций, если её нет
      const migrationsDir = './drizzle';
      if (!fs.existsSync(migrationsDir)) {
        fs.mkdirSync(migrationsDir, { recursive: true });
      }
      
      // Применяем миграцию на основе схемы
      await migrate(db, { migrationsFolder: migrationsDir });
      console.log('✅ Таблицы успешно созданы в Neon DB');
    } catch (error) {
      console.error('❌ Ошибка при создании таблиц:', error.message);
    }
  }
  
  // Проверка связи с новыми таблицами
  try {
    const usersCount = await db.query.users.count();
    console.log(`✅ Таблица users доступна и содержит ${usersCount} записей`);
  } catch (error) {
    console.error('❌ Ошибка при проверке таблицы users:', error.message);
  }
  
} catch (error) {
  console.error('❌ Ошибка при подключении к Neon DB:', error.message);
  console.error(error.stack);
} finally {
  // Закрываем соединение с базой данных
  await pool.end();
  console.log('🔄 Соединение с базой данных закрыто');
}