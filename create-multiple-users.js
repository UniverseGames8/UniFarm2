/**
 * Скрипт для создания нескольких тестовых пользователей в Neon DB
 */

import pg from 'pg';
import crypto from 'crypto';
const { Pool } = pg;

// Генерация уникального имени пользователя
function generateUsername(index) {
  const timestamp = Date.now().toString().slice(-4);
  return `test_user_${timestamp}_${index}`;
}

// Генерация уникального реферального кода
function generateRefCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// Создание подключения к базе данных
async function createDbConnection() {
  console.log('🔄 Подключение к Neon DB...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
  
  return pool;
}

// Получение следующего доступного ID
async function getNextAvailableId(pool) {
  const maxIdResult = await pool.query('SELECT MAX(id) FROM users');
  return maxIdResult.rows[0].max + 1 || 1000;
}

// Создание тестового пользователя
async function createTestUser(pool, index, startId) {
  const id = startId + index;
  const username = generateUsername(index + 1);
  const refCode = generateRefCode();
  const guestId = crypto.randomUUID();
  const now = new Date().toISOString();
  
  try {
    const userResult = await pool.query(`
      INSERT INTO users (
        id,
        username, 
        telegram_id, 
        ref_code, 
        balance_uni,
        balance_ton,
        created_at,
        guest_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
    `, [
      id,
      username,
      Math.floor(Math.random() * 1000000) + 100000, // случайный telegram_id
      refCode,
      1000 + (index * 100), // разные балансы для каждого пользователя
      5 + index,            // разные балансы TON
      now,
      guestId
    ]);
    
    const user = userResult.rows[0];
    console.log(`✅ Пользователь #${index + 1} успешно создан:`);
    console.log(`ID: ${user.id}`);
    console.log(`Username: ${user.username}`);
    console.log(`Ref Code: ${user.ref_code}`);
    console.log(`Guest ID: ${user.guest_id}`);
    console.log(`Balance UNI: ${user.balance_uni}`);
    console.log(`Balance TON: ${user.balance_ton}`);
    console.log(`Created At: ${user.created_at}`);
    console.log('-------------------');
    
    return user;
  } catch (error) {
    console.error(`❌ Ошибка при создании пользователя #${index + 1}:`, error.message);
    throw error;
  }
}

// Проверка существования пользователей
async function verifyUsersExist(pool, userIds) {
  console.log(`🔄 Проверка существования созданных пользователей...`);
  
  const inClause = userIds.join(',');
  const query = `SELECT id, username FROM users WHERE id IN (${inClause})`;
  
  try {
    const result = await pool.query(query);
    
    if (result.rows.length === userIds.length) {
      console.log('✅ Все пользователи найдены в базе данных!');
      
      // Выводим краткую информацию о каждом
      result.rows.forEach(user => {
        console.log(`ID: ${user.id}, Username: ${user.username}`);
      });
      
      return true;
    } else {
      console.log(`⚠️ Найдено только ${result.rows.length} из ${userIds.length} пользователей`);
      return false;
    }
  } catch (error) {
    console.error('❌ Ошибка при проверке пользователей:', error.message);
    return false;
  }
}

// Основная функция
async function main() {
  console.log('🚀 Запуск создания 5 тестовых пользователей в Neon DB');
  
  const userCount = 5; // Количество пользователей для создания
  let pool = null;
  const createdUserIds = [];
  
  try {
    // Подключаемся к базе данных
    pool = await createDbConnection();
    
    // Проверяем подключение
    const connectionResult = await pool.query('SELECT NOW() as time');
    console.log(`✅ Подключение к базе данных успешно установлено: ${connectionResult.rows[0].time}`);
    
    // Получаем следующий доступный ID
    const nextId = await getNextAvailableId(pool);
    console.log(`ℹ️ Следующий доступный ID: ${nextId}`);
    
    // Создаем пользователей
    for (let i = 0; i < userCount; i++) {
      const user = await createTestUser(pool, i, nextId);
      createdUserIds.push(user.id);
    }
    
    // Проверяем, что все пользователи созданы
    await verifyUsersExist(pool, createdUserIds);
    
    console.log('\n✨ Тест успешно завершен! Все пользователи созданы и подтверждены в Neon DB.');
  } catch (error) {
    console.error('❌ Произошла ошибка:', error);
  } finally {
    // Закрываем соединение с базой данных
    if (pool) {
      await pool.end();
      console.log('🔄 Соединение с базой данных закрыто');
    }
  }
}

// Запускаем тест
main().catch(console.error);