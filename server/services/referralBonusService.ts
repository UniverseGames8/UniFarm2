import { db } from '../db';
import { ReferralService } from './referralService';
import { userService } from './index'; // Используем инстанс из централизованного экспорта
import { TransactionType, Currency, TransactionStatus } from './transactionService'; // Импортируем типы из нового файла
import { eq } from 'drizzle-orm';
import { users, referrals, transactions, insertTransactionSchema } from '@shared/schema';
import { z } from 'zod';

/**
 * Сервис для обработки реферальных вознаграждений
 * Поддерживает начисления:
 * 1. От фарминга (доход от дохода - processFarmingReferralReward)
 */
export class ReferralBonusService {
  // Минимальный порог для начисления реферального вознаграждения отключен (в маркетинге важна каждая транзакция)
  private static readonly MIN_REWARD_THRESHOLD = 0.0;
  // Максимальное количество уровней в партнерской программе
  static readonly MAX_LEVELS = 20;
  
  // Проценты для вознаграждений на каждом уровне (в %)
  static readonly LEVEL_PERCENTS: number[] = [
    100, // Уровень 1
    2,   // Уровень 2
    3,   // Уровень 3
    4,   // Уровень 4
    5,   // Уровень 5
    6,   // Уровень 6
    7,   // Уровень 7
    8,   // Уровень 8
    9,   // Уровень 9
    10,  // Уровень 10
    11,  // Уровень 11
    12,  // Уровень 12
    13,  // Уровень 13
    14,  // Уровень 14
    15,  // Уровень 15
    16,  // Уровень 16
    17,  // Уровень 17
    18,  // Уровень 18
    19,  // Уровень 19
    20   // Уровень 20
  ];
  
  /**
   * Создаёт реферальную цепочку до 20 уровней на основе приглашающего
   * В рамках ТЗ (Этап 3.1) реализует однократную и необратимую привязку
   * 
   * @param userId ID пользователя
   * @param inviterId ID приглашающего пользователя
   * @returns Объект с информацией о результате операции
   */
  static async createReferralChain(userId: number, inviterId: number): Promise<{
    success: boolean;
    isNewConnection: boolean;
    message: string;
  }> {
    try {
      // Проверка существования пользователей
      const user = await userService.getUserById(userId);
      const inviter = await userService.getUserById(inviterId);
      
      if (!user || !inviter) {
        console.error('[ReferralBonusService] User or inviter not found:', { userId, inviterId });
        return {
          success: false,
          isNewConnection: false,
          message: 'Пользователь или пригласитель не найден'
        };
      }
      
      // Записываем первый уровень - прямое приглашение
      // Используем новый интерфейс метода createReferralRelationship, который реализует требования ТЗ 3.1
      const result = await ReferralService.createReferralRelationship(userId, inviterId, 1);
      
      // Если связь не была создана (уже существовала), выходим сразу
      if (!result.isNewConnection) {
        console.log(`[ReferralBonusService] User ${userId} already has a referral chain, operation skipped`);
        return {
          success: result.success,
          isNewConnection: false,
          message: 'Пользователь уже имеет реферальную связь'
        };
      }
      
      // Получаем все вышестоящие уровни для пригласителя
      const inviterReferrals = await db
        .select()
        .from(referrals)
        .where(eq(referrals.user_id, inviterId))
        .orderBy(referrals.level);
      
      // Создаем последующие уровни (до MAX_LEVELS)
      for (const ref of inviterReferrals) {
        // Проверяем, что уровень определен и не превышаем MAX_LEVELS
        if (ref.level !== null && ref.level >= this.MAX_LEVELS) {
          break;
        }
        
        // Определяем уровень для новой связи
        const newLevel = ref.level !== null ? ref.level + 1 : 1;
        
        try {
          // Записываем новый уровень, используя низкоуровневый createReferral (без проверки на существующую связь)
          // поскольку проверка на первом уровне уже выполнена и мы строим полную цепочку
          await ReferralService.createReferral({
            user_id: userId,
            inviter_id: ref.inviter_id,
            level: newLevel
          });
          
          console.log(`[ReferralBonusService] Создана связь уровня ${newLevel}: пользователь ${userId} → пригласитель ${ref.inviter_id}`);
        } catch (error) {
          // Возможна ошибка нарушения уникальности, если связь уже существует
          console.error(`[ReferralBonusService] Ошибка при создании связи уровня ${newLevel}: ${error}`);
          // Продолжаем для остальных уровней
        }
      }
      
      console.log(`[ReferralBonusService] Complete referral chain created for user ${userId} with inviter ${inviterId}`);
      return {
        success: true,
        isNewConnection: true,
        message: 'Реферальная цепочка успешно создана'
      };
    } catch (error) {
      console.error('[ReferralBonusService] Error creating referral chain:', error);
      return {
        success: false,
        isNewConnection: false,
        message: `Ошибка при создании реферальной цепочки: ${error}`
      };
    }
  }
  
  /**
   * Начисляет реферальное вознаграждение при пополнении баланса
   * @param userId ID пользователя, который совершил пополнение
   * @param amount Сумма пополнения
   * @param currency Валюта (UNI/TON)
   */
  /**
   * Начисляет реферальное вознаграждение от фарминга (доход от дохода)
   * @param userId ID пользователя, который получил фарминг-доход
   * @param earnedAmount Сумма заработка от фарминга
   * @param currency Валюта (UNI/TON)
   * @returns Объект с информацией о начисленных бонусах
   */
  static async processFarmingReferralReward(userId: number, earnedAmount: number, currency: Currency): Promise<{totalRewardsDistributed: number}> {
    try {
      // Общая сумма распределенных бонусов
      let totalRewardsDistributed = 0;
      
      // Если сумма слишком мала, не выполняем расчеты
      if (earnedAmount < this.MIN_REWARD_THRESHOLD) {
        return {totalRewardsDistributed: 0};
      }
      
      // Получаем всех пригласителей пользователя
      const userReferrals = await db
        .select()
        .from(referrals)
        .where(eq(referrals.user_id, userId))
        .orderBy(referrals.level);
      
      // Если нет реферальных связей, выходим
      if (userReferrals.length === 0) {
        return {totalRewardsDistributed: 0};
      }
      
      // Для каждого уровня начисляем вознаграждение
      for (const ref of userReferrals) {
        // Проверяем, что уровень определен
        if (ref.level === null) {
          continue;
        }
        
        const level = ref.level;
        
        // Проверяем, что уровень в пределах допустимых
        if (level <= 0 || level > this.MAX_LEVELS) {
          continue;
        }
        
        // Получаем процент для данного уровня
        const percent = this.LEVEL_PERCENTS[level - 1];
        
        // Вычисляем сумму вознаграждения
        const bonusAmount = earnedAmount * (percent / 100);
        
        // Пропускаем микро-начисления
        if (bonusAmount < this.MIN_REWARD_THRESHOLD) {
          continue;
        }
        
        // Начисляем вознаграждение пригласителю
        if (bonusAmount > 0 && ref.inviter_id !== null) {
          // Получаем пользователя-приглашателя
          const inviter = await userService.getUserById(ref.inviter_id);
          if (!inviter) {
            continue;
          }
          
          // Проверяем значения баланса и обрабатываем null значения
          const uniBalance = inviter.balance_uni !== null ? inviter.balance_uni : "0";
          const tonBalance = inviter.balance_ton !== null ? inviter.balance_ton : "0";
          
          // Увеличиваем баланс пользователя (вместо объекта используем новый метод с типом валюты)
          await userService.updateUserBalance(
            ref.inviter_id, 
            currency === Currency.UNI ? 'uni' : 'ton', 
            bonusAmount.toString()
          );
          
          // Создаем и валидируем данные транзакции через схему
          const transactionData = insertTransactionSchema.parse({
            user_id: ref.inviter_id,
            type: TransactionType.REFERRAL_BONUS,
            amount: bonusAmount.toString(),
            currency: currency,
            status: TransactionStatus.CONFIRMED,
            source: "Referral Income",
            description: `Referral reward from level ${level} farming`,
            source_user_id: userId, // ID реферала, чьи доходы стали источником
            category: "bonus"
          });
          
          // Вставляем данные в таблицу транзакций
          await db
            .insert(transactions)
            .values(transactionData);
          
          // Суммируем начисленные бонусы
          totalRewardsDistributed += bonusAmount;
          
          console.log(
            `[Farming ReferralBonus] Level ${level} (${percent}%) | Amount: ${bonusAmount.toFixed(8)} ${currency} | ` +
            `From: ${userId} | To: ${ref.inviter_id} | Processed`
          );
        }
      }
      
      return {totalRewardsDistributed};
    } catch (error) {
      console.error('[ReferralBonusService] Error processing farming referral reward:', error);
      return {totalRewardsDistributed: 0};
    }
  }
}