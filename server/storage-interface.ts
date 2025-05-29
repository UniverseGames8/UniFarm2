/**
 * Интерфейс хранилища данных
 * 
 * Определяет контракт для всех реализаций хранилища данных в приложении.
 * Это позволяет легко менять реализацию хранилища (БД, память, Mock), 
 * не изменяя основной код приложения.
 */

import {
  User,
  InsertUser,
  Transaction,
  InsertTransaction,
  Referral,
  InsertReferral,
  FarmingDeposit,
  InsertFarmingDeposit,
  UniFarmingDeposit,
  InsertUniFarmingDeposit,
  TonBoostDeposit,
  InsertTonBoostDeposit,
  UserMission,
  InsertUserMission
} from "@shared/schema";

/**
 * Базовый интерфейс операций хранилища
 */
export interface IStorage {
  // Пользователи
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByGuestId(guestId: string): Promise<User | undefined>;
  getUserByRefCode(refCode: string): Promise<User | undefined>;
  getUserByTelegramId(telegramId: number): Promise<User | undefined>;
  createUser(insertUser: InsertUser): Promise<User>;
  updateUser(userId: number, userData: Partial<User>): Promise<User>;
  updateUserRefCode(userId: number, refCode: string): Promise<User | undefined>;
  
  // Реферальная система
  generateRefCode(): string;
  generateUniqueRefCode(): Promise<string>;
  isRefCodeUnique(refCode: string): Promise<boolean>;
}

/**
 * Расширенный интерфейс с поддержкой всех сущностей
 */
export interface IExtendedStorage extends IStorage {
  // Транзакции
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getUserTransactions(userId: number, limit?: number, offset?: number): Promise<{transactions: Transaction[], total: number}>;
  
  // Рефералы
  createReferral(referral: InsertReferral): Promise<Referral>;
  getUserReferrals(userId: number): Promise<{referrals: User[], total: number}>;
  getReferralByUserIdAndInviterId(userId: number, inviterId: number): Promise<Referral | undefined>;
  
  // Депозиты
  createFarmingDeposit(deposit: InsertFarmingDeposit): Promise<FarmingDeposit>;
  getUserFarmingDeposits(userId: number): Promise<FarmingDeposit[]>;
  
  // UNI Фарминг
  createUniFarmingDeposit(deposit: InsertUniFarmingDeposit): Promise<UniFarmingDeposit>;
  updateUniFarmingDeposit(id: number, data: Partial<UniFarmingDeposit>): Promise<UniFarmingDeposit | undefined>;
  getUserUniFarmingDeposits(userId: number): Promise<UniFarmingDeposit[]>;
  getActiveUniFarmingDeposits(): Promise<UniFarmingDeposit[]>;
  
  // TON Boost
  createTonBoostDeposit(deposit: InsertTonBoostDeposit): Promise<TonBoostDeposit>;
  updateTonBoostDeposit(id: number, data: Partial<TonBoostDeposit>): Promise<TonBoostDeposit | undefined>;
  getUserTonBoostDeposits(userId: number): Promise<TonBoostDeposit[]>;
  getActiveTonBoostDeposits(): Promise<TonBoostDeposit[]>;
  
  // Миссии
  createUserMission(userMission: InsertUserMission): Promise<UserMission>;
  getUserMissions(userId: number): Promise<UserMission[]>;
  hasUserCompletedMission(userId: number, missionId: number): Promise<boolean>;
  
  // Обновление баланса пользователя
  updateUserBalance(userId: number, currency: 'UNI' | 'TON', amount: string): Promise<User>;
  
  // Транзакционные операции
  executeTransaction<T>(operations: (tx: any) => Promise<T>): Promise<T>;
}

/**
 * Типы ошибок хранилища
 */
export enum StorageErrorType {
  NOT_FOUND = 'NOT_FOUND',
  DUPLICATE = 'DUPLICATE',
  VALIDATION = 'VALIDATION',
  DATABASE = 'DATABASE',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Информация об ошибке хранилища
 */
export interface StorageError extends Error {
  type: StorageErrorType;
  code?: string;
  details?: Record<string, any>;
}

/**
 * Фабрика для создания типизированных ошибок хранилища
 */
export class StorageErrors {
  static notFound(entity: string, query?: Record<string, any>): StorageError {
    const error = new Error(`${entity} not found`) as StorageError;
    error.type = StorageErrorType.NOT_FOUND;
    error.details = { entity, query };
    return error;
  }
  
  static duplicate(entity: string, field: string, value: any): StorageError {
    const error = new Error(`${entity} with ${field}=${value} already exists`) as StorageError;
    error.type = StorageErrorType.DUPLICATE;
    error.details = { entity, field, value };
    return error;
  }
  
  static validation(message: string, details?: Record<string, any>): StorageError {
    const error = new Error(message) as StorageError;
    error.type = StorageErrorType.VALIDATION;
    error.details = details;
    return error;
  }
  
  static database(message: string, originalError?: Error): StorageError {
    const error = new Error(message) as StorageError;
    error.type = StorageErrorType.DATABASE;
    error.details = { originalError: originalError?.message };
    return error;
  }
}

/**
 * Тип для опций запроса
 */
export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  filters?: Record<string, any>;
}

/**
 * Тип состояния хранилища
 */
export interface StorageState {
  provider: 'database' | 'memory';
  isReady: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'error';
  lastError?: Error;
  stats?: {
    operations: number;
    errors: number;
    reconnects: number;
  };
}

/**
 * Интерфейс для управления хранилищем
 */
export interface IStorageManager {
  getState(): StorageState;
  switchToDatabase(): Promise<boolean>;
  switchToMemory(): Promise<void>;
  reconnect(): Promise<boolean>;
}