import { db } from '../db';
import { users, transactions } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import { DatabaseError, NotFoundError } from '../middleware/errorHandler';

/**
 * Информация о streak-статусе пользователя
 */
export interface StreakInfo {
  streak: number;
  canClaim: boolean;
  lastClaimDate: Date | null;
}

/**
 * Ответ на запрос получения статуса бонуса
 */
export interface DailyBonusStatusResponse {
  canClaim: boolean;
  streak: number;
  bonusAmount: number;
}

/**
 * Результат получения ежедневного бонуса
 */
export interface DailyBonusClaimResponse {
  success: boolean;
  message: string;
  amount?: number;
  streak?: number;
}

/**
 * Интерфейс сервиса ежедневных бонусов
 */
export interface IDailyBonusService {
  getUserStreakInfo(userId: number): Promise<StreakInfo>;
  getDailyBonusStatus(userId: number): Promise<DailyBonusStatusResponse>;
  claimDailyBonus(userId: number): Promise<DailyBonusClaimResponse>;
}

/**
 * Сервис для работы с ежедневными бонусами (check-in)
 * Отвечает за всю бизнес-логику, связанную с ежедневными бонусами
 */
class DailyBonusServiceImpl implements IDailyBonusService {
  // Размер ежедневного бонуса 
  private readonly DAILY_BONUS_AMOUNT = 500;
  
  /**
   * Получает текущую информацию о streak-бонусе пользователя
   * @param userId ID пользователя
   * @returns Информация о streak-статусе пользователя
   * @throws NotFoundError если пользователь не найден
   * @throws DatabaseError в случае ошибки БД
   */
  async getUserStreakInfo(userId: number): Promise<StreakInfo> {
    try {
      const [user] = await db
        .select({
          checkin_last_date: users.checkin_last_date,
          checkin_streak: users.checkin_streak
        })
        .from(users)
        .where(eq(users.id, userId));
      
      if (!user) {
        // Вместо ошибки возвращаем дефолтные значения для нового пользователя
        console.log(`[DailyBonusService] Пользователь ID ${userId} не найден, возвращаем дефолтные значения`);
        return {
          streak: 0,
          canClaim: true, // Новый пользователь может получить бонус
          lastClaimDate: null
        };
      }
      
      // Безопасная обработка NULL значений
      const streakCount = user.checkin_streak ?? 0;
      const lastClaimDate = user.checkin_last_date ?? null;
      
      return {
        streak: streakCount,
        canClaim: this.canClaimToday(lastClaimDate),
        lastClaimDate: lastClaimDate
      };
    } catch (error) {
      // При любой ошибке возвращаем безопасные дефолтные значения
      console.error('[DailyBonusService] Ошибка при получении streak-информации:', error);
      return {
        streak: 0,
        canClaim: true,
        lastClaimDate: null
      };
    }
  }
  
  /**
   * Проверяет, может ли пользователь получить бонус сегодня
   * @param lastClaimDate Дата последнего получения бонуса
   * @returns true, если бонус можно получить сегодня
   */
  private canClaimToday(lastClaimDate: Date | null): boolean {
    // Если пользователь никогда не получал бонус
    if (!lastClaimDate) {
      return true;
    }
    
    const now = new Date();
    
    // Проверяем, был ли чекин уже сегодня
    const isSameDay = 
      lastClaimDate.getDate() === now.getDate() && 
      lastClaimDate.getMonth() === now.getMonth() &&
      lastClaimDate.getFullYear() === now.getFullYear();
    
    return !isSameDay;
  }
  
  /**
   * Проверяет, доступен ли пользователю ежедневный бонус
   * @param userId ID пользователя
   * @returns Статус получения бонуса и текущая серия
   * @throws NotFoundError если пользователь не найден
   * @throws DatabaseError в случае ошибки БД
   */
  async getDailyBonusStatus(userId: number): Promise<DailyBonusStatusResponse> {
    const streakInfo = await this.getUserStreakInfo(userId);
    
    return {
      canClaim: streakInfo.canClaim,
      streak: streakInfo.streak,
      bonusAmount: this.DAILY_BONUS_AMOUNT
    };
  }
  
  /**
   * Обновляет streak-статус пользователя и записывает транзакцию в рамках БД-транзакции
   * @param userId ID пользователя
   * @param currentStreak Текущее значение streak
   * @param tx Транзакция БД
   * @throws DatabaseError в случае ошибки БД
   */
  private async updateUserStreakAndBalance(
    userId: number, 
    currentStreak: number, 
    tx: any
  ): Promise<void> {
    try {
      // Обновляем баланс и streak-статус пользователя
      await tx
        .update(users)
        .set({ 
          balance_uni: sql`${users.balance_uni} + ${this.DAILY_BONUS_AMOUNT}`,
          checkin_last_date: new Date(),
          checkin_streak: currentStreak + 1
        })
        .where(eq(users.id, userId));
    } catch (error) {
      throw new DatabaseError('Ошибка при обновлении баланса пользователя', error);
    }
  }
  
  /**
   * Создает запись о транзакции получения бонуса
   * @param userId ID пользователя
   * @param tx Транзакция БД
   * @throws DatabaseError в случае ошибки БД
   */
  private async createBonusTransaction(
    userId: number, 
    tx: any
  ): Promise<void> {
    try {
      await tx
        .insert(transactions)
        .values({
          user_id: userId,
          type: 'check-in',
          currency: 'UNI',
          amount: this.DAILY_BONUS_AMOUNT.toString(),
          status: 'confirmed',
          description: 'Ежедневный бонус за check-in',
          category: 'bonus',
          source: 'daily-bonus'
        });
    } catch (error) {
      throw new DatabaseError('Ошибка при создании записи о бонусной транзакции', error);
    }
  }
  
  /**
   * Выдает пользователю ежедневный бонус
   * @param userId ID пользователя
   * @returns Результат операции получения бонуса
   * @throws NotFoundError если пользователь не найден
   * @throws DatabaseError в случае ошибки БД
   */
  async claimDailyBonus(userId: number): Promise<DailyBonusClaimResponse> {
    try {
      // Получаем информацию о streak-статусе
      const streakInfo = await this.getUserStreakInfo(userId);
      
      // Проверяем, можно ли получить бонус сегодня
      if (!streakInfo.canClaim) {
        return { 
          success: false, 
          message: 'Вы уже получили бонус сегодня. Возвращайтесь завтра!' 
        };
      }
      
      // Выполняем все действия в рамках транзакции
      return await db.transaction(async (tx) => {
        // 1. Обновляем баланс и streak-статус пользователя
        await this.updateUserStreakAndBalance(userId, streakInfo.streak, tx);
        
        // 2. Создаем запись о транзакции бонуса
        await this.createBonusTransaction(userId, tx);
        
        // 3. Возвращаем успешный результат
        return { 
          success: true, 
          message: 'Ежедневный бонус успешно получен!',
          amount: this.DAILY_BONUS_AMOUNT,
          streak: streakInfo.streak + 1
        };
      });
    } catch (error) {
      // Пробрасываем специфические ошибки для обработки в контроллере
      if (error instanceof NotFoundError || error instanceof DatabaseError) {
        throw error;
      }
      
      // Логируем неожиданные ошибки и преобразуем в DatabaseError
      console.error('Неизвестная ошибка при получении бонуса:', error);
      throw new DatabaseError('Произошла ошибка при получении бонуса', error);
    }
  }
}

/**
 * Создает и возвращает экземпляр сервиса ежедневных бонусов
 * @returns Экземпляр сервиса ежедневных бонусов
 */
export function createDailyBonusService(): IDailyBonusService {
  return new DailyBonusServiceImpl();
}

// Создаем единственный экземпляр сервиса
export const dailyBonusServiceInstance = createDailyBonusService();