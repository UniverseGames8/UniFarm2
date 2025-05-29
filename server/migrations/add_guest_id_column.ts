import { db } from '../db';
import { sql } from 'drizzle-orm';

/**
 * Миграция для добавления поля guest_id в таблицу users
 * Эта миграция является частью первого этапа по переходу на новую архитектуру
 * с поддержкой AirDrop режима (работы без Telegram)
 */
export async function addGuestIdColumn() {
  console.log('[Migration] Начинаем миграцию: добавление поля guest_id в таблицу users');
  
  try {
    // Проверяем, существует ли уже колонка guest_id
    const checkResult = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'guest_id'
    `);
    
    // Если колонка уже существует, пропускаем миграцию
    if (checkResult.rows && checkResult.rows.length > 0) {
      console.log('[Migration] Колонка guest_id уже существует в таблице users, пропускаем миграцию');
      return;
    }
    
    // Добавляем колонку guest_id в таблицу users
    await db.execute(sql`
      ALTER TABLE users 
      ADD COLUMN guest_id TEXT UNIQUE
    `);
    
    console.log('[Migration] Колонка guest_id успешно добавлена в таблицу users');
    
    // Генерируем UUID для всех существующих пользователей
    await db.execute(sql`
      UPDATE users
      SET guest_id = gen_random_uuid()::text
      WHERE guest_id IS NULL
    `);
    
    console.log('[Migration] Всем существующим пользователям присвоены guest_id');
    
    // Успешно завершили миграцию
    console.log('[Migration] Миграция успешно завершена');
    
  } catch (error) {
    console.error('[Migration] Ошибка при выполнении миграции:', error);
    throw error;
  }
}