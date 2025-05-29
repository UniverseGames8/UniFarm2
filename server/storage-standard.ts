/**
 * Стандартизированное хранилище для работы с базой данных
 * 
 * Этот файл реализует централизованный доступ к хранилищу данных через абстракцию IStorage,
 * обеспечивая возможность работы с реальной базой данных или резервным in-memory хранилищем.
 */

import { eq, sql } from "drizzle-orm";
import { 
  users, 
  type User, 
  type InsertUser,
  referrals,
  type Referral,
  type InsertReferral,
  transactions,
  type Transaction,
  type InsertTransaction,
  farmingDeposits,
  type FarmingDeposit,
  type InsertFarmingDeposit
} from "@shared/schema";
import { db, pool, queryWithRetry } from "./db-connect-unified";
import { IStorage, MemStorage } from './storage-memory';

/**
 * Реализация хранилища, использующая Drizzle ORM для типизированных SQL-запросов
 */
export class DatabaseStorage implements IStorage {
  /**
   * Получение пользователя по ID
   * @param id ID пользователя
   * @returns Promise<User | undefined> Найденный пользователь или undefined
   */
  async getUser(id: number): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user || undefined;
    } catch (error) {
      console.error('[DatabaseStorage] Ошибка при получении пользователя из БД:', error);
      throw error;
    }
  }
  
  /**
   * Получение пользователя по имени пользователя
   * @param username Имя пользователя
   * @returns Promise<User | undefined> Найденный пользователь или undefined
   */
  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.username, username));
      return user || undefined;
    } catch (error) {
      console.error('[DatabaseStorage] Ошибка при получении пользователя по имени из БД:', error);
      throw error;
    }
  }
  
  /**
   * Получение пользователя по гостевому ID
   * @param guestId Гостевой ID
   * @returns Promise<User | undefined> Найденный пользователь или undefined
   */
  async getUserByGuestId(guestId: string): Promise<User | undefined> {
    try {
      console.log(`[DatabaseStorage] Получение пользователя по guest_id: ${guestId}`);
      const [user] = await db.select().from(users).where(eq(users.guest_id, guestId));
      return user || undefined;
    } catch (error) {
      console.error(`[DatabaseStorage] Ошибка при получении пользователя по guest_id ${guestId}:`, error);
      throw error;
    }
  }
  
  /**
   * Получение пользователя по реферальному коду
   * @param refCode Реферальный код
   * @returns Promise<User | undefined> Найденный пользователь или undefined
   */
  async getUserByRefCode(refCode: string): Promise<User | undefined> {
    try {
      console.log(`[DatabaseStorage] Получение пользователя по ref_code: ${refCode}`);
      const [user] = await db.select().from(users).where(eq(users.ref_code, refCode));
      return user || undefined;
    } catch (error) {
      console.error(`[DatabaseStorage] Ошибка при получении пользователя по ref_code ${refCode}:`, error);
      throw error;
    }
  }
  
  /**
   * Обновление реферального кода пользователя
   * @param userId ID пользователя
   * @param refCode Новый реферальный код
   * @returns Promise<User | undefined> Обновленный пользователь или undefined
   */
  async updateUserRefCode(userId: number, refCode: string): Promise<User | undefined> {
    try {
      console.log(`[DatabaseStorage] Обновление ref_code для пользователя ID: ${userId}, новый код: ${refCode}`);
      const [updatedUser] = await db
        .update(users)
        .set({ ref_code: refCode })
        .where(eq(users.id, userId))
        .returning();
      
      return updatedUser || undefined;
    } catch (error) {
      console.error(`[DatabaseStorage] Ошибка при обновлении ref_code для пользователя ${userId}:`, error);
      throw error;
    }
  }
  
  /**
   * Генерация реферального кода
   * @returns string Сгенерированный реферальный код
   */
  generateRefCode(): string {
    console.log('[DatabaseStorage] Генерация реферального кода');
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    
    for (let i = 0; i < 8; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length)).toLowerCase();
    }
    
    return result;
  }
  
  /**
   * Генерация уникального реферального кода
   * @returns Promise<string> Уникальный реферальный код
   */
  async generateUniqueRefCode(): Promise<string> {
    console.log('[DatabaseStorage] Генерация уникального реферального кода');
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
   * @param refCode Реферальный код для проверки
   * @returns Promise<boolean> true, если код уникален
   */
  async isRefCodeUnique(refCode: string): Promise<boolean> {
    try {
      console.log(`[DatabaseStorage] Проверка уникальности ref_code: ${refCode}`);
      
      const [result] = await db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(eq(users.ref_code, refCode));
      
      return result.count === 0;
    } catch (error) {
      console.error(`[DatabaseStorage] Ошибка при проверке уникальности ref_code ${refCode}:`, error);
      throw error;
    }
  }
  
  /**
   * Создание нового пользователя
   * @param insertUser Данные для создания пользователя
   * @returns Promise<User> Созданный пользователь
   */
  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      console.log('[DatabaseStorage] Создание нового пользователя:', insertUser);
      
      const [user] = await db
        .insert(users)
        .values(insertUser)
        .returning();
      
      if (!user) {
        throw new Error('Не удалось создать пользователя');
      }
      
      return user;
    } catch (error) {
      console.error('[DatabaseStorage] Ошибка при создании пользователя в БД:', error);
      throw error;
    }
  }
  
  /**
   * Создание записи о реферале
   * @param insertReferral Данные для создания записи о реферале
   * @returns Promise<Referral> Созданная запись о реферале
   */
  async createReferral(insertReferral: InsertReferral): Promise<Referral> {
    try {
      console.log('[DatabaseStorage] Создание новой записи о реферале:', insertReferral);
      
      const [referral] = await db
        .insert(referrals)
        .values(insertReferral)
        .returning();
      
      if (!referral) {
        throw new Error('Не удалось создать запись о реферале');
      }
      
      return referral;
    } catch (error) {
      console.error('[DatabaseStorage] Ошибка при создании записи о реферале в БД:', error);
      throw error;
    }
  }
  
  /**
   * Получение списка рефералов пользователя
   * @param userId ID пользователя, для которого нужно получить рефералов
   * @returns Promise<{referrals: User[], total: number}> Список рефералов и их количество
   */
  async getUserReferrals(userId: number): Promise<{referrals: User[], total: number}> {
    try {
      console.log(`[DatabaseStorage] Получение рефералов для пользователя с ID: ${userId}`);
      
      // Получаем ID пользователей-рефералов
      const referralRecords = await db
        .select()
        .from(referrals)
        .where(eq(referrals.inviter_id, userId));
      
      if (referralRecords.length === 0) {
        return { referrals: [], total: 0 };
      }
      
      // Получаем ID пользователей-рефералов
      const referralUserIds = referralRecords.map(ref => ref.user_id);
      
      // Получаем данные пользователей-рефералов
      const referralUsers = await db
        .select()
        .from(users)
        .where(sql`${users.id} IN (${referralUserIds.join(',')})`);
      
      return {
        referrals: referralUsers,
        total: referralRecords.length
      };
    } catch (error) {
      console.error(`[DatabaseStorage] Ошибка при получении рефералов для пользователя ${userId}:`, error);
      throw error;
    }
  }
  
  /**
   * Создание новой транзакции
   * @param insertTransaction Данные транзакции
   * @returns Promise<Transaction> Созданная транзакция
   */
  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    try {
      console.log('[DatabaseStorage] Создание новой транзакции:', insertTransaction);
      
      const [transaction] = await db
        .insert(transactions)
        .values(insertTransaction)
        .returning();
      
      if (!transaction) {
        throw new Error('Не удалось создать транзакцию');
      }
      
      return transaction;
    } catch (error) {
      console.error('[DatabaseStorage] Ошибка при создании транзакции в БД:', error);
      throw error;
    }
  }
  
  /**
   * Обновление баланса пользователя
   * @param userId ID пользователя
   * @param currency Валюта (UNI или TON)
   * @param amount Сумма для добавления (может быть отрицательной для списания)
   * @returns Promise<User> Обновленный пользователь
   */
  async updateUserBalance(userId: number, currency: 'UNI' | 'TON', amount: string): Promise<User> {
    try {
      console.log(`[DatabaseStorage] Обновление баланса пользователя ${userId}: ${currency} ${amount}`);
      
      let [updatedUser];
      
      if (currency === 'UNI') {
        [updatedUser] = await db
          .update(users)
          .set({
            balance_uni: sql`${users.balance_uni} + ${amount}`
          })
          .where(eq(users.id, userId))
          .returning();
      } else if (currency === 'TON') {
        [updatedUser] = await db
          .update(users)
          .set({
            balance_ton: sql`${users.balance_ton} + ${amount}`
          })
          .where(eq(users.id, userId))
          .returning();
      } else {
        throw new Error(`Неподдерживаемая валюта: ${currency}`);
      }
      
      if (!updatedUser) {
        throw new Error(`Не удалось обновить баланс пользователя ${userId}`);
      }
      
      return updatedUser;
    } catch (error) {
      console.error(`[DatabaseStorage] Ошибка при обновлении баланса пользователя ${userId}:`, error);
      throw error;
    }
  }
  
  /**
   * Создание депозита для фарминга
   * @param insertDeposit Данные депозита
   * @returns Promise<FarmingDeposit> Созданный депозит
   */
  async createFarmingDeposit(insertDeposit: InsertFarmingDeposit): Promise<FarmingDeposit> {
    try {
      console.log('[DatabaseStorage] Создание нового фарминг-депозита:', insertDeposit);
      
      const [deposit] = await db
        .insert(farmingDeposits)
        .values(insertDeposit)
        .returning();
      
      if (!deposit) {
        throw new Error('Не удалось создать фарминг-депозит');
      }
      
      return deposit;
    } catch (error) {
      console.error('[DatabaseStorage] Ошибка при создании фарминг-депозита в БД:', error);
      throw error;
    }
  }
  
  /**
   * Выполнение транзакции с несколькими операциями в одной атомарной транзакции
   * @param operations Функция, содержащая набор операций
   * @returns Promise<T> Результат транзакции
   */
  async executeTransaction<T>(operations: (tx: typeof db) => Promise<T>): Promise<T> {
    try {
      return await transaction(operations);
    } catch (error) {
      console.error('[DatabaseStorage] Ошибка при выполнении транзакции:', error);
      throw error;
    }
  }
}

// Резервное хранилище в памяти для случаев недоступности базы данных
const memStorage = new MemStorage();

/**
 * Класс адаптера хранилища с автоматическим переключением между БД и хранилищем в памяти
 */
export class StorageAdapter implements IStorage {
  private dbStorage: DatabaseStorage;
  private _memStorage: MemStorage;
  private checkConnectionInterval: NodeJS.Timeout | null = null;
  
  /**
   * Геттер для определения текущего использования хранилища в памяти
   */
  get isUsingMemory(): boolean {
    return dbState.usingInMemoryStorage;
  }
  
  /**
   * Геттер для доступа к хранилищу в памяти
   */
  get memStorage(): MemStorage {
    return this._memStorage;
  }
  
  constructor() {
    this.dbStorage = new DatabaseStorage();
    this._memStorage = memStorage;
    
    // Запускаем периодическую проверку доступности базы данных
    this.startConnectionCheck();
  }
  
  /**
   * Запуск периодической проверки соединения с базой данных
   */
  private startConnectionCheck() {
    // Проверка каждые 30 секунд
    this.checkConnectionInterval = setInterval(() => {
      // Если используется хранилище в памяти, пытаемся восстановить соединение с БД
      if (dbState.usingInMemoryStorage) {
        console.log('[StorageAdapter] Проверка возможности подключения к БД...');
      }
    }, 30000);
  }
  
  /**
   * Остановка периодической проверки соединения
   */
  public stopConnectionCheck() {
    if (this.checkConnectionInterval) {
      clearInterval(this.checkConnectionInterval);
      this.checkConnectionInterval = null;
    }
  }
  
  /**
   * Делегирование вызова методу соответствующего хранилища с обработкой ошибок
   * @param dbMethod Метод хранилища БД
   * @param memMethod Метод хранилища в памяти
   * @param args Аргументы метода
   * @returns Promise<T> Результат вызова метода
   */
  private async delegate<T>(
    dbMethod: (...args: any[]) => Promise<T>,
    memMethod: (...args: any[]) => Promise<T>,
    ...args: any[]
  ): Promise<T> {
    try {
      if (dbState.usingInMemoryStorage) {
        return await memMethod.apply(this._memStorage, args);
      }
      return await dbMethod.apply(this.dbStorage, args);
    } catch (error) {
      console.error('[StorageAdapter] Ошибка при выполнении операции хранилища, переключаемся на хранилище в памяти:', error);
      dbState.usingInMemoryStorage = true;
      return await memMethod.apply(this._memStorage, args);
    }
  }
  
  // Реализация методов интерфейса IStorage через делегирование
  
  async getUser(id: number): Promise<User | undefined> {
    return this.delegate(this.dbStorage.getUser, this._memStorage.getUser, id);
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.delegate(this.dbStorage.getUserByUsername, this._memStorage.getUserByUsername, username);
  }
  
  async getUserByGuestId(guestId: string): Promise<User | undefined> {
    return this.delegate(this.dbStorage.getUserByGuestId, this._memStorage.getUserByGuestId, guestId);
  }
  
  async getUserByRefCode(refCode: string): Promise<User | undefined> {
    return this.delegate(this.dbStorage.getUserByRefCode, this._memStorage.getUserByRefCode, refCode);
  }
  
  async updateUserRefCode(userId: number, refCode: string): Promise<User | undefined> {
    return this.delegate(this.dbStorage.updateUserRefCode, this._memStorage.updateUserRefCode, userId, refCode);
  }
  
  generateRefCode(): string {
    // Для этого метода не нужно делегирование, т.к. он не обращается к БД
    return this.dbStorage.generateRefCode();
  }
  
  async generateUniqueRefCode(): Promise<string> {
    return this.delegate(this.dbStorage.generateUniqueRefCode, this._memStorage.generateUniqueRefCode);
  }
  
  async isRefCodeUnique(refCode: string): Promise<boolean> {
    return this.delegate(this.dbStorage.isRefCodeUnique, this._memStorage.isRefCodeUnique, refCode);
  }
  
  async createUser(insertUser: InsertUser): Promise<User> {
    return this.delegate(this.dbStorage.createUser, this._memStorage.createUser, insertUser);
  }
}

// Экспортируем экземпляр адаптера хранилища для использования в приложении
export const storage = new StorageAdapter();