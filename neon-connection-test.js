/**
 * Скрипт для тестирования подключения к Neon с различными параметрами
 */

import pg from 'pg';
import https from 'https';
import { promisify } from 'util';

const { Client } = pg;

// Параметры из DATABASE_URL
const dbUrl = process.env.DATABASE_URL;
const urlObj = new URL(dbUrl.replace(/^postgresql:\/\//, 'https://'));

const host = urlObj.hostname;
const port = urlObj.port || '5432';
const database = urlObj.pathname.substring(1);
const user = urlObj.username;
const password = urlObj.searchParams.has('password') ? 
                urlObj.searchParams.get('password') : 
                urlObj.password;

// Функция для проверки доступности хоста
async function checkHostConnectivity() {
  console.log(`🌐 Проверка доступности хоста ${host}...`);
  
  return new Promise((resolve) => {
    const req = https.get(`https://${host}`, (res) => {
      console.log(`✅ Хост доступен, статус: ${res.statusCode}`);
      resolve(true);
    });
    
    req.on('error', (error) => {
      console.log(`❌ Ошибка при проверке хоста: ${error.message}`);
      resolve(false);
    });
    
    // Установка таймаута в 5 секунд
    req.setTimeout(5000, () => {
      console.log('⚠️ Таймаут при проверке хоста');
      req.abort();
      resolve(false);
    });
  });
}

// Функция для проверки подключения к базе данных
async function testConnection() {
  console.log('🔄 Проверка подключения к Neon Database...');
  
  // Сначала проверим доступность хоста
  const hostAvailable = await checkHostConnectivity();
  
  if (!hostAvailable) {
    console.log('⚠️ Хост недоступен, но все равно попробуем подключиться к базе данных');
  }
  
  // Создаем клиента с настройками из строки подключения
  const client = new Client({
    host,
    port,
    database,
    user,
    password,
    ssl: {
      rejectUnauthorized: false
    },
    connectionTimeoutMillis: 10000
  });
  
  try {
    console.log('🔄 Подключение к базе данных...');
    await client.connect();
    console.log('✅ Успешное подключение к базе данных!');
    
    // Получаем информацию о сервере
    const serverInfoResult = await client.query('SELECT version()');
    console.log(`📊 Версия PostgreSQL: ${serverInfoResult.rows[0].version}`);
    
    // Проверяем наличие таблицы users
    const tableCheckResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      ) as exists
    `);
    
    if (tableCheckResult.rows[0].exists) {
      console.log('✅ Таблица users существует');
      
      // Получаем количество записей в таблице users
      const countResult = await client.query('SELECT COUNT(*) FROM users');
      console.log(`📊 Количество записей в таблице users: ${countResult.rows[0].count}`);
      
      // Получаем примеры записей
      const usersResult = await client.query('SELECT id, username, ref_code FROM users ORDER BY id DESC LIMIT 5');
      
      console.log('📋 Примеры пользователей:');
      usersResult.rows.forEach((user, i) => {
        console.log(`  ${i+1}. ID: ${user.id}, Username: ${user.username}, RefCode: ${user.ref_code}`);
      });
    } else {
      console.log('❌ Таблица users не существует');
    }
    
  } catch (error) {
    console.error('❌ Ошибка при подключении:', error.message);
    console.error('Детали ошибки:', error);
  } finally {
    try {
      await client.end();
      console.log('🔄 Соединение закрыто');
    } catch (e) {
      console.log('⚠️ Ошибка при закрытии соединения');
    }
  }
}

// Запускаем тестирование подключения
testConnection().catch(error => {
  console.error('❌ Неперехваченная ошибка:', error);
});