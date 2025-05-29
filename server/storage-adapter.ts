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
  type InsertFarmingDeposit,
  uniFarmingDeposits,
  type UniFarmingDeposit,
  type InsertUniFarmingDeposit,
  tonBoostDeposits,
  type TonBoostDeposit,
  type InsertTonBoostDeposit,
  userMissions,
  type UserMission,
  type InsertUserMission
} from "../shared/schema";
import { eq, sql } from "drizzle-orm";
import { db, pool, dbState, queryWithRetry } from "./db-connect-unified";
import { IStorage, IExtendedStorage } from './storage-interface';
import { MemStorage } from './storage-memory';
import { createInsertSchema } from "drizzle-zod";

// Адаптер для хранилища с фолбеком на хранилище в памяти
class StorageAdapter implements IExtendedStorage {
  private dbStorage: IStorage;
  private _memStorage: MemStorage;
  private useMemory: boolean = false;
  private checkConnectionInterval: NodeJS.Timeout | null = null;
  private reconnectAttempt: number = 0;
  private maxReconnectAttempts: number = 20; // Максимальное количество попыток переподключения
  private lastConnectionCheck: number = 0; // Время последней проверки
  private connectionCheckThrottle: number = 5000; // Минимальное время между проверками (5 секунд)
  
  // Геттер для доступа к хранилищу в памяти
  get memStorage(): MemStorage {
    return this._memStorage;
  }
  
  // Проверка текущего использования хранилища
  get isUsingMemory(): boolean {
    return this.useMemory;
  }
  
  constructor() {
    this._memStorage = new MemStorage();
    
    // Реализация хранилища с использованием базы данных
    this.dbStorage = {
      async getUser(id: number): Promise<User | undefined> {
        try {
          const [user] = await queryWithRetry('SELECT * FROM users WHERE id = $1', [id])
            .then(result => result.rows as User[]);
          return user || undefined;
        } catch (error) {
          console.error('[StorageAdapter] Ошибка при получении пользователя из БД:', error);
          throw error;
        }
      },
      
      async getUserByUsername(username: string): Promise<User | undefined> {
        try {
          const [user] = await queryWithRetry('SELECT * FROM users WHERE username = $1', [username])
            .then(result => result.rows as User[]);
          return user || undefined;
        } catch (error) {
          console.error('[StorageAdapter] Ошибка при получении пользователя по имени из БД:', error);
          throw error;
        }
      },
      
      async getUserByGuestId(guestId: string): Promise<User | undefined> {
        try {
          console.log(`[StorageAdapter] Получение пользователя по guest_id: ${guestId}`);
          const [user] = await queryWithRetry('SELECT * FROM users WHERE guest_id = $1', [guestId])
            .then(result => result.rows as User[]);
          return user || undefined;
        } catch (error) {
          console.error(`[StorageAdapter] Ошибка при получении пользователя по guest_id ${guestId}:`, error);
          throw error;
        }
      },
      
      async getUserByRefCode(refCode: string): Promise<User | undefined> {
        try {
          console.log(`[StorageAdapter] Получение пользователя по ref_code: ${refCode}`);
          const [user] = await queryWithRetry('SELECT * FROM users WHERE ref_code = $1', [refCode])
            .then(result => result.rows as User[]);
          return user || undefined;
        } catch (error) {
          console.error(`[StorageAdapter] Ошибка при получении пользователя по ref_code ${refCode}:`, error);
          throw error;
        }
      },
      
      async updateUserRefCode(userId: number, refCode: string): Promise<User | undefined> {
        try {
          console.log(`[StorageAdapter] Обновление ref_code для пользователя ID: ${userId}, новый код: ${refCode}`);
          const [user] = await queryWithRetry(
            'UPDATE users SET ref_code = $1 WHERE id = $2 RETURNING *',
            [refCode, userId]
          ).then(result => result.rows as User[]);
          return user || undefined;
        } catch (error) {
          console.error(`[StorageAdapter] Ошибка при обновлении ref_code для пользователя ${userId}:`, error);
          throw error;
        }
      },
      
      generateRefCode(): string {
        console.log('[StorageAdapter] Генерация реферального кода');
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        
        for (let i = 0; i < 8; i++) {
          result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        
        return result;
      },
      
      async generateUniqueRefCode(): Promise<string> {
        console.log('[StorageAdapter] Генерация уникального реферального кода');
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
      },
      
      async isRefCodeUnique(refCode: string): Promise<boolean> {
        try {
          console.log(`[StorageAdapter] Проверка уникальности ref_code: ${refCode}`);
          const result = await queryWithRetry(
            'SELECT COUNT(*) as count FROM users WHERE ref_code = $1',
            [refCode]
          );
          return Number(result.rows[0].count) === 0;
        } catch (error) {
          console.error(`[StorageAdapter] Ошибка при проверке уникальности ref_code ${refCode}:`, error);
          throw error;
        }
      },
      
      async createUser(insertUser: InsertUser): Promise<User> {
        try {
          const columns = Object.keys(insertUser).join(', ');
          const values = Object.keys(insertUser).map((_, i) => `$${i + 1}`).join(', ');
          const placeholders = Object.values(insertUser);
          
          const query = `
            INSERT INTO users (${columns})
            VALUES (${values})
            RETURNING *
          `;
          
          const result = await queryWithRetry(query, placeholders);
          if (result.rows.length === 0) {
            throw new Error('Не удалось создать пользователя');
          }
          
          return result.rows[0] as User;
        } catch (error) {
          console.error('[StorageAdapter] Ошибка при создании пользователя в БД:', error);
          throw error;
        }
      }
    };
    
    // Проверяем доступность базы данных
    this.checkDatabaseConnection();
    
    // Запускаем периодическую проверку доступности базы данных
    this.startConnectionCheck();
  }
  
  // Запуск периодической проверки соединения
  private startConnectionCheck() {
    // Интервал проверки - 15 секунд
    this.checkConnectionInterval = setInterval(() => {
      this.reconnectToDatabase();
    }, 15000);
  }
  
  // Остановка периодической проверки соединения
  private stopConnectionCheck() {
    if (this.checkConnectionInterval) {
      clearInterval(this.checkConnectionInterval);
      this.checkConnectionInterval = null;
    }
  }
  
  // Попытка восстановить соединение с базой данных
  private async reconnectToDatabase() {
    // Если мы не используем память (уже подключены к БД) - ничего не делаем
    if (!this.useMemory) return;
    
    // Проверяем, не прошло ли мало времени с последней проверки
    const now = Date.now();
    if (now - this.lastConnectionCheck < this.connectionCheckThrottle) return;
    this.lastConnectionCheck = now;
    
    try {
      this.reconnectAttempt++;
      console.log(`[StorageAdapter] Попытка переподключения к БД (${this.reconnectAttempt}/${this.maxReconnectAttempts})...`);
      
      const isConnected = await this.checkDatabaseConnection();
      
      if (isConnected) {
        console.log('[StorageAdapter] ✅ Переподключение к БД успешно!');
        
        // Сбрасываем счетчик попыток
        this.reconnectAttempt = 0;
        
        // Если достигнуто максимальное количество попыток, останавливаем проверки
        if (this.reconnectAttempt >= this.maxReconnectAttempts) {
          console.warn('[StorageAdapter] Достигнут предел попыток переподключения к БД. Остаемся на хранилище в памяти.');
          this.stopConnectionCheck();
        }
      } else {
        console.log('[StorageAdapter] ❌ Переподключение к БД не удалось.');
      }
    } catch (error) {
      console.error('[StorageAdapter] Ошибка при попытке переподключения к БД:', error);
    }
  }
  
  // Функция для выполнения запроса с повторными попытками
  private async queryWithRetry(query: string, params: any[] = [], maxRetries: number = 3): Promise<any> {
    let retries = 0;
    let lastError;
    
    while (retries < maxRetries) {
      try {
        // Используем pool из импортированного модуля db
        const { pool } = require('./db');
        const result = await pool.query(query, params);
        return result;
      } catch (error) {
        lastError = error;
        retries++;
        if (retries < maxRetries) {
          // Ждем перед следующей попыткой (увеличиваем время ожидания с каждой попыткой)
          const delay = 500 * retries;
          await new Promise(resolve => setTimeout(resolve, delay));
          console.log(`[StorageAdapter] Повторная попытка запроса ${retries}/${maxRetries}...`);
        }
      }
    }
    
    throw lastError;
  }
  
  // Проверка подключения к базе данных с возвратом статуса
  private async checkDatabaseConnection(): Promise<boolean> {
    try {
      // Выполняем простой запрос к базе данных с использованием импортированной функции
      const result = await queryWithRetry('SELECT 1', [], 1); // Импортированная функция из db-selector
      console.log('[StorageAdapter] Соединение с базой данных установлено', result?.rows ? 'успешно' : 'с предупреждением');
      this.useMemory = false;
      return true;
    } catch (error) {
      console.error('[StorageAdapter] Ошибка подключения к базе данных, переключаемся на хранилище в памяти:', error);
      this.useMemory = true;
      return false;
    }
  }
  
  // Методы интерфейса IStorage с перенаправлением в зависимости от доступности БД
  async getUser(id: number): Promise<User | undefined> {
    try {
      if (this.useMemory) {
        return await this.memStorage.getUser(id);
      }
      return await this.dbStorage.getUser(id);
    } catch (error) {
      console.error('[StorageAdapter] Ошибка при получении пользователя, переключаемся на хранилище в памяти:', error);
      this.useMemory = true;
      return await this.memStorage.getUser(id);
    }
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      if (this.useMemory) {
        return await this.memStorage.getUserByUsername(username);
      }
      return await this.dbStorage.getUserByUsername(username);
    } catch (error) {
      console.error('[StorageAdapter] Ошибка при получении пользователя по имени, переключаемся на хранилище в памяти:', error);
      this.useMemory = true;
      return await this.memStorage.getUserByUsername(username);
    }
  }
  
  async getUserByGuestId(guestId: string): Promise<User | undefined> {
    try {
      if (this.useMemory) {
        return await this.memStorage.getUserByGuestId(guestId);
      }
      return await this.dbStorage.getUserByGuestId(guestId);
    } catch (error) {
      console.error(`[StorageAdapter] Ошибка при получении пользователя по guest_id ${guestId}, переключаемся на хранилище в памяти:`, error);
      this.useMemory = true;
      return await this.memStorage.getUserByGuestId(guestId);
    }
  }
  
  async getUserByRefCode(refCode: string): Promise<User | undefined> {
    try {
      if (this.useMemory) {
        return await this.memStorage.getUserByRefCode(refCode);
      }
      return await this.dbStorage.getUserByRefCode(refCode);
    } catch (error) {
      console.error(`[StorageAdapter] Ошибка при получении пользователя по ref_code ${refCode}, переключаемся на хранилище в памяти:`, error);
      this.useMemory = true;
      return await this.memStorage.getUserByRefCode(refCode);
    }
  }
  
  async updateUserRefCode(userId: number, refCode: string): Promise<User | undefined> {
    try {
      if (this.useMemory) {
        return await this.memStorage.updateUserRefCode(userId, refCode);
      }
      return await this.dbStorage.updateUserRefCode(userId, refCode);
    } catch (error) {
      console.error(`[StorageAdapter] Ошибка при обновлении ref_code для пользователя ${userId}, переключаемся на хранилище в памяти:`, error);
      this.useMemory = true;
      return await this.memStorage.updateUserRefCode(userId, refCode);
    }
  }
  
  generateRefCode(): string {
    if (this.useMemory) {
      return this.memStorage.generateRefCode();
    }
    return this.dbStorage.generateRefCode();
  }
  
  async generateUniqueRefCode(): Promise<string> {
    try {
      if (this.useMemory) {
        return await this.memStorage.generateUniqueRefCode();
      }
      return await this.dbStorage.generateUniqueRefCode();
    } catch (error) {
      console.error('[StorageAdapter] Ошибка при генерации уникального ref_code, переключаемся на хранилище в памяти:', error);
      this.useMemory = true;
      return await this.memStorage.generateUniqueRefCode();
    }
  }
  
  async isRefCodeUnique(refCode: string): Promise<boolean> {
    try {
      if (this.useMemory) {
        return await this.memStorage.isRefCodeUnique(refCode);
      }
      return await this.dbStorage.isRefCodeUnique(refCode);
    } catch (error) {
      console.error(`[StorageAdapter] Ошибка при проверке уникальности ref_code ${refCode}, переключаемся на хранилище в памяти:`, error);
      this.useMemory = true;
      return await this.memStorage.isRefCodeUnique(refCode);
    }
  }
  
  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      if (this.useMemory) {
        return await this.memStorage.createUser(insertUser);
      }
      return await this.dbStorage.createUser(insertUser);
    } catch (error) {
      console.error('[StorageAdapter] Ошибка при создании пользователя, переключаемся на хранилище в памяти:', error);
      this.useMemory = true;
      return await this.memStorage.createUser(insertUser);
    }
  }

  // Реализация методов из IExtendedStorage
  
  async getUserByTelegramId(telegramId: number): Promise<User | undefined> {
    try {
      if (this.useMemory) {
        return await this.memStorage.getUserByTelegramId(telegramId);
      }
      
      const query = 'SELECT * FROM users WHERE telegram_id = $1';
      const result = await queryWithRetry(query, [telegramId]);
      const user = result.rows[0] as User | undefined;
      
      console.log(`[StorageAdapter] Получен пользователь по telegram_id ${telegramId}:`, user ? `ID: ${user.id}` : 'не найден');
      return user;
    } catch (error) {
      console.error(`[StorageAdapter] Ошибка при получении пользователя по telegram_id ${telegramId}, переключаемся на хранилище в памяти:`, error);
      this.useMemory = true;
      return await this.memStorage.getUserByTelegramId(telegramId);
    }
  }
  
  // Транзакции
  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    console.log('[StorageAdapter] Создание транзакции');
    try {
      if (this.useMemory) {
        return await this.memStorage.createTransaction(transaction);
      }
      
      const [newTransaction] = await db.insert(transactions).values(transaction).returning();
      if (!newTransaction) {
        throw new Error('Не удалось создать транзакцию');
      }
      
      return newTransaction;
    } catch (error) {
      console.error('[StorageAdapter] Ошибка при создании транзакции, переключаемся на хранилище в памяти:', error);
      this.useMemory = true;
      return await this.memStorage.createTransaction(transaction);
    }
  }

  async getUserTransactions(userId: number, limit: number = 10, offset: number = 0): Promise<{transactions: Transaction[], total: number}> {
    console.log(`[StorageAdapter] Получение транзакций пользователя с ID: ${userId}`);
    try {
      if (this.useMemory) {
        return await this.memStorage.getUserTransactions(userId, limit, offset);
      }
      
      const transactionsQuery = await db.select().from(transactions)
        .where(eq(transactions.user_id, userId))
        .orderBy(sql`${transactions.created_at} DESC`)
        .limit(limit)
        .offset(offset);
      
      const countQuery = await db.select({ count: sql`count(*)` }).from(transactions)
        .where(eq(transactions.user_id, userId));
      
      const total = Number(countQuery[0]?.count || 0);
      
      return {
        transactions: transactionsQuery as Transaction[],
        total
      };
    } catch (error) {
      console.error(`[StorageAdapter] Ошибка при получении транзакций пользователя ${userId}, переключаемся на хранилище в памяти:`, error);
      this.useMemory = true;
      return await this.memStorage.getUserTransactions(userId, limit, offset);
    }
  }

  // Рефералы
  async createReferral(referral: InsertReferral): Promise<Referral> {
    console.log('[StorageAdapter] Создание реферального приглашения');
    try {
      if (this.useMemory) {
        return await this.memStorage.createReferral(referral);
      }
      
      const [newReferral] = await db.insert(referrals).values(referral).returning();
      if (!newReferral) {
        throw new Error('Не удалось создать реферальное приглашение');
      }
      
      return newReferral;
    } catch (error) {
      console.error('[StorageAdapter] Ошибка при создании реферального приглашения, переключаемся на хранилище в памяти:', error);
      this.useMemory = true;
      return await this.memStorage.createReferral(referral);
    }
  }

  async getUserReferrals(userId: number): Promise<{referrals: User[], total: number}> {
    console.log(`[StorageAdapter] Получение рефералов пользователя с ID: ${userId}`);
    try {
      if (this.useMemory) {
        return await this.memStorage.getUserReferrals(userId);
      }
      
      const userReferralsQuery = await db.select({
        id: users.id,
        username: users.username,
        telegram_id: users.telegram_id,
        guest_id: users.guest_id,
        wallet: users.wallet,
        ton_wallet_address: users.ton_wallet_address,
        ref_code: users.ref_code,
        parent_ref_code: users.parent_ref_code,
        balance_uni: users.balance_uni,
        balance_ton: users.balance_ton,
        uni_deposit_amount: users.uni_deposit_amount,
        uni_farming_start_timestamp: users.uni_farming_start_timestamp,
        uni_farming_balance: users.uni_farming_balance,
        uni_farming_rate: users.uni_farming_rate,
        uni_farming_last_update: users.uni_farming_last_update,
        created_at: users.created_at,
        checkin_streak: users.checkin_streak
      }).from(referrals)
        .innerJoin(users, eq(referrals.user_id, users.id))
        .where(eq(referrals.inviter_id, userId));
      
      const countQuery = await db.select({ count: sql`count(*)` }).from(referrals)
        .where(eq(referrals.inviter_id, userId));
      
      const total = Number(countQuery[0]?.count || 0);
      
      return { 
        referrals: userReferralsQuery as User[],
        total
      };
    } catch (error) {
      console.error(`[StorageAdapter] Ошибка при получении рефералов пользователя ${userId}, переключаемся на хранилище в памяти:`, error);
      this.useMemory = true;
      return await this.memStorage.getUserReferrals(userId);
    }
  }

  async getReferralByUserIdAndInviterId(userId: number, inviterId: number): Promise<Referral | undefined> {
    console.log(`[StorageAdapter] Получение реферального приглашения для user_id: ${userId}, inviter_id: ${inviterId}`);
    try {
      if (this.useMemory) {
        return await this.memStorage.getReferralByUserIdAndInviterId(userId, inviterId);
      }
      
      const [referral] = await db.select().from(referrals)
        .where(eq(referrals.user_id, userId))
        .where(eq(referrals.inviter_id, inviterId))
        .limit(1);
      
      return referral;
    } catch (error) {
      console.error(`[StorageAdapter] Ошибка при получении реферального приглашения для user_id ${userId}, inviter_id ${inviterId}, переключаемся на хранилище в памяти:`, error);
      this.useMemory = true;
      return await this.memStorage.getReferralByUserIdAndInviterId(userId, inviterId);
    }
  }

  // Farming депозиты
  async createFarmingDeposit(deposit: InsertFarmingDeposit): Promise<FarmingDeposit> {
    console.log('[StorageAdapter] Создание депозита фарминга');
    try {
      const columns = Object.keys(deposit).join(', ');
      const values = Object.keys(deposit).map((_, i) => `$${i + 1}`).join(', ');
      const placeholders = Object.values(deposit);
      
      const query = `
        INSERT INTO farming_deposits (${columns})
        VALUES (${values})
        RETURNING *
      `;
      
      const result = await queryWithRetry(query, placeholders);
      if (result.rows.length === 0) {
        throw new Error('Не удалось создать депозит фарминга');
      }
      
      return result.rows[0] as FarmingDeposit;
    } catch (error) {
      console.error('[StorageAdapter] Ошибка при создании депозита фарминга:', error);
      throw error;
    }
  }

  async getUserFarmingDeposits(userId: number): Promise<FarmingDeposit[]> {
    console.log(`[StorageAdapter] Получение депозитов фарминга пользователя с ID: ${userId}`);
    try {
      const result = await queryWithRetry(
        'SELECT * FROM farming_deposits WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      
      return result.rows as FarmingDeposit[];
    } catch (error) {
      console.error(`[StorageAdapter] Ошибка при получении депозитов фарминга пользователя ${userId}:`, error);
      throw error;
    }
  }

  // UNI Фарминг
  async createUniFarmingDeposit(deposit: InsertUniFarmingDeposit): Promise<UniFarmingDeposit> {
    console.log('[StorageAdapter] Создание депозита UNI фарминга');
    try {
      const columns = Object.keys(deposit).join(', ');
      const values = Object.keys(deposit).map((_, i) => `$${i + 1}`).join(', ');
      const placeholders = Object.values(deposit);
      
      const query = `
        INSERT INTO uni_farming_deposits (${columns})
        VALUES (${values})
        RETURNING *
      `;
      
      const result = await queryWithRetry(query, placeholders);
      if (result.rows.length === 0) {
        throw new Error('Не удалось создать депозит UNI фарминга');
      }
      
      return result.rows[0] as UniFarmingDeposit;
    } catch (error) {
      console.error('[StorageAdapter] Ошибка при создании депозита UNI фарминга:', error);
      throw error;
    }
  }

  async updateUniFarmingDeposit(id: number, data: Partial<UniFarmingDeposit>): Promise<UniFarmingDeposit | undefined> {
    console.log(`[StorageAdapter] Обновление депозита UNI фарминга с ID: ${id}`);
    try {
      const setClause = Object.keys(data)
        .map((key, index) => `${key} = $${index + 2}`)
        .join(', ');
      
      const query = `
        UPDATE uni_farming_deposits 
        SET ${setClause}
        WHERE id = $1
        RETURNING *
      `;
      
      const values = [id, ...Object.values(data)];
      const result = await queryWithRetry(query, values);
      
      if (result.rows.length === 0) {
        return undefined;
      }
      
      return result.rows[0] as UniFarmingDeposit;
    } catch (error) {
      console.error(`[StorageAdapter] Ошибка при обновлении депозита UNI фарминга ${id}:`, error);
      throw error;
    }
  }

  async getUserUniFarmingDeposits(userId: number): Promise<UniFarmingDeposit[]> {
    console.log(`[StorageAdapter] Получение депозитов UNI фарминга пользователя с ID: ${userId}`);
    try {
      const result = await queryWithRetry(
        'SELECT * FROM uni_farming_deposits WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      
      return result.rows as UniFarmingDeposit[];
    } catch (error) {
      console.error(`[StorageAdapter] Ошибка при получении депозитов UNI фарминга пользователя ${userId}:`, error);
      throw error;
    }
  }

  async getActiveUniFarmingDeposits(): Promise<UniFarmingDeposit[]> {
    console.log('[StorageAdapter] Получение активных депозитов UNI фарминга');
    try {
      const result = await queryWithRetry(
        'SELECT * FROM uni_farming_deposits WHERE is_active = true ORDER BY created_at DESC'
      );
      
      return result.rows as UniFarmingDeposit[];
    } catch (error) {
      console.error('[StorageAdapter] Ошибка при получении активных депозитов UNI фарминга:', error);
      throw error;
    }
  }

  // TON Boost
  async createTonBoostDeposit(deposit: InsertTonBoostDeposit): Promise<TonBoostDeposit> {
    console.log('[StorageAdapter] Создание депозита TON Boost');
    try {
      const columns = Object.keys(deposit).join(', ');
      const values = Object.keys(deposit).map((_, i) => `$${i + 1}`).join(', ');
      const placeholders = Object.values(deposit);
      
      const query = `
        INSERT INTO ton_boost_deposits (${columns})
        VALUES (${values})
        RETURNING *
      `;
      
      const result = await queryWithRetry(query, placeholders);
      if (result.rows.length === 0) {
        throw new Error('Не удалось создать депозит TON Boost');
      }
      
      return result.rows[0] as TonBoostDeposit;
    } catch (error) {
      console.error('[StorageAdapter] Ошибка при создании депозита TON Boost:', error);
      throw error;
    }
  }

  async updateTonBoostDeposit(id: number, data: Partial<TonBoostDeposit>): Promise<TonBoostDeposit | undefined> {
    console.log(`[StorageAdapter] Обновление депозита TON Boost с ID: ${id}`);
    try {
      const setClause = Object.keys(data)
        .map((key, index) => `${key} = $${index + 2}`)
        .join(', ');
      
      const query = `
        UPDATE ton_boost_deposits 
        SET ${setClause}
        WHERE id = $1
        RETURNING *
      `;
      
      const values = [id, ...Object.values(data)];
      const result = await queryWithRetry(query, values);
      
      if (result.rows.length === 0) {
        return undefined;
      }
      
      return result.rows[0] as TonBoostDeposit;
    } catch (error) {
      console.error(`[StorageAdapter] Ошибка при обновлении депозита TON Boost ${id}:`, error);
      throw error;
    }
  }

  async getUserTonBoostDeposits(userId: number): Promise<TonBoostDeposit[]> {
    console.log(`[StorageAdapter] Получение депозитов TON Boost пользователя с ID: ${userId}`);
    try {
      const result = await queryWithRetry(
        'SELECT * FROM ton_boost_deposits WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      
      return result.rows as TonBoostDeposit[];
    } catch (error) {
      console.error(`[StorageAdapter] Ошибка при получении депозитов TON Boost пользователя ${userId}:`, error);
      throw error;
    }
  }

  async getActiveTonBoostDeposits(): Promise<TonBoostDeposit[]> {
    console.log('[StorageAdapter] Получение активных депозитов TON Boost');
    try {
      const result = await queryWithRetry(
        'SELECT * FROM ton_boost_deposits WHERE is_active = true ORDER BY created_at DESC'
      );
      
      return result.rows as TonBoostDeposit[];
    } catch (error) {
      console.error('[StorageAdapter] Ошибка при получении активных депозитов TON Boost:', error);
      throw error;
    }
  }

  // Миссии
  async createUserMission(userMission: InsertUserMission): Promise<UserMission> {
    console.log('[StorageAdapter] Создание миссии пользователя');
    try {
      const columns = Object.keys(userMission).join(', ');
      const values = Object.keys(userMission).map((_, i) => `$${i + 1}`).join(', ');
      const placeholders = Object.values(userMission);
      
      const query = `
        INSERT INTO user_missions (${columns})
        VALUES (${values})
        RETURNING *
      `;
      
      const result = await queryWithRetry(query, placeholders);
      if (result.rows.length === 0) {
        throw new Error('Не удалось создать миссию пользователя');
      }
      
      return result.rows[0] as UserMission;
    } catch (error) {
      console.error('[StorageAdapter] Ошибка при создании миссии пользователя:', error);
      throw error;
    }
  }

  async getUserMissions(userId: number): Promise<UserMission[]> {
    console.log(`[StorageAdapter] Получение миссий пользователя с ID: ${userId}`);
    try {
      const result = await queryWithRetry(
        'SELECT * FROM user_missions WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      
      return result.rows as UserMission[];
    } catch (error) {
      console.error(`[StorageAdapter] Ошибка при получении миссий пользователя ${userId}:`, error);
      throw error;
    }
  }

  async hasUserCompletedMission(userId: number, missionId: number): Promise<boolean> {
    console.log(`[StorageAdapter] Проверка завершения миссии ${missionId} пользователем с ID: ${userId}`);
    try {
      const result = await queryWithRetry(
        'SELECT COUNT(*) as count FROM user_missions WHERE user_id = $1 AND mission_id = $2 AND is_completed = true',
        [userId, missionId]
      );
      
      return parseInt(result.rows[0].count, 10) > 0;
    } catch (error) {
      console.error(`[StorageAdapter] Ошибка при проверке завершения миссии ${missionId} пользователем ${userId}:`, error);
      throw error;
    }
  }

  // Обновление баланса пользователя
  async updateUserBalance(userId: number, currency: 'UNI' | 'TON', amount: string): Promise<User> {
    console.log(`[StorageAdapter] Обновление баланса ${currency} пользователя с ID: ${userId}, сумма: ${amount}`);
    try {
      const field = currency === 'UNI' ? 'uni_balance' : 'ton_balance';
      
      // Используем выражение для обновления баланса
      const query = `
        UPDATE users 
        SET ${field} = ${field} + $1
        WHERE id = $2
        RETURNING *
      `;
      
      const result = await queryWithRetry(query, [amount, userId]);
      
      if (result.rows.length === 0) {
        throw new Error(`Не удалось обновить баланс пользователя с ID: ${userId}`);
      }
      
      return result.rows[0] as User;
    } catch (error) {
      console.error(`[StorageAdapter] Ошибка при обновлении баланса ${currency} пользователя ${userId}:`, error);
      throw error;
    }
  }

  // Транзакционные операции
  async executeTransaction<T>(operations: (tx: any) => Promise<T>): Promise<T> {
    console.log('[StorageAdapter] Выполнение транзакции');
    
    // Если используем память, просто выполняем операции без транзакции
    if (this.useMemory) {
      return await operations(null);
    }
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const result = await operations(client);
      
      await client.query('COMMIT');
      
      return result;
    } catch (error) {
      console.error('[StorageAdapter] Ошибка при выполнении транзакции, откат:', error);
      
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('[StorageAdapter] Ошибка при откате транзакции:', rollbackError);
      }
      
      throw error;
    } finally {
      client.release();
    }
  }
}

// Экспортируем экземпляр адаптера для использования в приложении
export const storage = new StorageAdapter();