/**
 * Сервис для работы с фарминг-депозитами - файл-посредник
 * 
 * Этот файл экспортирует функциональность из инстанс-ориентированной реализации
 * для обеспечения совместимости импортов и перенаправляет статические вызовы на инстанс.
 */

import { type FarmingDeposit, type InsertFarmingDeposit } from '@shared/schema';

// Импортируем инстанс сервиса фарминга из центрального экспорта
import { farmingService } from './index';

/**
 * Сервис для работы с фарминг-депозитами
 */
export class FarmingService {
  /**
   * Получает все активные фарминг-депозиты пользователя
   * @param userId ID пользователя
   * @returns Массив активных фарминг-депозитов
   */
  static async getUserFarmingDeposits(userId: number): Promise<FarmingDeposit[]> {
    return farmingService.getUserFarmingDeposits(userId);
  }

  /**
   * Создает новый фарминг-депозит
   * @param depositData Данные депозита
   * @returns Созданный депозит
   */
  static async createFarmingDeposit(depositData: InsertFarmingDeposit): Promise<FarmingDeposit> {
    return farmingService.createFarmingDeposit(depositData);
  }

  /**
   * Обновляет последнее время получения наград
   * @param depositId ID депозита
   * @returns Обновленный депозит
   */
  static async updateLastClaim(depositId: number): Promise<FarmingDeposit | undefined> {
    return farmingService.updateLastClaim(depositId);
  }

  /**
   * Применяет буст к депозиту
   * @param depositId ID депозита
   * @returns Обновленный депозит
   */
  static async applyBoost(depositId: number): Promise<FarmingDeposit | undefined> {
    return farmingService.applyBoost(depositId);
  }
}