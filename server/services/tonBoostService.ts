/**
 * ВНИМАНИЕ: Используйте импорт из services/index.ts вместо прямого импорта
 * 
 * Этот файл является прокси-оберткой для обратной совместимости.
 * Для новых разработок используйте инстанс tonBoostService из services/index.ts
 */
import { tonBoostServiceInstance } from './tonBoostServiceInstance';
// Import type from shared schema
import { TonBoostDeposit } from '@shared/schema';

// Определяем перечисления локально для обратной совместимости
export enum TonBoostPaymentMethod {
  INTERNAL_BALANCE = "internal_balance",
  EXTERNAL_WALLET = "external_wallet"
}

export enum TonBoostExternalPaymentStatus {
  PENDING = "pending",
  PAID = "paid",
  CANCELLED = "cancelled",
  EXPIRED = "expired"
}

// Интерфейсы для типов данных
export interface TonBoostPackage {
  id: number;
  name: string;
  priceTon: string;
  bonusUni: string;
  rateTon: string;
  rateUni: string;
}

export interface PurchaseTonBoostResult {
  success: boolean;
  message: string;
  boostPackage?: TonBoostPackage;
  depositId?: number;
  paymentMethod?: TonBoostPaymentMethod;
  paymentStatus?: TonBoostExternalPaymentStatus;
  paymentLink?: string;
  purchaseTransaction?: any;
  bonusTransaction?: any;
  transactionId?: number;
}

export interface TonFarmingUpdateResult {
  success: boolean;
  userId: number;
  earnedTon: string;
  earnedUni: string;
  lastUpdateTimestamp: number;
}

export interface TonFarmingInfo {
  totalTonRatePerSecond: string;
  totalUniRatePerSecond: string;
  dailyIncomeTon: string;
  dailyIncomeUni: string;
  deposits: TonBoostDeposit[];
}

// Определяем интерфейс для совместимости
export interface ITonBoostService {
  getBoostPackages(): TonBoostPackage[];
  getBoostPackageById(boostId: number): TonBoostPackage | undefined;
  getUserActiveBoosts(userId: number): Promise<TonBoostDeposit[]>;
  createTonBoostDeposit(depositData: any): Promise<TonBoostDeposit>;
  calculateRatesPerSecond(amount: string, rateTonPerDay: string, rateUniPerDay: string): { 
    tonRatePerSecond: string, 
    uniRatePerSecond: string 
  };
  purchaseTonBoost(
    userId: number, 
    boostId: number, 
    paymentMethod?: TonBoostPaymentMethod
  ): Promise<PurchaseTonBoostResult>;
  calculateAndUpdateUserTonFarming(userId: number): Promise<TonFarmingUpdateResult>;
  getUserTonFarmingInfo(userId: number): Promise<TonFarmingInfo>;
  harvestTonFarming(userId: number): Promise<{ 
    success: boolean; 
    message: string; 
    harvestedTon: string; 
    transactionId?: number; 
  }>;
}

// Типы и енумы уже определены локально

/**
 * @deprecated Используйте инстанс tonBoostService из services/index.ts вместо статических методов
 */
export class TonBoostService {
  /**
   * Получает список всех доступных буст-пакетов
   */
  static getBoostPackages(): TonBoostPackage[] {
    return tonBoostServiceInstance.getBoostPackages();
  }

  /**
   * Получает буст-пакет по ID
   */
  static getBoostPackageById(boostId: number): TonBoostPackage | undefined {
    return tonBoostServiceInstance.getBoostPackageById(boostId);
  }

  /**
   * Получает все активные TON Boost-депозиты пользователя
   */
  static async getUserActiveBoosts(userId: number): Promise<TonBoostDeposit[]> {
    return tonBoostServiceInstance.getUserActiveBoosts(userId);
  }

  /**
   * Создает запись о TON Boost-депозите
   */
  static async createTonBoostDeposit(depositData: any): Promise<TonBoostDeposit> {
    return tonBoostServiceInstance.createTonBoostDeposit(depositData);
  }

  /**
   * Рассчитывает скорость начисления TON и UNI в секунду
   */
  static calculateRatesPerSecond(amount: string, rateTonPerDay: string, rateUniPerDay: string): { 
    tonRatePerSecond: string, 
    uniRatePerSecond: string 
  } {
    return tonBoostServiceInstance.calculateRatesPerSecond(amount, rateTonPerDay, rateUniPerDay);
  }

  /**
   * Покупает TON буст-пакет для пользователя
   */
  static async purchaseTonBoost(
    userId: number, 
    boostId: number, 
    paymentMethod?: TonBoostPaymentMethod
  ): Promise<PurchaseTonBoostResult> {
    return tonBoostServiceInstance.purchaseTonBoost(userId, boostId, paymentMethod);
  }

  /**
   * Рассчитывает и обновляет баланс фарминга TON для пользователя
   */
  static async calculateAndUpdateUserTonFarming(userId: number): Promise<TonFarmingUpdateResult> {
    return tonBoostServiceInstance.calculateAndUpdateUserTonFarming(userId);
  }
  
  /**
   * Запускает обновление TON фарминга для всех пользователей с активными депозитами
   */
  static async updateAllUsersTonFarming(): Promise<{
    success: boolean;
    usersUpdated: number;
    errors: number;
  }> {
    return tonBoostServiceInstance.updateAllUsersTonFarming();
  }

  /**
   * Получает информацию о TON фарминге пользователя
   */
  static async getUserTonFarmingInfo(userId: number): Promise<TonFarmingInfo> {
    return tonBoostServiceInstance.getUserTonFarmingInfo(userId);
  }

  /**
   * Выводит накопленные TON с фарминга на баланс пользователя
   */
  static async harvestTonFarming(userId: number): Promise<{ 
    success: boolean; 
    message: string; 
    harvestedTon: string; 
    transactionId?: number; 
  }> {
    return tonBoostServiceInstance.harvestTonFarming(userId);
  }
}