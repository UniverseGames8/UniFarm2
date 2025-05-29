import { users, transactions, uniFarmingDeposits, referrals, tonBoostDeposits,
  type User, type InsertUser, type Transaction, type InsertTransaction,
  type UniFarmingDeposit, type InsertUniFarmingDeposit,
  type Referral, type InsertReferral,
  type TonBoostDeposit, type InsertTonBoostDeposit
} from "@shared/schema";
import { db } from "./production-db";
import { eq, and, desc, sql, gt, lt } from "drizzle-orm";
import type { IStorage } from './storage-memory';
import { DatabaseError, NotFoundError } from './middleware/errorHandler';

// Тип для безопасного доступа к свойству message у ошибок
type ErrorWithMessage = { message: string };

/**
 * Реализация хранилища с использованием базы данных PostgreSQL через Drizzle ORM
 * Обеспечивает единый интерфейс для всех операций с данными
 */
export class DatabaseStorage implements IStorage {
  // =================== USER METHODS ===================
  
  /**
   * Получение пользователя по его ID
   * @throws {DatabaseError} При ошибке в базе данных
   */
  async getUser(id: number): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user || undefined;
    } catch (error) {
      const err = error as ErrorWithMessage;
      throw new DatabaseError(`Ошибка при получении пользователя по ID ${id}: ${err.message}`, error);
    }
  }

  /**
   * Получение пользователя по имени пользователя
   */
  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.username, username));
      return user || undefined;
    } catch (error) {
      const err = error as ErrorWithMessage;
      console.error(`[DatabaseStorage] Ошибка при получении пользователя по username ${username}:`, err.message);
      throw new DatabaseError(`Ошибка при получении пользователя по username ${username}: ${err.message}`, error);
    }
  }

  /**
   * Получение пользователя по его guest_id
   */
  async getUserByGuestId(guestId: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.guest_id, guestId));
      return user || undefined;
    } catch (error) {
      const err = error as ErrorWithMessage;
      console.error(`[DatabaseStorage] Ошибка при получении пользователя по guest_id ${guestId}:`, err.message);
      throw new DatabaseError(`Ошибка при получении пользователя по guest_id ${guestId}: ${err.message}`, error);
    }
  }

  /**
   * Получение пользователя по реферальному коду
   */
  async getUserByRefCode(refCode: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.ref_code, refCode));
    return user || undefined;
  }
  
  /**
   * Получение пользователя по его Telegram ID
   */
  async getUserByTelegramId(telegramId: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.telegram_id, telegramId));
    return user || undefined;
  }

  /**
   * Обновление реферального кода пользователя
   */
  async updateUserRefCode(userId: number, refCode: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ref_code: refCode })
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }
  
  /**
   * Обновление данных пользователя
   * @param userId ID пользователя
   * @param updateData Данные для обновления
   * @throws {NotFoundError} Если пользователь не найден
   * @throws {DatabaseError} При ошибке в базе данных
   */
  async updateUser(userId: number, updateData: Partial<User>): Promise<User | undefined> {
    try {
      // Проверка существования пользователя
      const existingUser = await this.getUser(userId);
      if (!existingUser) {
        throw new NotFoundError(`Пользователь с ID ${userId} не найден`);
      }
      
      // Выполняем обновление
      const [user] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, userId))
        .returning();
      
      if (!user) {
        throw new NotFoundError(`Не удалось обновить данные для пользователя с ID ${userId}`);
      }
      
      return user;
    } catch (error) {
      // Если это не наши специальные ошибки, оборачиваем в DatabaseError
      if (!(error instanceof NotFoundError)) {
        const err = error as ErrorWithMessage;
        throw new DatabaseError(`Ошибка при обновлении данных пользователя: ${err.message}`, error);
      }
      throw error;
    }
  }

  /**
   * Обновление баланса пользователя
   * @throws {NotFoundError} Если пользователь не найден
   * @throws {DatabaseError} При ошибке в базе данных
   */
  async updateUserBalance(userId: number, currencyType: 'uni' | 'ton', amount: string): Promise<User | undefined> {
    try {
      // Проверка существования пользователя
      const existingUser = await this.getUser(userId);
      if (!existingUser) {
        throw new NotFoundError(`Пользователь с ID ${userId} не найден`);
      }
      
      // Используем соответствующее поле в зависимости от типа валюты
      const fieldToUpdate = currencyType === 'uni' ? 'balance_uni' : 'balance_ton';
      
      // Используем SQL выражение для атомарного обновления
      const [user] = await db
        .update(users)
        .set({
          [fieldToUpdate]: sql`COALESCE(${users[fieldToUpdate]}, '0') + ${amount}::numeric`
        })
        .where(eq(users.id, userId))
        .returning();
      
      if (!user) {
        throw new NotFoundError(`Не удалось обновить баланс для пользователя с ID ${userId}`);
      }
      
      return user;
    } catch (error) {
      // Если это не наши специальные ошибки, оборачиваем в DatabaseError
      if (!(error instanceof NotFoundError)) {
        const err = error as ErrorWithMessage;
        throw new DatabaseError(`Ошибка при обновлении баланса: ${err.message}`, error);
      }
      throw error;
    }
  }

  /**
   * Генерация случайного реферального кода
   */
  generateRefCode(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    
    for (let i = 0; i < 8; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    return result;
  }

  /**
   * Генерация уникального реферального кода
   */
  async generateUniqueRefCode(): Promise<string> {
    let refCode = this.generateRefCode();
    let isUnique = await this.isRefCodeUnique(refCode);
    
    // Пробуем до 10 раз сгенерировать уникальный код
    let attempts = 0;
    while (!isUnique && attempts < 10) {
      refCode = this.generateRefCode();
      isUnique = await this.isRefCodeUnique(refCode);
      attempts++;
    }
    
    return refCode;
  }

  /**
   * Проверка уникальности реферального кода
   */
  async isRefCodeUnique(refCode: string): Promise<boolean> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.ref_code, refCode));
    // Если пользователей с таким ref_code нет, то код уникален
    return result.length === 0;
  }

  /**
   * Создание нового пользователя
   */
  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }
  
  // =================== TRANSACTION METHODS ===================
  
  /**
   * Получение транзакции по её ID
   */
  async getTransaction(id: number): Promise<Transaction | undefined> {
    const [transaction] = await db.select().from(transactions).where(eq(transactions.id, id));
    return transaction || undefined;
  }
  
  /**
   * Получение всех транзакций пользователя
   */
  async getUserTransactions(userId: number, limit: number = 50): Promise<Transaction[]> {
    const userTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.user_id, userId))
      .orderBy(desc(transactions.created_at))
      .limit(limit);
    return userTransactions;
  }
  
  /**
   * Создание новой транзакции
   */
  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const [transaction] = await db
      .insert(transactions)
      .values(insertTransaction)
      .returning();
    return transaction;
  }
  
  /**
   * Обновление статуса транзакции
   */
  async updateTransactionStatus(transactionId: number, status: string): Promise<Transaction | undefined> {
    const [transaction] = await db
      .update(transactions)
      .set({ status })
      .where(eq(transactions.id, transactionId))
      .returning();
    return transaction || undefined;
  }
  
  // =================== FARMING METHODS ===================
  
  /**
   * Получение всех UNI-депозитов пользователя
   */
  async getUserUniFarmingDeposits(userId: number): Promise<UniFarmingDeposit[]> {
    const deposits = await db
      .select()
      .from(uniFarmingDeposits)
      .where(eq(uniFarmingDeposits.user_id, userId))
      .orderBy(desc(uniFarmingDeposits.created_at));
    return deposits;
  }
  
  /**
   * Создание нового UNI-депозита для фарминга
   */
  async createUniFarmingDeposit(insertDeposit: InsertUniFarmingDeposit): Promise<UniFarmingDeposit> {
    const [deposit] = await db
      .insert(uniFarmingDeposits)
      .values(insertDeposit)
      .returning();
    return deposit;
  }
  
  /**
   * Обновление данных UNI-депозита
   */
  async updateUniFarmingDeposit(id: number, updates: Partial<UniFarmingDeposit>): Promise<UniFarmingDeposit | undefined> {
    const [deposit] = await db
      .update(uniFarmingDeposits)
      .set(updates)
      .where(eq(uniFarmingDeposits.id, id))
      .returning();
    return deposit || undefined;
  }
  
  /**
   * Получение активных UNI-депозитов
   */
  async getActiveUniFarmingDeposits(): Promise<UniFarmingDeposit[]> {
    return await db
      .select()
      .from(uniFarmingDeposits)
      .where(eq(uniFarmingDeposits.is_active, true));
  }
  
  // =================== TON BOOST METHODS ===================
  
  /**
   * Получение TON Boost-депозитов пользователя
   */
  async getUserTonBoostDeposits(userId: number): Promise<TonBoostDeposit[]> {
    const deposits = await db
      .select()
      .from(tonBoostDeposits)
      .where(eq(tonBoostDeposits.user_id, userId))
      .orderBy(desc(tonBoostDeposits.created_at));
    return deposits;
  }
  
  /**
   * Создание нового TON Boost-депозита
   */
  async createTonBoostDeposit(insertDeposit: InsertTonBoostDeposit): Promise<TonBoostDeposit> {
    const [deposit] = await db
      .insert(tonBoostDeposits)
      .values(insertDeposit)
      .returning();
    return deposit;
  }
  
  /**
   * Обновление TON Boost-депозита
   */
  async updateTonBoostDeposit(id: number, updates: Partial<TonBoostDeposit>): Promise<TonBoostDeposit | undefined> {
    const [deposit] = await db
      .update(tonBoostDeposits)
      .set(updates)
      .where(eq(tonBoostDeposits.id, id))
      .returning();
    return deposit || undefined;
  }
  
  /**
   * Получение активных TON Boost-депозитов
   */
  async getActiveTonBoostDeposits(): Promise<TonBoostDeposit[]> {
    return await db
      .select()
      .from(tonBoostDeposits)
      .where(eq(tonBoostDeposits.is_active, true));
  }
  
  // =================== REFERRAL METHODS ===================
  
  /**
   * Создание новой реферальной связи
   */
  async createReferral(insertReferral: InsertReferral): Promise<Referral> {
    const [referral] = await db
      .insert(referrals)
      .values(insertReferral)
      .returning();
    return referral;
  }
  
  /**
   * Получение реферальной связи по ID пользователя
   */
  async getReferralByUserId(userId: number): Promise<Referral | undefined> {
    const [referral] = await db
      .select()
      .from(referrals)
      .where(eq(referrals.user_id, userId));
    return referral || undefined;
  }
  
  /**
   * Получение всех рефералов пользователя
   */
  async getUserReferrals(inviterId: number): Promise<Referral[]> {
    return await db
      .select()
      .from(referrals)
      .where(eq(referrals.inviter_id, inviterId))
      .orderBy(desc(referrals.created_at));
  }
}

// Экспортируем экземпляр хранилища для глобального использования
export const storage = new DatabaseStorage();