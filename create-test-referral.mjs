/**
 * Скрипт для создания тестовой реферальной связи и реферальной транзакции
 */

import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './shared/schema.js';
import { eq } from 'drizzle-orm';

// Создаем подключение к базе данных
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool, schema });

// Функция для создания тестовых данных
async function createTestReferralBonus() {
  try {
    // Создаем тестовую реферальную связь если её нет
    console.log('Создание тестовой реферальной связи...');
    
    const referralExists = await db.select()
      .from(schema.referrals)
      .where(eq(schema.referrals.user_id, 1))
      .where(eq(schema.referrals.inviter_id, 2));
    
    if (referralExists.length === 0) {
      await db.insert(schema.referrals)
        .values({
          user_id: 1,
          inviter_id: 2,
          level: 1,
          created_at: new Date()
        });
      console.log('Создана новая реферальная связь: пользователь 1 → приглашен пользователем 2');
    } else {
      console.log('Реферальная связь уже существует');
    }
    
    // Теперь создаем тестовую транзакцию с типом REFERRAL_BONUS
    console.log('Создание тестовой транзакции с типом REFERRAL_BONUS...');
    
    await db.insert(schema.transactions)
      .values({
        user_id: 2,
        type: 'referral_bonus',
        amount: '100.0',
        currency: 'UNI',
        status: 'confirmed',
        source: 'Referral Income',
        description: 'Referral reward from level 1 farming',
        source_user_id: 1,
        category: 'bonus',
        data: JSON.stringify({ level: 1, percent: 100 })
      });
    
    console.log('Создана тестовая транзакция с типом referral_bonus');
  } catch (error) {
    console.error('Ошибка при создании тестовых данных:', error);
  }
}

// Запускаем функцию и завершаем скрипт после выполнения
createTestReferralBonus()
  .then(() => {
    console.log('Скрипт завершил работу успешно');
    process.exit(0);
  })
  .catch(error => {
    console.error('Скрипт завершился с ошибкой:', error);
    process.exit(1);
  });