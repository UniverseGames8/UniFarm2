/**
 * ТЕСТОВИЙ ЕНДПОІНТ ДЛЯ ПРЯМОГО ПІДКЛЮЧЕННЯ ДО PRODUCTION БАЗИ
 * Гарантовано підключається до ep-lucky-boat-a463bggt
 */

import { Request, Response } from 'express';
import { Pool } from 'pg';

// ПРЯМЕ ПІДКЛЮЧЕННЯ ДО ВАШОЇ ПРАВИЛЬНОЇ PRODUCTION БАЗИ
const CORRECT_PRODUCTION_DB = 'postgresql://neondb_owner:npg_SpgdNBV70WKl@ep-lucky-boat-a463bggt-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function getProductionPool() {
  return new Pool({
    connectionString: CORRECT_PRODUCTION_DB,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
}

// Статус production бази
export async function getProductionDbStatus(req: Request, res: Response) {
  try {
    console.log('🎯 [TEST] Прямий запит до production бази ep-lucky-boat-a463bggt');
    
    const pool = await getProductionPool();
    const client = await pool.connect();
    
    const result = await client.query(`
      SELECT 
        current_database() as database_name,
        COUNT(*) as total_users,
        'ep-lucky-boat-a463bggt' as endpoint_name
      FROM public.users
    `);
    
    const users = await client.query(`
      SELECT id, telegram_id, username, guest_id, ref_code, created_at 
      FROM public.users 
      ORDER BY id DESC 
      LIMIT 10
    `);
    
    client.release();
    await pool.end();
    
    console.log('✅ [TEST] Успішно підключився до production бази');
    
    res.json({
      success: true,
      endpoint: 'ep-lucky-boat-a463bggt',
      database: result.rows[0],
      users: users.rows,
      message: 'Пряме підключення до правильної production бази працює!'
    });
    
  } catch (error) {
    console.error('❌ [TEST] Помилка підключення до production бази:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      endpoint: 'ep-lucky-boat-a463bggt'
    });
  }
}

// Тестова Telegram реєстрація
export async function testTelegramRegistration(req: Request, res: Response) {
  try {
    const { telegram_id, username } = req.body;
    
    if (!telegram_id || !username) {
      return res.status(400).json({
        success: false,
        error: 'Потрібні telegram_id та username'
      });
    }
    
    console.log(`🎯 [TEST] Тестова реєстрація користувача ${username} (${telegram_id})`);
    
    const pool = await getProductionPool();
    const client = await pool.connect();
    
    // Генеруємо унікальний ref_code
    const refCode = `TEST_${telegram_id}_${Date.now()}`.substring(0, 20);
    const guestId = `guest_${telegram_id}`;
    
    // Вставляємо нового користувача
    const insertResult = await client.query(`
      INSERT INTO public.users 
      (telegram_id, username, guest_id, ref_code, balance_uni, balance_ton, created_at) 
      VALUES ($1, $2, $3, $4, 0, 0, NOW()) 
      RETURNING id, telegram_id, username, guest_id, ref_code, created_at
    `, [telegram_id, username, guestId, refCode]);
    
    // Перевіряємо загальну кількість користувачів
    const countResult = await client.query('SELECT COUNT(*) as total FROM public.users');
    
    client.release();
    await pool.end();
    
    console.log('✅ [TEST] Користувач успішно створений в production базі');
    
    res.json({
      success: true,
      endpoint: 'ep-lucky-boat-a463bggt',
      user: insertResult.rows[0],
      totalUsers: countResult.rows[0].total,
      message: 'Користувач успішно створений в правильній production базі!'
    });
    
  } catch (error) {
    console.error('❌ [TEST] Помилка створення користувача:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      endpoint: 'ep-lucky-boat-a463bggt'
    });
  }
}

// Перевірка конкретного користувача
export async function checkUser(req: Request, res: Response) {
  try {
    const { user_id } = req.params;
    
    console.log(`🎯 [TEST] Перевірка користувача ID ${user_id} в production базі`);
    
    const pool = await getProductionPool();
    const client = await pool.connect();
    
    const result = await client.query(`
      SELECT id, telegram_id, username, guest_id, ref_code, balance_uni, balance_ton, created_at 
      FROM public.users 
      WHERE id = $1
    `, [user_id]);
    
    client.release();
    await pool.end();
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Користувач з ID ${user_id} не знайдений`,
        endpoint: 'ep-lucky-boat-a463bggt'
      });
    }
    
    console.log('✅ [TEST] Користувач знайдений в production базі');
    
    res.json({
      success: true,
      endpoint: 'ep-lucky-boat-a463bggt',
      user: result.rows[0],
      message: 'Користувач знайдений в правильній production базі!'
    });
    
  } catch (error) {
    console.error('❌ [TEST] Помилка перевірки користувача:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      endpoint: 'ep-lucky-boat-a463bggt'
    });
  }
}