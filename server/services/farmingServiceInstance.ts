/**
 * Инстанс-ориентированная имплементация сервиса Farming
 * 
 * Этот файл содержит основную реализацию сервиса Farming,
 * который работает на базе конкретного инстанса
 */

import { db } from '../db';
import { farmingDeposits, type FarmingDeposit, type InsertFarmingDeposit } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Интерфейс сервиса для работы с фарминг-депозитами
 */
export interface IFarmingService {
  /**
   * Получает все активные фарминг-депозиты пользователя
   * @param userId ID пользователя
   * @returns Массив активных фарминг-депозитов
   */
  getUserFarmingDeposits(userId: number): Promise<FarmingDeposit[]>;

  /**
   * Создает новый фарминг-депозит
   * @param depositData Данные депозита
   * @returns Созданный депозит
   */
  createFarmingDeposit(depositData: InsertFarmingDeposit): Promise<FarmingDeposit>;

  /**
   * Обновляет последнее время получения наград
   * @param depositId ID депозита
   * @returns Обновленный депозит
   */
  updateLastClaim(depositId: number): Promise<FarmingDeposit | undefined>;

  /**
   * Применяет буст к депозиту
   * @param depositId ID депозита
   * @returns Обновленный депозит
   */
  applyBoost(depositId: number): Promise<FarmingDeposit | undefined>;
}

/**
 * Класс сервиса для работы с фарминг-депозитами
 * 
 * Реализует интерфейс IFarmingService используя инстанс-ориентированный подход
 */
class FarmingService implements IFarmingService {
  /**
   * Получает все активные фарминг-депозиты пользователя
   * @param userId ID пользователя
   * @returns Массив активных фарминг-депозитов
   */
  async getUserFarmingDeposits(userId: number): Promise<FarmingDeposit[]> {
    const deposits = await db
      .select()
      .from(farmingDeposits)
      .where(eq(farmingDeposits.user_id, userId))
      .orderBy(farmingDeposits.created_at);
    
    return deposits;
  }

  /**
   * Создает новый фарминг-депозит
   * @param depositData Данные депозита
   * @returns Созданный депозит
   */
  async createFarmingDeposit(depositData: InsertFarmingDeposit): Promise<FarmingDeposit> {
    const [deposit] = await db
      .insert(farmingDeposits)
      .values(depositData)
      .returning();
    
    return deposit;
  }

  /**
   * Обновляет последнее время получения наград
   * @param depositId ID депозита
   * @returns Обновленный депозит
   */
  async updateLastClaim(depositId: number): Promise<FarmingDeposit | undefined> {
    const [updatedDeposit] = await db
      .update(farmingDeposits)
      .set({ last_claim: new Date() })
      .where(eq(farmingDeposits.id, depositId))
      .returning();
    
    return updatedDeposit;
  }

  /**
   * Применяет буст к депозиту
   * @param depositId ID депозита
   * @returns Обновленный депозит
   */
  async applyBoost(depositId: number): Promise<FarmingDeposit | undefined> {
    const [boostedDeposit] = await db
      .update(farmingDeposits)
      .set({ is_boosted: true })
      .where(eq(farmingDeposits.id, depositId))
      .returning();
    
    return boostedDeposit;
  }
}

/**
 * Создаем единственный экземпляр сервиса
 */
export const farmingServiceInstance = new FarmingService();

/**
 * Фабрика для создания сервиса фарминга
 */
export function createFarmingService(): IFarmingService {
  return farmingServiceInstance;
}