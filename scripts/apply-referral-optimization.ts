/**
 * Скрипт для применения оптимизаций реферальной системы
 * 
 * Этот скрипт:
 * 1. Создает новые индексы для оптимизации запросов
 * 2. Создает таблицу reward_distribution_logs для журналирования операций
 * 3. Запускает восстановление прерванных операций из журнала (при наличии)
 * 
 * Запуск: npm run start:ts scripts/apply-referral-optimization.ts
 */

import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import { referralBonusProcessor } from '../server/services/referralBonusProcessor';
import { reward_distribution_logs } from '../shared/schema';

/**
 * Применяет схему таблицы reward_distribution_logs
 */
async function applySchema(): Promise<void> {
  try {
    console.log('Applying database schema for reward_distribution_logs...');
    
    // Проверяем, существует ли уже таблица
    const tableExists = await checkTableExists('reward_distribution_logs');
    
    if (tableExists) {
      console.log('Table reward_distribution_logs already exists. Skipping creation.');
    } else {
      // Создаем таблицу reward_distribution_logs
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS reward_distribution_logs (
          id SERIAL PRIMARY KEY,
          source_user_id INTEGER NOT NULL,
          batch_id TEXT NOT NULL UNIQUE,
          currency TEXT NOT NULL,
          earned_amount NUMERIC(18, 6) NOT NULL,
          total_distributed NUMERIC(18, 6) DEFAULT '0',
          levels_processed INTEGER DEFAULT 0,
          inviter_count INTEGER DEFAULT 0,
          status TEXT DEFAULT 'pending',
          error_message TEXT,
          processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
          completed_at TIMESTAMP
        )
      `);
      
      console.log('Table reward_distribution_logs created successfully.');
      
      // Создаем индексы для оптимизации
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_reward_logs_source_user ON reward_distribution_logs (source_user_id);
        CREATE INDEX IF NOT EXISTS idx_reward_logs_status ON reward_distribution_logs (status);
        CREATE INDEX IF NOT EXISTS idx_reward_logs_processed_at ON reward_distribution_logs (processed_at);
      `);
      
      console.log('Indexes for reward_distribution_logs created successfully.');
    }
  } catch (error) {
    console.error('Error applying schema:', error);
    throw error;
  }
}

/**
 * Проверяет, существует ли таблица
 */
async function checkTableExists(tableName: string): Promise<boolean> {
  try {
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = ${tableName}
      );
    `);
    
    return result.rows[0].exists;
  } catch (error) {
    console.error(`Error checking if table ${tableName} exists:`, error);
    return false;
  }
}

/**
 * Выполняет прямые SQL-запросы для создания индексов на таблице referrals
 */
async function createReferralIndexes(): Promise<void> {
  try {
    console.log('Creating referral optimization indexes...');
    
    // Индекс для ускорения поиска пригласителей
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_referrals_user_id ON referrals(user_id);
    `);
    
    // Индекс для ускорения поиска цепочек рефералов
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_referrals_inviter_id ON referrals(inviter_id);
    `);
    
    // Индекс для фильтрации активных рефералов
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_referrals_level ON referrals(level);
    `);
    
    console.log('Referral optimization indexes created successfully.');
  } catch (error) {
    console.error('Error creating referral indexes:', error);
    throw error;
  }
}

/**
 * Анализирует таблицы после создания индексов
 */
async function analyzeAllTables(): Promise<void> {
  try {
    console.log('Analyzing tables...');
    
    await db.execute(sql`ANALYZE referrals;`);
    
    if (await checkTableExists('reward_distribution_logs')) {
      await db.execute(sql`ANALYZE reward_distribution_logs;`);
    }
    
    console.log('Table analysis completed.');
  } catch (error) {
    console.error('Error analyzing tables:', error);
    // Продолжаем выполнение даже при ошибке анализа
  }
}

/**
 * Запускает восстановление прерванных операций
 */
async function recoverFailedOperations(): Promise<void> {
  try {
    console.log('Recovering failed operations from logs...');
    
    if (!await checkTableExists('reward_distribution_logs')) {
      console.log('Table reward_distribution_logs does not exist yet. Skipping recovery.');
      return;
    }
    
    // Используем процессор для восстановления операций
    const recoveredCount = await referralBonusProcessor.recoverFailedProcessing();
    
    if (recoveredCount > 0) {
      console.log(`Successfully recovered ${recoveredCount} failed operations.`);
    } else {
      console.log('No failed operations to recover.');
    }
  } catch (error) {
    console.error('Error recovering failed operations:', error);
    throw error;
  }
}

/**
 * Главная функция скрипта
 */
async function main(): Promise<void> {
  try {
    console.log('Starting referral optimization application...');
    
    // Применяем схему для reward_distribution_logs
    await applySchema();
    
    // Создаем индексы для оптимизации
    await createReferralIndexes();
    
    // Анализируем таблицы для обновления статистики
    await analyzeAllTables();
    
    // Восстанавливаем прерванные операции
    await recoverFailedOperations();
    
    console.log('Referral optimization application completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error in main function:', error);
    process.exit(1);
  }
}

// Запускаем главную функцию
main();