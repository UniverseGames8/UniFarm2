// Временная реализация хранилища в памяти для работы без базы данных
import { users, type User, type InsertUser } from "../shared/schema";
import { eq } from "drizzle-orm";

// Импортируем необходимые типы
import { 
  type Transaction, type InsertTransaction,
  type UniFarmingDeposit, type InsertUniFarmingDeposit,
  type Referral, type InsertReferral,
  type TonBoostDeposit, type InsertTonBoostDeposit
} from "../shared/schema";

// Интерфейс хранилища (IStorage)
export interface IStorage {
  // USER METHODS
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByGuestId(guestId: string): Promise<User | undefined>;
  getUserByRefCode(refCode: string): Promise<User | undefined>;
  getUserByTelegramId(telegramId: number): Promise<User | undefined>;
  createUser(insertUser: InsertUser): Promise<User>;
  updateUserRefCode(userId: number, refCode: string): Promise<User | undefined>;
  updateUserBalance(userId: number, currencyType: 'uni' | 'ton', amount: string): Promise<User | undefined>;
  generateRefCode(): string;
  generateUniqueRefCode(): Promise<string>;
  isRefCodeUnique(refCode: string): Promise<boolean>;
  
  // TRANSACTION METHODS
  getTransaction(id: number): Promise<Transaction | undefined>;
  getUserTransactions(userId: number, limit?: number): Promise<Transaction[]>;
  createTransaction(insertTransaction: InsertTransaction): Promise<Transaction>;
  updateTransactionStatus(transactionId: number, status: string): Promise<Transaction | undefined>;
  
  // FARMING METHODS
  getUserUniFarmingDeposits(userId: number): Promise<UniFarmingDeposit[]>;
  createUniFarmingDeposit(insertDeposit: InsertUniFarmingDeposit): Promise<UniFarmingDeposit>;
  updateUniFarmingDeposit(id: number, updates: Partial<UniFarmingDeposit>): Promise<UniFarmingDeposit | undefined>;
  getActiveUniFarmingDeposits(): Promise<UniFarmingDeposit[]>;
  
  // TON BOOST METHODS
  getUserTonBoostDeposits(userId: number): Promise<TonBoostDeposit[]>;
  createTonBoostDeposit(insertDeposit: InsertTonBoostDeposit): Promise<TonBoostDeposit>;
  updateTonBoostDeposit(id: number, updates: Partial<TonBoostDeposit>): Promise<TonBoostDeposit | undefined>;
  getActiveTonBoostDeposits(): Promise<TonBoostDeposit[]>;
  
  // REFERRAL METHODS
  createReferral(insertReferral: InsertReferral): Promise<Referral>;
  getReferralByUserId(userId: number): Promise<Referral | undefined>;
  getUserReferrals(inviterId: number): Promise<Referral[]>;
}

// Временное хранилище в памяти
export class MemStorage implements IStorage {
  // Хранилища данных в памяти
  private users: User[] = [];
  private transactions: Transaction[] = [];
  private uniFarmingDeposits: UniFarmingDeposit[] = [];
  private tonBoostDeposits: TonBoostDeposit[] = [];
  private referrals: Referral[] = [];
  
  // Счетчики для генерации ID
  private nextUserId = 1;
  private nextTransactionId = 1;
  private nextUniFarmingDepositId = 1;
  private nextTonBoostDepositId = 1;
  private nextReferralId = 1;

  // =================== USER METHODS ===================
  
  async getUser(id: number): Promise<User | undefined> {
    console.log('[MemStorage] Получение пользователя по ID:', id);
    return this.users.find(user => user.id === id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    console.log('[MemStorage] Получение пользователя по имени:', username);
    return this.users.find(user => user.username === username);
  }

  async getUserByGuestId(guestId: string): Promise<User | undefined> {
    console.log('[MemStorage] Получение пользователя по guest_id:', guestId);
    return this.users.find(user => user.guest_id === guestId);
  }
  
  async getUserByRefCode(refCode: string): Promise<User | undefined> {
    console.log('[MemStorage] Получение пользователя по ref_code:', refCode);
    console.log('[MemStorage] Текущие пользователи:', this.users);
    const user = this.users.find(user => user.ref_code === refCode);
    console.log('[MemStorage] Результат поиска пользователя по ref_code:', user || 'не найден');
    return user;
  }
  
  async getUserByTelegramId(telegramId: number): Promise<User | undefined> {
    console.log('[MemStorage] Получение пользователя по Telegram ID:', telegramId);
    return this.users.find(user => user.telegram_id === telegramId);
  }
  
  async updateUserRefCode(userId: number, refCode: string): Promise<User | undefined> {
    console.log(`[MemStorage] Обновление ref_code для пользователя ID: ${userId}, новый код: ${refCode}`);
    const userIndex = this.users.findIndex(user => user.id === userId);
    
    if (userIndex === -1) {
      return undefined;
    }
    
    this.users[userIndex] = {
      ...this.users[userIndex],
      ref_code: refCode
    };
    
    return this.users[userIndex];
  }
  
  async updateUserBalance(userId: number, currencyType: 'uni' | 'ton', amount: string): Promise<User | undefined> {
    console.log(`[MemStorage] Обновление баланса для пользователя ID: ${userId}, валюта: ${currencyType}, сумма: ${amount}`);
    const userIndex = this.users.findIndex(user => user.id === userId);
    
    if (userIndex === -1) {
      return undefined;
    }
    
    const user = this.users[userIndex];
    const fieldToUpdate = currencyType === 'uni' ? 'balance_uni' : 'balance_ton';
    const currentBalance = parseFloat(user[fieldToUpdate] as string);
    const newBalance = (currentBalance + parseFloat(amount)).toString();
    
    this.users[userIndex] = {
      ...user,
      [fieldToUpdate]: newBalance
    };
    
    return this.users[userIndex];
  }
  
  generateRefCode(): string {
    console.log('[MemStorage] Генерация реферального кода');
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    
    for (let i = 0; i < 8; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    return result;
  }
  
  async generateUniqueRefCode(): Promise<string> {
    console.log('[MemStorage] Генерация уникального реферального кода');
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
  
  async isRefCodeUnique(refCode: string): Promise<boolean> {
    console.log(`[MemStorage] Проверка уникальности ref_code: ${refCode}`);
    const existingUser = await this.getUserByRefCode(refCode);
    return !existingUser;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    console.log('[MemStorage] Создание нового пользователя:', insertUser);
    const id = this.nextUserId++;
    const createdAt = new Date();
    
    // Создаем нового пользователя согласно схеме
    const newUser: User = {
      id,
      telegram_id: insertUser.telegram_id || null,
      guest_id: insertUser.guest_id || null,
      username: insertUser.username || `user${id}`,
      wallet: insertUser.wallet || null,
      ton_wallet_address: insertUser.ton_wallet_address || null,
      ref_code: insertUser.ref_code || `REF${id.toString().padStart(6, '0')}`,
      parent_ref_code: insertUser.parent_ref_code || null,
      balance_uni: "0",
      balance_ton: "0",
      uni_deposit_amount: "0",
      uni_farming_start_timestamp: null,
      uni_farming_balance: "0",
      uni_farming_rate: "0",
      uni_farming_last_update: null,
      created_at: createdAt,
      checkin_last_date: null,
      checkin_streak: 0
    };
    
    this.users.push(newUser);
    return newUser;
  }
  
  // =================== TRANSACTION METHODS ===================
  
  async getTransaction(id: number): Promise<Transaction | undefined> {
    console.log(`[MemStorage] Получение транзакции по ID: ${id}`);
    return this.transactions.find(tx => tx.id === id);
  }
  
  async getUserTransactions(userId: number, limit: number = 50): Promise<Transaction[]> {
    console.log(`[MemStorage] Получение транзакций пользователя ID: ${userId}, лимит: ${limit}`);
    return this.transactions
      .filter(tx => tx.user_id === userId)
      .sort((a, b) => {
        // Сортировка по убыванию даты создания
        const dateA = a.created_at instanceof Date ? a.created_at : new Date(a.created_at || 0);
        const dateB = b.created_at instanceof Date ? b.created_at : new Date(b.created_at || 0);
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, limit);
  }
  
  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    console.log(`[MemStorage] Создание новой транзакции:`, insertTransaction);
    const id = this.nextTransactionId++;
    const createdAt = new Date();
    
    const newTransaction: Transaction = {
      id,
      user_id: insertTransaction.user_id,
      type: insertTransaction.type,
      currency: insertTransaction.currency,
      amount: insertTransaction.amount,
      status: insertTransaction.status || "confirmed",
      source: insertTransaction.source || null,
      category: insertTransaction.category || null,
      tx_hash: insertTransaction.tx_hash || null,
      description: insertTransaction.description || null,
      source_user_id: insertTransaction.source_user_id || null,
      wallet_address: insertTransaction.wallet_address || null,
      data: insertTransaction.data || null,
      created_at: createdAt
    };
    
    this.transactions.push(newTransaction);
    return newTransaction;
  }
  
  async updateTransactionStatus(transactionId: number, status: string): Promise<Transaction | undefined> {
    console.log(`[MemStorage] Обновление статуса транзакции ID: ${transactionId}, новый статус: ${status}`);
    const transactionIndex = this.transactions.findIndex(tx => tx.id === transactionId);
    
    if (transactionIndex === -1) {
      return undefined;
    }
    
    this.transactions[transactionIndex] = {
      ...this.transactions[transactionIndex],
      status
    };
    
    return this.transactions[transactionIndex];
  }
  
  // =================== FARMING METHODS ===================
  
  async getUserUniFarmingDeposits(userId: number): Promise<UniFarmingDeposit[]> {
    console.log(`[MemStorage] Получение UNI фарминг-депозитов пользователя ID: ${userId}`);
    return this.uniFarmingDeposits
      .filter(deposit => deposit.user_id === userId)
      .sort((a, b) => {
        // Сортировка по убыванию даты создания
        const dateA = a.created_at instanceof Date ? a.created_at : new Date(a.created_at || 0);
        const dateB = b.created_at instanceof Date ? b.created_at : new Date(b.created_at || 0);
        return dateB.getTime() - dateA.getTime();
      });
  }
  
  async createUniFarmingDeposit(insertDeposit: InsertUniFarmingDeposit): Promise<UniFarmingDeposit> {
    console.log(`[MemStorage] Создание нового UNI фарминг-депозита:`, insertDeposit);
    const id = this.nextUniFarmingDepositId++;
    const createdAt = new Date();
    
    const newDeposit: UniFarmingDeposit = {
      id,
      user_id: insertDeposit.user_id,
      amount: insertDeposit.amount,
      created_at: createdAt,
      rate_per_second: insertDeposit.rate_per_second,
      last_updated_at: createdAt,
      is_active: insertDeposit.is_active !== undefined ? insertDeposit.is_active : true
    };
    
    this.uniFarmingDeposits.push(newDeposit);
    return newDeposit;
  }
  
  async updateUniFarmingDeposit(id: number, updates: Partial<UniFarmingDeposit>): Promise<UniFarmingDeposit | undefined> {
    console.log(`[MemStorage] Обновление UNI фарминг-депозита ID: ${id}`, updates);
    const depositIndex = this.uniFarmingDeposits.findIndex(deposit => deposit.id === id);
    
    if (depositIndex === -1) {
      return undefined;
    }
    
    this.uniFarmingDeposits[depositIndex] = {
      ...this.uniFarmingDeposits[depositIndex],
      ...updates
    };
    
    return this.uniFarmingDeposits[depositIndex];
  }
  
  async getActiveUniFarmingDeposits(): Promise<UniFarmingDeposit[]> {
    console.log(`[MemStorage] Получение всех активных UNI фарминг-депозитов`);
    return this.uniFarmingDeposits.filter(deposit => deposit.is_active);
  }
  
  // =================== TON BOOST METHODS ===================
  
  async getUserTonBoostDeposits(userId: number): Promise<TonBoostDeposit[]> {
    console.log(`[MemStorage] Получение TON буст-депозитов пользователя ID: ${userId}`);
    return this.tonBoostDeposits
      .filter(deposit => deposit.user_id === userId)
      .sort((a, b) => {
        // Сортировка по убыванию даты создания
        const dateA = a.created_at instanceof Date ? a.created_at : new Date(a.created_at || 0);
        const dateB = b.created_at instanceof Date ? b.created_at : new Date(b.created_at || 0);
        return dateB.getTime() - dateA.getTime();
      });
  }
  
  async createTonBoostDeposit(insertDeposit: InsertTonBoostDeposit): Promise<TonBoostDeposit> {
    console.log(`[MemStorage] Создание нового TON буст-депозита:`, insertDeposit);
    const id = this.nextTonBoostDepositId++;
    const createdAt = new Date();
    
    const newDeposit: TonBoostDeposit = {
      id,
      user_id: insertDeposit.user_id,
      ton_amount: insertDeposit.ton_amount,
      bonus_uni: insertDeposit.bonus_uni,
      rate_ton_per_second: insertDeposit.rate_ton_per_second,
      rate_uni_per_second: insertDeposit.rate_uni_per_second,
      accumulated_ton: insertDeposit.accumulated_ton || "0",
      created_at: createdAt,
      last_updated_at: createdAt,
      is_active: insertDeposit.is_active !== undefined ? insertDeposit.is_active : true
    };
    
    this.tonBoostDeposits.push(newDeposit);
    return newDeposit;
  }
  
  async updateTonBoostDeposit(id: number, updates: Partial<TonBoostDeposit>): Promise<TonBoostDeposit | undefined> {
    console.log(`[MemStorage] Обновление TON буст-депозита ID: ${id}`, updates);
    const depositIndex = this.tonBoostDeposits.findIndex(deposit => deposit.id === id);
    
    if (depositIndex === -1) {
      return undefined;
    }
    
    this.tonBoostDeposits[depositIndex] = {
      ...this.tonBoostDeposits[depositIndex],
      ...updates
    };
    
    return this.tonBoostDeposits[depositIndex];
  }
  
  async getActiveTonBoostDeposits(): Promise<TonBoostDeposit[]> {
    console.log(`[MemStorage] Получение всех активных TON буст-депозитов`);
    return this.tonBoostDeposits.filter(deposit => deposit.is_active);
  }
  
  // =================== REFERRAL METHODS ===================
  
  async createReferral(insertReferral: InsertReferral): Promise<Referral> {
    console.log(`[MemStorage] Создание новой реферальной связи:`, insertReferral);
    const id = this.nextReferralId++;
    const createdAt = new Date();
    
    const newReferral: Referral = {
      id,
      user_id: insertReferral.user_id,
      inviter_id: insertReferral.inviter_id,
      level: insertReferral.level || 1,
      reward_uni: insertReferral.reward_uni || "0",
      ref_path: insertReferral.ref_path || [],
      created_at: insertReferral.created_at || createdAt
    };
    
    this.referrals.push(newReferral);
    return newReferral;
  }
  
  async getReferralByUserId(userId: number): Promise<Referral | undefined> {
    console.log(`[MemStorage] Получение реферальной связи по ID пользователя: ${userId}`);
    return this.referrals.find(ref => ref.user_id === userId);
  }
  
  async getUserReferrals(inviterId: number): Promise<Referral[]> {
    console.log(`[MemStorage] Получение рефералов пользователя ID: ${inviterId}`);
    return this.referrals
      .filter(ref => ref.inviter_id === inviterId)
      .sort((a, b) => {
        // Сортировка по убыванию даты создания
        const dateA = a.created_at instanceof Date ? a.created_at : new Date(a.created_at || 0);
        const dateB = b.created_at instanceof Date ? b.created_at : new Date(b.created_at || 0);
        return dateB.getTime() - dateA.getTime();
      });
  }
}

// Экспортируем экземпляр хранилища с фиктивными данными
export const storage = new MemStorage();