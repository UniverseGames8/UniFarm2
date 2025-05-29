/**
 * Стандартный обработчик реферальных бонусов
 * 
 * Обеспечивает базовый функционал для расчета и начисления
 * реферальных бонусов без оптимизаций.
 */

import { db } from "../db";
import { users, transactions, type InsertTransaction } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

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
const MAX_REFERRAL_DEPTH = 10;

// Поддерживаемые валюты
export type Currency = 'UNI' | 'TON';

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
 * Интерфейс для обработчика реферальных бонусов
 */
export interface ReferralBonusProcessor {
  queueReferralReward(sourceUserId: number, amount: number, currency: Currency): Promise<string>;
  processReferralRewards(): Promise<void>;
}

/**
 * Стандартная реализация обработчика реферальных бонусов
 * 
 * Обрабатывает выплаты вознаграждений через цепочку пригласителей
 * с использованием простых запросов к БД
 */
export class StandardReferralBonusProcessor implements ReferralBonusProcessor {
  // Очередь сообщений для обработки
  private rewardQueue: ReferralRewardMessage[] = [];
  
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
      
      // Логируем добавление в очередь
      console.log(`[StandardReferralBonusProcessor] Добавлено вознаграждение в очередь: ${JSON.stringify({
        id: messageId,
        sourceUserId,
        amount,
        currency
      })}`);
      
      // Для стандартной реализации сразу обрабатываем сообщение
      await this.processReferralRewards();
      
      return messageId;
    } catch (error) {
      console.error('[StandardReferralBonusProcessor] Ошибка при добавлении в очередь:', error);
      throw error;
    }
  }
  
  /**
   * Обрабатывает все вознаграждения в очереди
   */
  public async processReferralRewards(): Promise<void> {
    try {
      // Фильтруем необработанные сообщения
      const pendingMessages = this.rewardQueue.filter(msg => !msg.processed);
      
      if (pendingMessages.length === 0) {
        return;
      }
      
      console.log(`[StandardReferralBonusProcessor] Обработка ${pendingMessages.length} вознаграждений`);
      
      // Обрабатываем каждое сообщение
      for (const message of pendingMessages) {
        try {
          await this.processReward(message);
          
          // Отмечаем как обработанное
          message.processed = true;
          
          // Логируем факт обработки в БД для аналитики
          await db.execute(sql`
            INSERT INTO reward_distribution_logs (
              message_id, source_user_id, amount, currency, created_at, processed_at, system_type
            ) VALUES (
              ${message.id}, ${message.sourceUserId}, ${message.amount}, ${message.currency}, 
              ${message.timestamp.toISOString()}, ${new Date().toISOString()}, 'standard'
            )
          `);
          
        } catch (error) {
          console.error(`[StandardReferralBonusProcessor] Ошибка при обработке вознаграждения ${message.id}:`, error);
          
          // Отмечаем ошибку, но оставляем в очереди для повторной обработки
          message.error = error instanceof Error ? error.message : String(error);
          
          // Логируем ошибку в БД
          await db.execute(sql`
            INSERT INTO reward_distribution_logs (
              message_id, source_user_id, amount, currency, created_at, processed_at, system_type, error
            ) VALUES (
              ${message.id}, ${message.sourceUserId}, ${message.amount}, ${message.currency}, 
              ${message.timestamp.toISOString()}, ${new Date().toISOString()}, 'standard', 
              ${message.error}
            )
          `);
        }
      }
      
      // Очищаем обработанные сообщения из очереди
      this.rewardQueue = this.rewardQueue.filter(msg => !msg.processed);
      
    } catch (error) {
      console.error('[StandardReferralBonusProcessor] Ошибка при обработке очереди вознаграждений:', error);
      throw error;
    }
  }
  
  /**
   * Обрабатывает одно вознаграждение - распределяет бонусы по цепочке реферралов
   * @param message Сообщение с вознаграждением
   */
  private async processReward(message: ReferralRewardMessage): Promise<void> {
    // Получаем пользователя-источника
    const [sourceUser] = await db.select().from(users).where(eq(users.id, message.sourceUserId));
    
    if (!sourceUser) {
      throw new Error(`Пользователь с ID ${message.sourceUserId} не найден`);
    }
    
    // Если нет родительского реферального кода, то нет и начислений
    if (!sourceUser.parent_ref_code) {
      return;
    }
    
    // Получаем цепочку приглашающих
    const inviterChain = await this.getInviterChain(sourceUser);
    
    if (inviterChain.length === 0) {
      return;
    }
    
    // Начисляем вознаграждения по цепочке
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
      
      // Создаем транзакцию
      const transaction: InsertTransaction = {
        user_id: inviter.id,
        amount: rewardAmount,
        currency: message.currency,
        type: 'referral_reward',
        status: 'completed',
        description: `Реферальное вознаграждение (уровень ${i+1})`,
        created_at: new Date(),
        metadata: {
          source_user_id: message.sourceUserId,
          level: i + 1,
          percentage: percentage
        }
      };
      
      // Записываем транзакцию
      await db.insert(transactions).values(transaction);
      
      // Обновляем баланс пользователя
      if (message.currency === 'UNI') {
        await db.execute(sql`
          UPDATE users
          SET uni_balance = uni_balance + ${rewardAmount}
          WHERE id = ${inviter.id}
        `);
      } else if (message.currency === 'TON') {
        await db.execute(sql`
          UPDATE users
          SET ton_balance = ton_balance + ${rewardAmount}
          WHERE id = ${inviter.id}
        `);
      }
      
      console.log(`[StandardReferralBonusProcessor] Начислено вознаграждение: ${rewardAmount} ${message.currency} пользователю ${inviter.id} (уровень ${i+1})`);
    }
  }
  
  /**
   * Получает цепочку приглашающих для пользователя
   * @param user Пользователь, для которого получаем цепочку
   * @returns Массив пользователей в цепочке (от ближайшего к дальнему)
   */
  private async getInviterChain(user: any): Promise<any[]> {
    const chain: any[] = [];
    let currentRefCode = user.parent_ref_code;
    
    // Ограничиваем количество итераций для избежания бесконечных циклов
    const maxIterations = MAX_REFERRAL_DEPTH + 5;
    let iterations = 0;
    
    while (currentRefCode && iterations < maxIterations) {
      // Находим пользователя по реферальному коду
      const [inviter] = await db.select().from(users).where(eq(users.ref_code, currentRefCode));
      
      if (!inviter) {
        console.warn(`[StandardReferralBonusProcessor] Не найден пользователь с реферальным кодом ${currentRefCode}`);
        break;
      }
      
      // Добавляем приглашающего в цепочку
      chain.push(inviter);
      
      // Переходим к следующему в цепочке
      currentRefCode = inviter.parent_ref_code;
      iterations++;
    }
    
    return chain;
  }
}