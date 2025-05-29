/**
 * Адаптер для согласования интерфейса DatabaseStorage с IExtendedStorage
 * 
 * Этот файл создает обертку вокруг DatabaseStorage, реализующую
 * интерфейс IExtendedStorage для совместимости с сервисами.
 */

import { 
  User, InsertUser, Transaction, InsertTransaction, Referral, InsertReferral,
  FarmingDeposit, InsertFarmingDeposit, UniFarmingDeposit, InsertUniFarmingDeposit,
  TonBoostDeposit, InsertTonBoostDeposit, UserMission, InsertUserMission
} from "@shared/schema";
import { DatabaseStorage, storage as databaseStorage } from "./storage";
import { IExtendedStorage } from "./storage-interface";
import { db } from "./production-db";

/**
 * Адаптер для расширения DatabaseStorage до IExtendedStorage
 */
export class ExtendedStorageAdapter implements IExtendedStorage {
  private storage: DatabaseStorage;

  constructor(storage: DatabaseStorage) {
    this.storage = storage;
  }

  // =================== Методы из базового интерфейса IStorage ===================
  
  getUser(id: number): Promise<User | undefined> {
    return this.storage.getUser(id);
  }

  getUserByUsername(username: string): Promise<User | undefined> {
    return this.storage.getUserByUsername(username);
  }

  getUserByGuestId(guestId: string): Promise<User | undefined> {
    return this.storage.getUserByGuestId(guestId);
  }

  getUserByRefCode(refCode: string): Promise<User | undefined> {
    return this.storage.getUserByRefCode(refCode);
  }

  async getUserByTelegramId(telegramId: number): Promise<User | undefined> {
    if (!telegramId) return undefined;
    
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.telegram_id, telegramId));
      
      return user || undefined;
    } catch (error) {
      console.error('[StorageAdapter] Error in getUserByTelegramId:', error);
      return undefined;
    }
  }

  createUser(insertUser: InsertUser): Promise<User> {
    return this.storage.createUser(insertUser);
  }

  updateUserRefCode(userId: number, refCode: string): Promise<User | undefined> {
    return this.storage.updateUserRefCode(userId, refCode);
  }

  generateRefCode(): string {
    return this.storage.generateRefCode();
  }

  generateUniqueRefCode(): Promise<string> {
    return this.storage.generateUniqueRefCode();
  }

  isRefCodeUnique(refCode: string): Promise<boolean> {
    return this.storage.isRefCodeUnique(refCode);
  }

  // =================== Методы для транзакций ===================

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    return this.storage.createTransaction(transaction);
  }

  async getUserTransactions(userId: number, limit: number = 50, offset: number = 0): Promise<{ transactions: Transaction[], total: number }> {
    const transactions = await this.storage.getUserTransactions(userId, limit);
    
    // Получаем общее количество транзакций пользователя
    // TODO: В будущем можно оптимизировать запрос для подсчета без извлечения данных
    const totalTransactions = await db.select({ count: sql`count(*)` }).from(transactionsTable).where(eq(transactionsTable.user_id, userId));
    const total = Number(totalTransactions[0].count) || 0;
    
    return { transactions, total };
  }

  // =================== Методы для рефералов ===================

  async createReferral(referral: InsertReferral): Promise<Referral> {
    return this.storage.createReferral(referral);
  }

  async getUserReferrals(userId: number): Promise<{ referrals: User[], total: number }> {
    const referralEntries = await this.storage.getUserReferrals(userId);
    
    if (!referralEntries.length) {
      return { referrals: [], total: 0 };
    }
    
    // Получаем информацию о пользователях-рефералах
    const referralUserIds = referralEntries.map(entry => entry.user_id).filter(id => id !== null) as number[];
    
    if (!referralUserIds.length) {
      return { referrals: [], total: 0 };
    }
    
    const referralUsers = await db.select().from(users).where(inArray(users.id, referralUserIds));
    
    return { 
      referrals: referralUsers, 
      total: referralEntries.length 
    };
  }

  async getReferralByUserIdAndInviterId(userId: number, inviterId: number): Promise<Referral | undefined> {
    const [referral] = await db
      .select()
      .from(referrals)
      .where(and(
        eq(referrals.user_id, userId),
        eq(referrals.inviter_id, inviterId)
      ));
    
    return referral || undefined;
  }

  // =================== Методы для фарминг-депозитов ===================

  async createFarmingDeposit(deposit: InsertFarmingDeposit): Promise<FarmingDeposit> {
    // Предполагаем, что это всегда UniFarmingDeposit, но может быть расширено в будущем
    return this.createUniFarmingDeposit(deposit as unknown as InsertUniFarmingDeposit) as unknown as FarmingDeposit;
  }

  async getUserFarmingDeposits(userId: number): Promise<FarmingDeposit[]> {
    // Предполагаем, что это всегда UniFarmingDeposit, но может быть расширено в будущем
    return this.getUserUniFarmingDeposits(userId) as unknown as FarmingDeposit[];
  }

  // =================== Методы для UNI фарминга ===================

  createUniFarmingDeposit(deposit: InsertUniFarmingDeposit): Promise<UniFarmingDeposit> {
    return this.storage.createUniFarmingDeposit(deposit);
  }

  updateUniFarmingDeposit(id: number, data: Partial<UniFarmingDeposit>): Promise<UniFarmingDeposit | undefined> {
    return this.storage.updateUniFarmingDeposit(id, data);
  }

  getUserUniFarmingDeposits(userId: number): Promise<UniFarmingDeposit[]> {
    return this.storage.getUserUniFarmingDeposits(userId);
  }

  getActiveUniFarmingDeposits(): Promise<UniFarmingDeposit[]> {
    return this.storage.getActiveUniFarmingDeposits();
  }

  // =================== Методы для TON бустов ===================

  createTonBoostDeposit(deposit: InsertTonBoostDeposit): Promise<TonBoostDeposit> {
    return this.storage.createTonBoostDeposit(deposit);
  }

  updateTonBoostDeposit(id: number, data: Partial<TonBoostDeposit>): Promise<TonBoostDeposit | undefined> {
    return this.storage.updateTonBoostDeposit(id, data);
  }

  getUserTonBoostDeposits(userId: number): Promise<TonBoostDeposit[]> {
    return this.storage.getUserTonBoostDeposits(userId);
  }

  getActiveTonBoostDeposits(): Promise<TonBoostDeposit[]> {
    return this.storage.getActiveTonBoostDeposits();
  }

  // =================== Методы для миссий ===================

  async createUserMission(userMission: InsertUserMission): Promise<UserMission> {
    const [mission] = await db
      .insert(userMissions)
      .values(userMission)
      .returning();
    
    return mission;
  }

  async getUserMissions(userId: number): Promise<UserMission[]> {
    return await db
      .select()
      .from(userMissions)
      .where(eq(userMissions.user_id, userId))
      .orderBy(desc(userMissions.completed_at));
  }

  async hasUserCompletedMission(userId: number, missionId: number): Promise<boolean> {
    const completedMissions = await db
      .select()
      .from(userMissions)
      .where(and(
        eq(userMissions.user_id, userId),
        eq(userMissions.mission_id, missionId),
        isNotNull(userMissions.completed_at)
      ));
    
    return completedMissions.length > 0;
  }

  // =================== Обновление баланса пользователя ===================

  async updateUserBalance(userId: number, currency: 'UNI' | 'TON', amount: string): Promise<User> {
    const user = await this.storage.updateUserBalance(userId, currency.toLowerCase() as 'uni' | 'ton', amount);
    
    if (!user) {
      throw new Error(`User with ID ${userId} not found when updating balance`);
    }
    
    return user;
  }

  // =================== Транзакционные операции ===================

  async executeTransaction<T>(operations: (tx: any) => Promise<T>): Promise<T> {
    // Если используется Drizzle, можно использовать его транзакционный API
    return db.transaction(async (tx) => {
      return operations(tx);
    });
  }
}

// Импортируем необходимые элементы из схемы
import { users, userMissions, referrals, transactions as transactionsTable } from "@shared/schema";
import { eq, isNotNull, and, inArray, desc, sql } from "drizzle-orm";

// Экспортируем экземпляр расширенного хранилища
export const extendedStorage = new ExtendedStorageAdapter(databaseStorage);