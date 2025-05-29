/**
 * Инстанс-ориентированная имплементация сервиса для работы с транзакциями
 * 
 * Этот файл содержит основную реализацию сервиса транзакций,
 * который работает на базе конкретного инстанса
 */

import { db } from '../db';
import { 
  transactions, 
  Transaction, 
  InsertTransaction
} from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { ensureDate, ensureDateObject } from '../utils/typeFixers';

/**
 * Типы транзакций в системе
 */
export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  TRANSFER = 'transfer',
  BONUS = 'bonus',
  REFERRAL = 'referral',
  REFERRAL_BONUS = 'referral_bonus',
  FARMING_REWARD = 'farming_reward',
  SYSTEM = 'system',
  REFUND = 'refund'
}

/**
 * Валюты, поддерживаемые в системе
 */
export enum Currency {
  TON = 'TON',
  UNI = 'UNI'
}

/**
 * Статусы транзакций
 */
export enum TransactionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

/**
 * Категории транзакций
 */
export enum TransactionCategory {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  REWARD = 'reward',
  BONUS = 'bonus',
  REFERRAL = 'referral',
  FARMING = 'farming',
  AIRDROP = 'airdrop',
  TRANSFER = 'transfer'
}

/**
 * Данные для создания транзакции
 */
export interface TransactionData {
  userId: number;
  type: string;
  currency: string;
  amount: string;
  status: string;
  source?: string;
  category?: string;
  tx_hash?: string | null;
  metadata?: any;
}

/**
 * Интерфейс сервиса транзакций
 */
export interface ITransactionService {
  createTransaction(data: InsertTransaction): Promise<Transaction>;
  getTransactionById(id: number): Promise<Transaction | undefined>;
  getUserTransactions(userId: number, limit?: number): Promise<Transaction[]>;
  updateTransactionStatus(id: number, status: TransactionStatus): Promise<Transaction | undefined>;
  logTransaction(data: TransactionData): Promise<Transaction>;
}

/**
 * Реализация сервиса транзакций
 */
class TransactionServiceImpl implements ITransactionService {
  /**
   * Создает новую транзакцию
   */
  async createTransaction(data: InsertTransaction): Promise<Transaction> {
    try {
      // Убедимся, что у нас всегда есть актуальная временная метка
      const transactionData = {
        ...data
      };
      
      // Если created_at не указан, будет использовано значение по умолчанию из схемы
      
      const [transaction] = await db
        .insert(transactions)
        .values(transactionData)
        .returning();
      
      return transaction;
    } catch (error) {
      console.error('[TransactionService] Error in createTransaction:', error);
      throw error;
    }
  }

  /**
   * Получает транзакцию по ID
   */
  async getTransactionById(id: number): Promise<Transaction | undefined> {
    try {
      const [transaction] = await db
        .select()
        .from(transactions)
        .where(eq(transactions.id, id));
      
      return transaction;
    } catch (error) {
      console.error('[TransactionService] Error in getTransactionById:', error);
      return undefined;
    }
  }

  /**
   * Получает транзакции пользователя
   */
  async getUserTransactions(userId: number, limit = 50): Promise<Transaction[]> {
    try {
      const userTransactions = await db
        .select()
        .from(transactions)
        .where(eq(transactions.user_id, userId))
        .orderBy(desc(transactions.created_at))
        .limit(limit);
      
      return userTransactions;
    } catch (error) {
      console.error('[TransactionService] Error in getUserTransactions:', error);
      return [];
    }
  }

  /**
   * Обновляет статус транзакции
   */
  async updateTransactionStatus(id: number, status: TransactionStatus): Promise<Transaction | undefined> {
    try {
      const [updatedTransaction] = await db
        .update(transactions)
        .set({ status })
        .where(eq(transactions.id, id))
        .returning();
      
      return updatedTransaction;
    } catch (error) {
      console.error('[TransactionService] Error in updateTransactionStatus:', error);
      return undefined;
    }
  }

  /**
   * Создает транзакцию из упрощенных данных
   * Используется для совместимости со старым кодом
   */
  async logTransaction(data: TransactionData): Promise<Transaction> {
    try {
      // Забезпечуємо коректні типи даних для всіх полів
      const transactionData: InsertTransaction = {
        user_id: data.userId,
        type: data.type,
        currency: data.currency,
        amount: data.amount,
        status: data.status,
        source: data.source,
        category: data.category,
        tx_hash: data.tx_hash || null
        // Поле created_at буде автоматично заповнено через defaultNow() в схемі
      };

      const [transaction] = await db
        .insert(transactions)
        .values(transactionData)
        .returning();
      
      return transaction;
    } catch (error) {
      console.error('[TransactionService] Error in logTransaction:', error);
      throw error;
    }
  }
}

// Создаем единственный экземпляр сервиса
export const transactionServiceInstance = new TransactionServiceImpl();

/**
 * Фабрика для создания сервиса транзакций
 * @returns Экземпляр сервиса транзакций
 */
export function createTransactionService(): ITransactionService {
  return transactionServiceInstance;
}