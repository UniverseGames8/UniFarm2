/**
 * Оптимизированный обработчик реферальных бонусов
 * 
 * Обеспечивает высокопроизводительный функционал для расчета и начисления
 * реферальных бонусов с использованием батчинга и атомарных транзакций.
 */

import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from 'pg';
import { sql } from "drizzle-orm";
import * as schema from "@shared/schema";
import { v4 as uuidv4 } from "uuid";
import { Currency } from "./standardReferralBonusProcessor";

// Стандартные процентные ставки по уровням (в порядке от ближайшего к дальнему)
const DEFAULT_PERCENTAGES = [
  0.05, // уровень 1: 5%
  0.03, // уровень 2: 3%
  0.02, // уровень 3: 2%
  0.01, // уровень 4: 1%
  0.01, // уровень 5: 1%
  0.005, // уровень 6: 0.5%
  0.005, // уровень 7: 0.5%
  0.005, // уровень 8: 0.5%
  0.005, // уровень 9: 0.5%
  0.005  // уровень 10: 0.5%
  // Остальные уровни: 0%
];

// Максимальная глубина выплат (количество уровней вверх)
const MAX_REFERRAL_DEPTH = 20;

// Размер пакета (кол-во наград, обрабатываемых за раз)
const BATCH_SIZE = 50;

/**
 * Тип сообщения для очереди вознаграждений
 */
interface ReferralRewardMessage {
  id: string;
  sourceUserId: number;
  amount: number;
  currency: Currency;
  timestamp: Date;
  processed: boolean;
  error?: string;
}

/**
 * Оптимизированная реализация обработчика реферальных бонусов
 * 
 * Обрабатывает выплаты вознаграждений с использованием атомарных транзакций
 * и пакетной обработки для повышения производительности
 */
export class OptimizedReferralBonusProcessor {
  private pgPool: Pool;
  private db: NodePgDatabase<typeof schema>;
  
  // Очередь сообщений для обработки
  private rewardQueue: ReferralRewardMessage[] = [];
  
  /**
   * @param pgPool Пул подключений PostgreSQL для транзакций
   * @param db Экземпляр базы данных Drizzle ORM
   */
  constructor(pgPool: Pool, db: NodePgDatabase<typeof schema>) {
    this.pgPool = pgPool;
    this.db = db;
  }
  
  /**
   * Инициализирует сервис
   * Создаёт необходимые таблицы и индексы в БД, если их нет
   */
  public async initialize(): Promise<void> {
    try {
      // Создаем таблицу логов обработки реферальных вознаграждений
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS reward_distribution_logs (
          id SERIAL PRIMARY KEY,
          batch_id VARCHAR(36) NOT NULL,
          source_user_id INTEGER NOT NULL,
          earned_amount NUMERIC(18,6) NOT NULL,
          currency VARCHAR(10) NOT NULL,
          processed_at TIMESTAMP,
          status VARCHAR(20),
          levels_processed INTEGER,
          inviter_count INTEGER,
          total_distributed NUMERIC(18,6),
          error_message TEXT,
          completed_at TIMESTAMP
        );
        
        -- Индекс для статистики по пользователям
        CREATE INDEX IF NOT EXISTS reward_logs_source_user_idx 
        ON reward_distribution_logs (source_user_id);
        
        -- Индекс для анализа производительности
        CREATE INDEX IF NOT EXISTS reward_logs_performance_idx 
        ON reward_distribution_logs (batch_id, processed_at);
      `);
      
      console.log("[OptimizedReferralBonusProcessor] Таблицы и индексы для обработки вознаграждений успешно созданы");
    } catch (error) {
      console.error("[OptimizedReferralBonusProcessor] Ошибка при создании таблиц и индексов:", error);
      throw error;
    }
  }
  
  /**
   * Ставит вознаграждение в очередь на обработку
   * 
   * @param sourceUserId ID пользователя-источника вознаграждения
   * @param amount Сумма исходного действия, на основе которой расчитываются вознаграждения
   * @param currency Валюта вознаграждения (UNI или TON)
   * @returns ID сообщения в очереди
   */
  public async queueReferralReward(sourceUserId: number, amount: number, currency: Currency): Promise<string> {
    try {
      // Создаем уникальный идентификатор сообщения
      const messageId = uuidv4();
      
      // Добавляем сообщение в очередь
      const message: ReferralRewardMessage = {
        id: messageId,
        sourceUserId,
        amount,
        currency,
        timestamp: new Date(),
        processed: false
      };
      
      this.rewardQueue.push(message);
      
      console.log(`[OptimizedReferralBonusProcessor] Добавлено вознаграждение в очередь: ${JSON.stringify({
        id: messageId,
        sourceUserId,
        amount,
        currency
      })}`);
      
      // Если накопилось достаточно сообщений, запускаем обработку
      if (this.rewardQueue.filter(msg => !msg.processed).length >= BATCH_SIZE) {
        this.processReferralRewards();
      }
      
      return messageId;
    } catch (error) {
      console.error('[OptimizedReferralBonusProcessor] Ошибка при добавлении в очередь:', error);
      throw error;
    }
  }
  
  /**
   * Обрабатывает все вознаграждения в очереди пакетами
   */
  public async processReferralRewards(): Promise<void> {
    try {
      // Фильтруем необработанные сообщения
      const pendingMessages = this.rewardQueue.filter(msg => !msg.processed);
      
      if (pendingMessages.length === 0) {
        return;
      }
      
      console.log(`[OptimizedReferralBonusProcessor] Обработка ${pendingMessages.length} вознаграждений`);
      
      // Обрабатываем сообщения пакетами
      for (let i = 0; i < pendingMessages.length; i += BATCH_SIZE) {
        const batch = pendingMessages.slice(i, i + BATCH_SIZE);
        await this.processBatch(batch);
      }
      
      // Очищаем обработанные сообщения из очереди
      this.rewardQueue = this.rewardQueue.filter(msg => !msg.processed);
      
    } catch (error) {
      console.error('[OptimizedReferralBonusProcessor] Ошибка при обработке очереди вознаграждений:', error);
      throw error;
    }
  }
  
  /**
   * Обрабатывает пакет сообщений с вознаграждениями
   * @param messages Массив сообщений для обработки
   */
  private async processBatch(messages: ReferralRewardMessage[]): Promise<void> {
    for (const message of messages) {
      try {
        // Получаем исходного пользователя и его цепочку пригласителей в одном запросе
        const sourceUserWithChain = await this.getUserWithInviterChain(message.sourceUserId);
        
        if (!sourceUserWithChain) {
          message.error = `Пользователь с ID ${message.sourceUserId} не найден`;
          message.processed = true;
          continue;
        }
        
        if (!sourceUserWithChain.inviterChain || sourceUserWithChain.inviterChain.length === 0) {
          // Нет цепочки приглашений, нечего обрабатывать
          message.processed = true;
          continue;
        }
        
        // Для оптимизированной версии используем одну транзакцию для всей цепочки вознаграждений
        const client = await this.pgPool.connect();
        
        try {
          await client.query('BEGIN');
          
          // Обрабатываем цепочку пригласителей
          const inviterChain = sourceUserWithChain.inviterChain;
          const rewards = this.calculateRewards(inviterChain, message);
          
          if (rewards.length > 0) {
            // Вставляем все транзакции одним запросом
            await this.insertTransactions(client, rewards, message);
            
            // Обновляем балансы пользователей одним запросом
            await this.updateBalances(client, rewards, message.currency);
          }
          
          // Логируем обработку
          await client.query(`
            INSERT INTO reward_distribution_logs (
              batch_id, source_user_id, earned_amount, currency, processed_at, status
            ) VALUES (
              $1, $2, $3, $4, $5, $6
            )
          `, [
            message.id, 
            message.sourceUserId, 
            message.amount, 
            message.currency, 
            new Date(),
            'processing'
          ]);
          
          await client.query('COMMIT');
          
          message.processed = true;
          
        } catch (txError) {
          await client.query('ROLLBACK');
          
          message.error = txError instanceof Error ? txError.message : String(txError);
          console.error(`[OptimizedReferralBonusProcessor] Ошибка транзакции для ${message.id}:`, txError);
          
          // Логируем ошибку
          await this.db.execute(sql`
            INSERT INTO reward_distribution_logs (
              batch_id, source_user_id, earned_amount, currency, processed_at, status, error_message
            ) VALUES (
              ${message.id}, ${message.sourceUserId}, ${message.amount}, ${message.currency}, 
              ${new Date().toISOString()}, 'error', 
              ${message.error}
            )
          `);
          
          // Отмечаем как обработанное с ошибкой
          message.processed = true;
          
        } finally {
          client.release();
        }
        
      } catch (error) {
        console.error(`[OptimizedReferralBonusProcessor] Ошибка при обработке вознаграждения ${message.id}:`, error);
        
        message.error = error instanceof Error ? error.message : String(error);
        
        // Логируем ошибку
        await this.db.execute(sql`
          INSERT INTO reward_distribution_logs (
            batch_id, source_user_id, earned_amount, currency, processed_at, status, error_message
          ) VALUES (
            ${message.id}, ${message.sourceUserId}, ${message.amount}, ${message.currency}, 
            ${new Date().toISOString()}, 'error', 
            ${message.error}
          )
        `);
        
        // Отмечаем как обработанное с ошибкой
        message.processed = true;
      }
    }
  }
  
  /**
   * Получает пользователя с цепочкой его пригласителей за один запрос
   * @param userId ID пользователя
   * @returns Объект с пользователем и его цепочкой пригласителей
   */
  private async getUserWithInviterChain(userId: number): Promise<any> {
    try {
      const result = await this.db.execute(sql`
        WITH RECURSIVE inviter_chain AS (
          -- Базовый случай: начальный пользователь
          SELECT 
            u.id, 
            u.username, 
            u.ref_code,
            u.parent_ref_code,
            1 as level
          FROM users u
          WHERE u.id = ${userId}
          
          UNION ALL
          
          -- Рекурсивный случай: находим пригласителя
          SELECT 
            p.id, 
            p.username, 
            p.ref_code,
            p.parent_ref_code,
            ic.level + 1 as level
          FROM users p
          JOIN inviter_chain ic ON p.ref_code = ic.parent_ref_code
          WHERE ic.parent_ref_code IS NOT NULL
          AND ic.level < ${MAX_REFERRAL_DEPTH}  -- Ограничиваем глубину
        )
        
        -- Получаем цепочку пригласителей (без исходного пользователя)
        SELECT 
          (SELECT row_to_json(u) FROM (SELECT id, username, ref_code FROM users WHERE id = ${userId}) u) as source_user,
          json_agg(inv) as inviter_chain
        FROM (
          SELECT id, username, ref_code, level
          FROM inviter_chain
          WHERE level > 1  -- Исключаем самого пользователя
          ORDER BY level ASC
        ) inv
      `);
      
      const queryResult = result as any;
      if (!queryResult || !queryResult.rows || queryResult.rows.length === 0) {
        return null;
      }
      
      return queryResult.rows[0];
    } catch (error) {
      console.error(`[OptimizedReferralBonusProcessor] Ошибка при получении цепочки пригласителей:`, error);
      throw error;
    }
  }
  
  /**
   * Рассчитывает вознаграждения для каждого участника в цепочке
   * @param inviterChain Цепочка пригласителей
   * @param message Сообщение с вознаграждением
   * @returns Массив объектов с вознаграждениями
   */
  private calculateRewards(inviterChain: any[], message: ReferralRewardMessage): any[] {
    const rewards = [];
    
    // Обходим цепочку пригласителей и рассчитываем вознаграждения
    for (let i = 0; i < inviterChain.length && i < MAX_REFERRAL_DEPTH; i++) {
      const inviter = inviterChain[i];
      const percentage = DEFAULT_PERCENTAGES[i] || 0;
      
      if (percentage <= 0) {
        continue;
      }
      
      // Рассчитываем сумму вознаграждения
      const rewardAmount = message.amount * percentage;
      
      // Пропускаем слишком маленькие суммы
      if (rewardAmount < 0.0001) {
        continue;
      }
      
      rewards.push({
        userId: inviter.id,
        amount: rewardAmount,
        level: i + 1,
        percentage
      });
    }
    
    return rewards;
  }
  
  /**
   * Вставляет все транзакции для вознаграждений одним запросом
   * @param client Клиент PostgreSQL с открытой транзакцией
   * @param rewards Массив объектов с вознаграждениями
   * @param message Исходное сообщение
   */
  private async insertTransactions(client: any, rewards: any[], message: ReferralRewardMessage): Promise<void> {
    // Формируем запрос для массовой вставки транзакций
    const valuesSql = rewards.map((reward, index) => {
      return `(
        $${index * 8 + 1}, $${index * 8 + 2}, $${index * 8 + 3}, $${index * 8 + 4}, 
        $${index * 8 + 5}, $${index * 8 + 6}, $${index * 8 + 7}, $${index * 8 + 8}
      )`;
    }).join(', ');
    
    const params = [];
    for (const reward of rewards) {
      const metadata = {
        source_user_id: message.sourceUserId,
        level: reward.level,
        percentage: reward.percentage,
        message_id: message.id
      };
      
      params.push(
        reward.userId,
        reward.amount,
        message.currency,
        'referral_reward',
        'completed',
        `Реферальное вознаграждение (уровень ${reward.level})`,
        new Date(),
        JSON.stringify(metadata)
      );
    }
    
    // Выполняем запрос на вставку
    await client.query(`
      INSERT INTO transactions (
        user_id, amount, currency, type, status, description, created_at, metadata
      ) VALUES ${valuesSql}
    `, params);
  }
  
  /**
   * Обновляет балансы всех пользователей одним запросом
   * @param client Клиент PostgreSQL с открытой транзакцией
   * @param rewards Массив объектов с вознаграждениями
   * @param currency Валюта вознаграждения
   */
  private async updateBalances(client: any, rewards: any[], currency: Currency): Promise<void> {
    // Группируем вознаграждения по пользователям (на случай, если один пользователь получает несколько наград)
    const userRewards = new Map<number, number>();
    
    for (const reward of rewards) {
      const current = userRewards.get(reward.userId) || 0;
      userRewards.set(reward.userId, current + reward.amount);
    }
    
    // Формируем запрос для обновления балансов
    const caseStatement = Array.from(userRewards.entries()).map(([userId, amount], index) => {
      return `WHEN id = $${index * 2 + 1} THEN ${currency.toLowerCase()}_balance + $${index * 2 + 2}`;
    }).join(' ');
    
    const whereClause = Array.from(userRewards.keys()).map((userId, index) => {
      return `id = $${index * 2 + 1}`;
    }).join(' OR ');
    
    const params: (number | string)[] = [];
    Array.from(userRewards.entries()).forEach(([userId, amount]) => {
      params.push(userId, amount);
    });
    
    // Выполняем запрос на обновление балансов
    await client.query(`
      UPDATE users
      SET ${currency.toLowerCase()}_balance = CASE ${caseStatement} ELSE ${currency.toLowerCase()}_balance END
      WHERE ${whereClause}
    `, params);
  }
}