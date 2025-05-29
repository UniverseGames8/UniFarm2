/**
 * Сервис для работы с UNI фармингом - файл-посредник
 * 
 * Этот файл экспортирует функциональность из инстанс-ориентированной реализации
 * для обеспечения совместимости импортов и перенаправляет статические вызовы на инстанс.
 */

import {
  type FarmingUpdateResult,
  type CreateDepositResult,
  type FarmingInfo,
  type HarvestResult
} from './uniFarmingServiceInstance';

// Импортируем инстанс сервиса UNI фарминга из центрального экспорта
import { uniFarmingService } from './index';

// Реэкспортируем типы и интерфейсы
export type {
  FarmingUpdateResult,
  CreateDepositResult,
  FarmingInfo,
  HarvestResult
};

/**
 * Сервис для работы с UNI фармингом
 */
export class UniFarmingService {
  private static readonly DAILY_RATE = 0.005; // 0.5% в день
  private static readonly SECONDS_IN_DAY = 86400;
  private static readonly MIN_CHANGE_THRESHOLD = 0.000001; // Минимальный порог изменения для обновления баланса в БД

  /**
   * Начисляет доход пользователю от UNI фарминга на основе времени с последнего обновления
   * Доход начисляется напрямую на основной баланс пользователя в соответствии с ТЗ
   * @param userId ID пользователя
   * @returns Объект с обновленными данными или null, если фарминг не активен
   */
  static async calculateAndUpdateUserFarming(userId: number): Promise<FarmingUpdateResult | null> {
    return uniFarmingService.calculateAndUpdateUserFarming(userId);
  }

  /**
   * Создает UNI фарминг-депозит для пользователя
   * @param userId ID пользователя
   * @param amount Сумма депозита
   * @returns Объект с данными о созданном депозите
   */
  static async createUniFarmingDeposit(userId: number, amount: string): Promise<CreateDepositResult> {
    return uniFarmingService.createUniFarmingDeposit(userId, amount);
  }

  /**
   * Алиас для createUniFarmingDeposit для поддержки старого контроллера
   * @param userId ID пользователя
   * @param amount Сумма депозита
   * @returns Объект с данными о созданном депозите
   */
  static async depositFarming(userId: number, amount: string): Promise<CreateDepositResult> {
    return uniFarmingService.createUniFarmingDeposit(userId, amount);
  }

  /**
   * Получает данные о UNI фарминге пользователя
   * @param userId ID пользователя
   * @returns Объект с данными о фарминге
   */
  static async getUserFarmingInfo(userId: number): Promise<FarmingInfo> {
    return uniFarmingService.getUserFarmingInfo(userId);
  }

  /**
   * Рассчитывает скорость начисления UNI в секунду
   * @param depositAmount Сумма депозита
   * @returns Скорость начисления в секунду
   */
  static calculateRatePerSecond(depositAmount: string): string {
    return uniFarmingService.calculateRatePerSecond(depositAmount);
  }

  /**
   * Метод сохранен для обратной совместимости
   * В новой версии доход автоматически начисляется на основной баланс
   * @param userId ID пользователя 
   * @returns Информационное сообщение о том, что доход начисляется автоматически
   */
  static async harvestFarmingBalance(userId: number): Promise<HarvestResult> {
    return uniFarmingService.harvestFarmingBalance(userId);
  }

  /**
   * Алиас для harvestFarmingBalance для поддержки старого контроллера
   * @param userId ID пользователя 
   * @returns Информационное сообщение о том, что доход начисляется автоматически
   */
  static async harvestFarming(userId: number): Promise<HarvestResult> {
    return uniFarmingService.harvestFarmingBalance(userId);
  }

  /**
   * Получает список депозитов пользователя в UNI фарминге
   * @param userId ID пользователя
   * @returns Массив депозитов
   */
  static async getUserFarmingDeposits(userId: number): Promise<any[]> {
    // Используем метод из нового сервиса для обеспечения совместимости
    const { NewUniFarmingService } = await import('./newUniFarmingService');
    return NewUniFarmingService.getUserFarmingDeposits(userId);
  }

  // Метод migrateExistingDeposits удален, так как переход на новую схему полностью реализован в createUniFarmingDeposit
}