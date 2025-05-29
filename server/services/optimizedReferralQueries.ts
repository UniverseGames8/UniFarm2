/**
 * Оптимізовані запити до БД для реферальної системи
 * 
 * Цей модуль містить високопродуктивні запити до БД для роботи 
 * з реферальною системою, які використовують:
 * - Рекурсивні CTE (Common Table Expressions)
 * - Матеріалізовані представлення
 * - Оптимізовані індекси
 * - Пакетну обробку даних
 */

import { PoolClient } from 'pg';
import { db, pool, queryWithRetry } from '../db';
import { withTransaction } from '../utils/transaction-manager';

/**
 * Отримання повного реферального дерева користувача з використанням рекурсивних CTE
 * @param userId ID користувача
 * @returns Реферальне дерево
 */
export async function getReferralTreeOptimized(userId: number): Promise<any> {
  const query = `
    WITH RECURSIVE referral_tree AS (
      -- Базовий випадок: користувач, для якого будуємо дерево
      SELECT 
        id, 
        username, 
        ref_code, 
        parent_ref_code,
        telegram_id,
        created_at,
        0 as level
      FROM users 
      WHERE id = $1
      
      UNION ALL
      
      -- Рекурсивний випадок: всі реферали користувача
      SELECT 
        u.id, 
        u.username, 
        u.ref_code, 
        u.parent_ref_code,
        u.telegram_id,
        u.created_at,
        rt.level + 1 as level
      FROM users u
      JOIN referral_tree rt ON u.parent_ref_code = rt.ref_code
      WHERE rt.level < 10  -- Обмеження глибини для запобігання зациклювання
    )
    SELECT 
      id, 
      username, 
      ref_code, 
      parent_ref_code,
      telegram_id,
      created_at,
      level,
      (
        SELECT json_agg(
          json_build_object(
            'id', children.id,
            'username', children.username,
            'ref_code', children.ref_code,
            'parent_ref_code', children.parent_ref_code,
            'telegram_id', children.telegram_id,
            'created_at', children.created_at,
            'level', children.level
          )
        )
        FROM referral_tree children
        WHERE children.parent_ref_code = rt.ref_code
          AND children.id != rt.id  -- Виключаємо самого користувача
      ) as children
    FROM referral_tree rt
    ORDER BY level, id;
  `;
  
  try {
    const result = await queryWithRetry(query, [userId]);
    
    // Форматуємо результат у деревоподібну структуру
    const userMap = new Map();
    
    // Додаємо всі вузли в Map для швидкого доступу
    for (const row of result.rows) {
      userMap.set(row.id, {
        ...row,
        children: row.children || []
      });
    }
    
    // Будуємо дерево, починаючи з кореневого вузла (userId)
    const root = userMap.get(userId);
    
    return root;
  } catch (error) {
    console.error('[OptimizedReferralQueries] Помилка при отриманні реферального дерева:', error);
    throw error;
  }
}

/**
 * Отримання ланцюжка інвайтерів користувача з використанням рекурсивних CTE
 * @param userId ID користувача
 * @returns Ланцюжок інвайтерів
 */
export async function getInviterChainOptimized(userId: number): Promise<any[]> {
  const query = `
    WITH RECURSIVE inviter_chain AS (
      -- Базовий випадок: користувач, для якого шукаємо інвайтерів
      SELECT 
        id, 
        username, 
        ref_code, 
        parent_ref_code,
        telegram_id,
        created_at,
        0 as level
      FROM users 
      WHERE id = $1
      
      UNION ALL
      
      -- Рекурсивний випадок: пошук інвайтера для кожного користувача
      SELECT 
        u.id, 
        u.username, 
        u.ref_code, 
        u.parent_ref_code,
        u.telegram_id,
        u.created_at,
        ic.level + 1 as level
      FROM users u
      JOIN inviter_chain ic ON u.ref_code = ic.parent_ref_code
      WHERE ic.level < 10  -- Обмеження глибини для запобігання зациклювання
    )
    SELECT 
      id, 
      username, 
      ref_code, 
      parent_ref_code,
      telegram_id,
      created_at,
      level
    FROM inviter_chain
    WHERE level > 0  -- Виключаємо самого користувача
    ORDER BY level;
  `;
  
  try {
    const result = await queryWithRetry(query, [userId]);
    return result.rows;
  } catch (error) {
    console.error('[OptimizedReferralQueries] Помилка при отриманні ланцюжка інвайтерів:', error);
    throw error;
  }
}

/**
 * Отримання структури реферальної мережі користувача
 * @param userId ID користувача
 * @returns Статистика по рівням реферальної мережі
 */
export async function getReferralStructureOptimized(userId: number): Promise<any[]> {
  const query = `
    WITH RECURSIVE referral_tree AS (
      -- Базовий випадок: користувач, для якого будуємо дерево
      SELECT 
        id, 
        ref_code, 
        0 as level
      FROM users 
      WHERE id = $1
      
      UNION ALL
      
      -- Рекурсивний випадок: всі реферали користувача
      SELECT 
        u.id, 
        u.ref_code, 
        rt.level + 1 as level
      FROM users u
      JOIN referral_tree rt ON u.parent_ref_code = rt.ref_code
      WHERE rt.level < 10  -- Обмеження глибини для запобігання зациклювання
    ),
    level_stats AS (
      -- Підрахунок кількості рефералів на кожному рівні
      SELECT 
        level,
        COUNT(*) as count,
        SUM(
          CASE 
            WHEN level > 0 THEN 
              (SELECT COALESCE(SUM(amount), 0) FROM referral_bonuses WHERE ref_user_id = referral_tree.id)
            ELSE 0
          END
        ) as total_rewards_uni
      FROM referral_tree
      WHERE level > 0  -- Виключаємо самого користувача
      GROUP BY level
    )
    SELECT 
      level,
      count,
      total_rewards_uni
    FROM level_stats
    ORDER BY level;
  `;
  
  try {
    const result = await queryWithRetry(query, [userId]);
    return result.rows;
  } catch (error) {
    console.error('[OptimizedReferralQueries] Помилка при отриманні структури реферальної мережі:', error);
    throw error;
  }
}

/**
 * Обробка реферальних бонусів з використанням оптимізованого підходу
 * @param sourceUserId ID користувача-джерела бонусу
 * @param amount Сума для розподілу
 * @param currency Валюта (зазвичай 'uni')
 * @param client Клієнт БД для транзакції
 * @returns Ідентифікатор пакетної обробки
 */
export async function processReferralRewardsOptimized(
  sourceUserId: number, 
  amount: number, 
  currency: string = 'uni',
  client?: PoolClient
): Promise<string> {
  // Якщо не передано клієнт, створюємо нову транзакцію
  if (!client) {
    return withTransaction(async (transactionClient) => {
      return processReferralRewardsInTransaction(sourceUserId, amount, currency, transactionClient);
    });
  }
  
  // Використовуємо переданий клієнт
  return processReferralRewardsInTransaction(sourceUserId, amount, currency, client);
}

/**
 * Внутрішня функція для обробки реферальних бонусів в межах транзакції
 */
async function processReferralRewardsInTransaction(
  sourceUserId: number, 
  amount: number, 
  currency: string,
  client: PoolClient
): Promise<string> {
  // Створюємо унікальний ідентифікатор пакету
  const batchId = `batch-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  
  try {
    // Записуємо початок обробки в лог
    await client.query(`
      INSERT INTO reward_distribution_logs
      (batch_id, source_user_id, amount, currency, status, created_at)
      VALUES ($1, $2, $3, $4, 'processing', NOW())
    `, [batchId, sourceUserId, amount, currency]);
    
    // Отримуємо ланцюжок інвайтерів з коефіцієнтами для кожного рівня
    const result = await client.query(`
      WITH RECURSIVE inviter_chain AS (
        -- Базовий випадок: користувач, для якого шукаємо інвайтерів
        SELECT 
          id, 
          ref_code, 
          parent_ref_code,
          0 as level
        FROM users 
        WHERE id = $1
        
        UNION ALL
        
        -- Рекурсивний випадок: пошук інвайтера для кожного користувача
        SELECT 
          u.id, 
          u.ref_code, 
          u.parent_ref_code,
          ic.level + 1 as level
        FROM users u
        JOIN inviter_chain ic ON u.ref_code = ic.parent_ref_code
        WHERE ic.level < 10  -- Обмеження глибини
      )
      SELECT 
        inviter_chain.id,
        inviter_chain.level,
        CASE 
          WHEN inviter_chain.level = 1 THEN 0.5  -- 50% для першого рівня
          WHEN inviter_chain.level = 2 THEN 0.3  -- 30% для другого рівня
          WHEN inviter_chain.level = 3 THEN 0.1  -- 10% для третього рівня
          WHEN inviter_chain.level = 4 THEN 0.05 -- 5% для четвертого рівня
          WHEN inviter_chain.level = 5 THEN 0.03 -- 3% для п'ятого рівня
          WHEN inviter_chain.level >= 6 THEN 0.02 -- 2% для всіх інших рівнів
          ELSE 0
        END as reward_coefficient
      FROM inviter_chain
      WHERE level > 0  -- Виключаємо самого користувача
      ORDER BY level;
    `, [sourceUserId]);
    
    const inviters = result.rows;
    
    if (inviters.length === 0) {
      // Немає інвайтерів, завершуємо обробку
      await client.query(`
        UPDATE reward_distribution_logs
        SET 
          status = 'completed', 
          levels_processed = 0, 
          inviter_count = 0, 
          total_distributed = 0, 
          completed_at = NOW()
        WHERE batch_id = $1
      `, [batchId]);
      
      return batchId;
    }
    
    let totalRewardsDistributed = 0;
    
    // Розподіляємо бонуси одним запитом для всіх інвайтерів
    await client.query(`
      INSERT INTO referral_bonuses
      (user_id, ref_user_id, amount, source, currency, created_at)
      SELECT 
        $1 as user_id,
        inviter_id as ref_user_id,
        (reward_coefficient * $2) as amount,
        'referral_bonus' as source,
        $3 as currency,
        NOW() as created_at
      FROM (
        VALUES 
          ${inviters.map((inviter, idx) => 
            `(${inviter.id}, ${inviter.reward_coefficient}::float)`
          ).join(', ')}
      ) AS data(inviter_id, reward_coefficient)
      WHERE reward_coefficient > 0
    `, [sourceUserId, amount, currency]);
    
    // Оновлюємо баланси одним запитом
    await client.query(`
      UPDATE users
      SET ${currency}_balance = ${currency}_balance + (
        CASE 
          ${inviters.map(inviter => 
            `WHEN id = ${inviter.id} THEN ${inviter.reward_coefficient * amount}`
          ).join(' ')}
          ELSE 0
        END
      )
      WHERE id IN (${inviters.map(inviter => inviter.id).join(', ')})
    `);
    
    // Рахуємо загальну суму розподілених бонусів
    totalRewardsDistributed = inviters.reduce(
      (sum, inviter) => sum + (inviter.reward_coefficient * amount), 
      0
    );
    
    // Оновлюємо статус в логах
    await client.query(`
      UPDATE reward_distribution_logs
      SET 
        status = 'completed', 
        levels_processed = $1, 
        inviter_count = $2, 
        total_distributed = $3, 
        completed_at = NOW()
      WHERE batch_id = $4
    `, [
      inviters.filter(inv => inv.level !== null).length,
      inviters.length,
      totalRewardsDistributed.toString(),
      batchId
    ]);
    
    return batchId;
  } catch (error) {
    // Записуємо помилку в лог
    await client.query(`
      UPDATE reward_distribution_logs
      SET status = 'failed', error_message = $1, completed_at = NOW()
      WHERE batch_id = $2
    `, [error instanceof Error ? error.message : String(error), batchId]);
    
    throw error;
  }
}

/**
 * Створення індексів для оптимізації запитів реферальної системи
 */
export async function createReferralOptimizationIndexes(): Promise<void> {
  const queries = [
    // Індекс для швидкого пошуку користувачів за ref_code
    `CREATE INDEX IF NOT EXISTS idx_users_ref_code ON users (ref_code)`,
    
    // Індекс для швидкого пошуку користувачів за parent_ref_code
    `CREATE INDEX IF NOT EXISTS idx_users_parent_ref_code ON users (parent_ref_code)`,
    
    // Складений індекс для швидкого пошуку бонусів за user_id та ref_user_id
    `CREATE INDEX IF NOT EXISTS idx_referral_bonuses_user_ref ON referral_bonuses (user_id, ref_user_id)`,
    
    // Індекс для швидкого пошуку бонусів за датою
    `CREATE INDEX IF NOT EXISTS idx_referral_bonuses_created_at ON referral_bonuses (created_at)`
  ];
  
  try {
    for (const query of queries) {
      await queryWithRetry(query);
    }
    console.log('[OptimizedReferralQueries] Індекси для оптимізації реферальної системи успішно створені');
  } catch (error) {
    console.error('[OptimizedReferralQueries] Помилка при створенні індексів:', error);
    throw error;
  }
}

/**
 * Створення таблиць для журналювання обробки реферальних бонусів
 */
export async function ensureReferralLogTables(): Promise<void> {
  const queries = [
    // Таблиця для журналювання розподілу бонусів
    `CREATE TABLE IF NOT EXISTS reward_distribution_logs (
      id SERIAL PRIMARY KEY,
      batch_id VARCHAR(50) NOT NULL UNIQUE,
      source_user_id INTEGER NOT NULL,
      amount DECIMAL(18,6) NOT NULL,
      currency VARCHAR(10) NOT NULL,
      status VARCHAR(20) NOT NULL,
      levels_processed INTEGER,
      inviter_count INTEGER,
      total_distributed DECIMAL(18,6),
      error_message TEXT,
      created_at TIMESTAMP NOT NULL,
      completed_at TIMESTAMP
    )`,
    
    // Індекси для таблиці журналювання
    `CREATE INDEX IF NOT EXISTS idx_reward_logs_batch_id ON reward_distribution_logs (batch_id)`,
    `CREATE INDEX IF NOT EXISTS idx_reward_logs_source_user ON reward_distribution_logs (source_user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_reward_logs_status ON reward_distribution_logs (status)`
  ];
  
  try {
    for (const query of queries) {
      await queryWithRetry(query);
    }
    console.log('[OptimizedReferralQueries] Таблиці для журналювання обробки реферальних бонусів успішно створені');
  } catch (error) {
    console.error('[OptimizedReferralQueries] Помилка при створенні таблиць журналювання:', error);
    throw error;
  }
}