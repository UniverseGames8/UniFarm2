/**
 * Сервис для работы с множественными UNI фарминг-депозитами - файл-посредник
 * 
 * Этот файл экспортирует функциональность из инстанс-ориентированной реализации
 * для обеспечения совместимости импортов и перенаправляет статические вызовы на инстанс.
 */

import { newUniFarmingService } from './index';
import { 
  INewUniFarmingService
} from './newUniFarmingServiceInstance';

// Define the types here to avoid circular imports
export interface MultiFarmingUpdateResult {
  totalDepositAmount: string;
  totalRatePerSecond: string;
  earnedThisUpdate: string;
  depositCount: number;
}

export interface CreateMultiDepositResult {
  success: boolean;
  message: string;
  depositId?: number;
  depositAmount?: string;
  ratePerSecond?: string;
  newBalance?: string; // Новый баланс пользователя после операции
}

export interface MultiFarmingInfo {
  isActive: boolean;
  totalDepositAmount: string;
  depositCount: number;
  totalRatePerSecond: string;
  dailyIncomeUni: string;
  deposits: any[];
}

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

export enum TransactionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum Currency {
  TON = 'TON',
  UNI = 'UNI'
}

/**
 * Сервис для работы с множественными UNI фарминг-депозитами
 */
export class NewUniFarmingService {
  /**
   * Начисляет доход пользователю от UNI фарминга на основе всех активных депозитов
   * @param userId ID пользователя
   * @returns Объект с обновленными данными
   */
  static async calculateAndUpdateUserFarming(userId: number): Promise<MultiFarmingUpdateResult> {
    return newUniFarmingService.calculateAndUpdateUserFarming(userId);
  }

  /**
   * Создает новый UNI фарминг-депозит
   * @param userId ID пользователя
   * @param amount Сумма депозита
   * @returns Объект с данными о созданном депозите
   */
  static async createUniFarmingDeposit(userId: number, amount: string): Promise<CreateMultiDepositResult> {
    return newUniFarmingService.createUniFarmingDeposit(userId, amount);
  }

  /**
   * Получает все активные депозиты пользователя
   * @param userId ID пользователя
   * @returns Массив активных депозитов
   */
  static async getUserFarmingDeposits(userId: number): Promise<any[]> {
    return newUniFarmingService.getUserFarmingDeposits(userId);
  }

  /**
   * Получает данные о всех фарминг-депозитах пользователя и общую статистику
   * @param userId ID пользователя
   * @returns Объект с данными о фарминге
   */
  static async getUserFarmingInfo(userId: number): Promise<MultiFarmingInfo> {
    return newUniFarmingService.getUserFarmingInfo(userId);
  }
}

// No need to re-export these types as they're already exported above