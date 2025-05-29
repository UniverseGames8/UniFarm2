/**
 * Прямое создание Telegram пользователей через SQL
 * Создает 5 тестовых пользователей с настоящими telegram_id
 */

import { testConnection } from './server/db-connect-unified.js';

// Тестовые пользователи для создания
const testUsers = [
  {
    telegram_id: 123456789,
    username: 'alice_crypto', 
    first_name: 'Alice',
    last_name: 'Smith'
  },
  {
    telegram_id: 987654321,
    username: 'bob_farming',
    first_name: 'Bob', 
    last_name: 'Johnson'
  },
  {
    telegram_id: 555777999,
    username: 'charlie_uni',
    first_name: 'Charlie',
    last_name: null
  },
  {
    telegram_id: 111222333, 
    username: 'diana_tokens',
    first_name: 'Diana',
    last_name: 'Williams'
  },
  {
    telegram_id: 444666888,
    username: 'eve_blockchain', 
    first_name: 'Eve',
    last_name: 'Brown'
  }
];

/**
 * Генерирует уникальный реферальный код
 */
function generateRefCode() {
  return `ref_${Math.random().toString(36).substring(2, 10)}`;
}

/**
 * Создает пользователя прямо в базе данных
 */
async function createTelegramUser(userData) {
  try {
    console.log(`\n[DIRECT] 🚀 Создаем пользователя: ${userData.username} (ID: ${userData.telegram_id})`);
    
    // Подключаемся к базе данных
    const db = await testConnection();
    if (!db) {
      throw new Error('Не удалось подключиться к базе данных');
    }
    
    // Генерируем уникальный реферальный код
    const refCode = generateRefCode();
    
    // SQL запрос для создания пользователя
    const insertQuery = `
      INSERT INTO users (
        telegram_id, 
        username, 
        guest_id, 
        wallet, 
        ton_wallet_address,
        ref_code, 
        parent_ref_code,
        balance_uni, 
        balance_ton,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, telegram_id, username, ref_code, balance_uni, balance_ton
    `;
    
    const values = [
      userData.telegram_id,
      userData.username,
      null, // guest_id = null для Telegram пользователей
      null, // wallet = null изначально
      null, // ton_wallet_address = null изначально
      refCode,
      null, // parent_ref_code = null (без реферера)
      '0', // balance_uni = 0 изначально
      '0', // balance_ton = 0 изначально
      new Date() // created_at
    ];
    
    const result = await db.query(insertQuery, values);
    
    if (result.rows && result.rows.length > 0) {
      const user = result.rows[0];
      console.log(`[DIRECT] ✅ УСПЕШНО создан: ID=${user.id}, telegram_id=${user.telegram_id}, ref_code=${user.ref_code}`);
      return {
        success: true,
        user: user,
        telegram_id: userData.telegram_id,
        username: userData.username
      };
    } else {
      throw new Error('Не удалось создать пользователя - нет возвращаемых данных');
    }
    
  } catch (error) {
    console.error(`[DIRECT] ❌ ОШИБКА создания ${userData.username}:`, error.message);
    return {
      success: false,
      error: error.message,
      telegram_id: userData.telegram_id,
      username: userData.username
    };
  }
}

/**
 * Проверяет созданных пользователей в БД
 */
async function checkCreatedUsers() {
  try {
    console.log('\n[DIRECT] 🔍 Проверяем созданных пользователей в базе данных...');
    
    const db = await testConnection();
    if (!db) {
      throw new Error('Не удалось подключиться к базе данных');
    }
    
    // Получаем последних пользователей с telegram_id
    const query = `
      SELECT id, telegram_id, username, ref_code, balance_uni, balance_ton, created_at
      FROM users 
      WHERE telegram_id IS NOT NULL 
      ORDER BY created_at DESC 
      LIMIT 10
    `;
    
    const result = await db.query(query);
    
    if (result.rows && result.rows.length > 0) {
      console.log(`[DIRECT] 📊 Найдено пользователей с telegram_id: ${result.rows.length}`);
      
      result.rows.forEach((user, index) => {
        console.log(`[DIRECT] ${index + 1}. ID=${user.id}, telegram_id=${user.telegram_id}, username=${user.username}, ref_code=${user.ref_code}`);
      });
      
      return result.rows;
    } else {
      console.log('[DIRECT] ⚠️ Пользователи с telegram_id не найдены');
      return [];
    }
    
  } catch (error) {
    console.error('[DIRECT] ❌ Ошибка при проверке пользователей:', error.message);
    return [];
  }
}

/**
 * Основная функция
 */
async function runDirectRegistration() {
  console.log('🎯 НАЧИНАЕМ ПРЯМОЕ СОЗДАНИЕ TELEGRAM ПОЛЬЗОВАТЕЛЕЙ');
  
  const results = [];
  
  // Создаем каждого тестового пользователя
  for (const userData of testUsers) {
    const result = await createTelegramUser(userData);
    results.push(result);
    
    // Пауза между операциями
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Анализируем результаты
  console.log('\n📊 ИТОГОВЫЙ ОТЧЕТ:');
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Успешно создано: ${successful.length}`);
  console.log(`❌ Ошибок создания: ${failed.length}`);
  
  if (successful.length > 0) {
    console.log('\n✅ УСПЕШНЫЕ СОЗДАНИЯ:');
    successful.forEach((result, index) => {
      console.log(`${index + 1}. Telegram ID: ${result.telegram_id}, Username: ${result.username}, DB ID: ${result.user?.id}, Ref Code: ${result.user?.ref_code}`);
    });
  }
  
  if (failed.length > 0) {
    console.log('\n❌ НЕУДАЧНЫЕ СОЗДАНИЯ:');
    failed.forEach((result, index) => {
      console.log(`${index + 1}. Telegram ID: ${result.telegram_id}, Username: ${result.username}, Ошибка: ${result.error}`);
    });
  }
  
  // Проверяем пользователей в БД
  const dbUsers = await checkCreatedUsers();
  
  console.log('\n🎯 ПРЯМОЕ СОЗДАНИЕ ЗАВЕРШЕНО');
  
  return { results, dbUsers };
}

// Запускаем создание
runDirectRegistration().catch(console.error);

export { runDirectRegistration };