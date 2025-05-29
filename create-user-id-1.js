/**
 * Створюю користувача з ID 1 для вашої правильної бази даних
 */

import { Pool } from 'pg';

const correctDbConfig = {
  connectionString: 'postgresql://neondb_owner:npg_SpgdNBV70WKl@ep-lucky-boat-a463bggt-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require'
};

async function createUserWithId1() {
  console.log('🔍 Перевіряю користувачів у правильній базі...');
  
  const pool = new Pool(correctDbConfig);
  
  try {
    // Спочатку дивимось, які користувачі є
    const existingUsers = await pool.query('SELECT id, username, telegram_id FROM users ORDER BY id LIMIT 15');
    console.log('👥 Існуючі користувачі:');
    existingUsers.rows.forEach(user => {
      console.log(`  ID ${user.id}: ${user.username} (Telegram: ${user.telegram_id})`);
    });
    
    // Перевіряємо чи є користувач з ID 1
    const user1Check = await pool.query('SELECT * FROM users WHERE id = 1');
    
    if (user1Check.rows.length === 0) {
      console.log('❌ Користувач з ID 1 не знайдений. Створюю...');
      
      // Створюємо користувача з ID 1
      await pool.query(
        'INSERT INTO users (id, username, telegram_id, ref_code, created_at) VALUES ($1, $2, $3, $4, NOW())',
        [1, 'main_test_user', 100000001, 'MAIN001']
      );
      
      console.log('✅ Користувач з ID 1 створений успішно!');
    } else {
      console.log('✅ Користувач з ID 1 вже існує:', user1Check.rows[0]);
    }
    
    // Показуємо оновлений список
    const finalCount = await pool.query('SELECT COUNT(*) as count FROM users');
    console.log(`👥 Загальна кількість користувачів: ${finalCount.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Помилка:', error.message);
  } finally {
    await pool.end();
  }
}

createUserWithId1();