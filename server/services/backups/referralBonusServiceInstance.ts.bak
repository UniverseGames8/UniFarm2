import { db } from '../db';
import { eq } from 'drizzle-orm';
import { 
  users, 
  referrals, 
  transactions, 
  reward_distribution_logs,
  insertTransactionSchema,
  insertRewardDistributionLogSchema
} from '@shared/schema';
import { z } from 'zod';
import { IReferralService } from '.';
import { IUserService } from '.';
import { TransactionType, Currency, TransactionStatus } from './transactionService';
import crypto from 'crypto';
import { referralBonusProcessor } from './referralBonusProcessor';

// Интерфейс для сервиса реферальных бонусов
export interface IReferralBonusService {
  // Константы
  readonly MAX_LEVELS: number;
  readonly LEVEL_PERCENTS: number[];
  
  /**
   * Создаёт реферальную цепочку до 20 уровней на основе приглашающего
   * @param userId ID пользователя
   * @param inviterId ID приглашающего пользователя
   * @returns Объект с информацией о результате операции
   */
  createReferralChain(userId: number, inviterId: number): Promise<{
    success: boolean;
    isNewConnection: boolean;
    message: string;
  }>;

  /**
   * Начисляет реферальное вознаграждение от фарминга (доход от дохода)
   * Выполняется синхронно с транзакционной поддержкой
   * @param userId ID пользователя, который получил фарминг-доход
   * @param earnedAmount Сумма заработка от фарминга
   * @param currency Валюта (UNI/TON)
   * @returns Объект с информацией о начисленных бонусах
   * @deprecated Используйте queueFarmingReferralReward для асинхронной обработки больших объемов
   */
  processFarmingReferralReward(userId: number, earnedAmount: number, currency: Currency): Promise<{
    totalRewardsDistributed: number
  }>;
  
  /**
   * Начисляет реферальное вознаграждение от покупки буст-пакета
   * @param userId ID пользователя, который купил буст
   * @param boostId ID буст-пакета
   * @param amount Сумма покупки
   * @param currency Валюта (UNI/TON)
   * @returns Объект с информацией о начисленных бонусах
   */
  processBoostReferralReward(userId: number, boostId: number, amount: number, currency: Currency): Promise<{
    totalRewardsDistributed: number
  }>;

  /**
   * Помещает реферальное вознаграждение в очередь на асинхронную обработку
   * Оптимизировано для больших реферальных сетей
   * @param userId ID пользователя, который получил фарминг-доход
   * @param earnedAmount Сумма заработка от фарминга
   * @param currency Валюта (UNI/TON)
   * @returns Идентификатор пакета для отслеживания
   */
  queueFarmingReferralReward(userId: number, earnedAmount: number, currency: Currency): Promise<string>;
  
  /**
   * Обрабатывает бонус за регистрацию по реферальному коду
   * @param userId ID зарегистрированного пользователя
   * @param refCode Реферальный код, по которому была совершена регистрация
   * @returns Результат обработки бонуса
   */
  processRegistrationBonus(userId: number, refCode: string | null): Promise<boolean>;
}

/**
 * Сервис для обработки реферальных вознаграждений
 * Поддерживает начисления:
 * 1. От фарминга (доход от дохода) - синхронно через processFarmingReferralReward
 * 2. От фарминга (доход от дохода) - асинхронно через queueFarmingReferralReward для больших объемов
 */
export class ReferralBonusService implements IReferralBonusService {
  // Минимальный порог для начисления реферального вознаграждения отключен (в маркетинге важна каждая транзакция)
  private readonly MIN_REWARD_THRESHOLD = 0.0;
  // Максимальное количество уровней в партнерской программе
  readonly MAX_LEVELS = 20;
  
  // Проценты для вознаграждений на каждом уровне (в %)
  readonly LEVEL_PERCENTS: number[] = [
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

  constructor(
    private readonly userService: IUserService,
    private readonly referralService: IReferralService,
  ) {}

  /**
   * Создаёт реферальную цепочку до 20 уровней на основе приглашающего
   * В рамках ТЗ (Этап 3.1) реализует однократную и необратимую привязку
   * 
   * Оптимизированная версия с пакетной обработкой для улучшения производительности
   * с глубокими цепочками (5+ уровней)
   * 
   * @param userId ID пользователя
   * @param inviterId ID приглашающего пользователя
   * @returns Объект с информацией о результате операции
   */
  async createReferralChain(userId: number, inviterId: number): Promise<{
    success: boolean;
    isNewConnection: boolean;
    message: string;
  }> {
    try {
      const chainCreationId = crypto.randomUUID();
      console.log(`[ReferralBonusService] Starting chain creation. ChainID: ${chainCreationId}, User: ${userId}, Inviter: ${inviterId}`);
      
      // Проверка существования пользователей
      const user = await this.userService.getUserById(userId);
      const inviter = await this.userService.getUserById(inviterId);
      
      if (!user || !inviter) {
        console.error('[ReferralBonusService] User or inviter not found:', { userId, inviterId });
        return {
          success: false,
          isNewConnection: false,
          message: 'Пользователь или пригласитель не найден'
        };
      }
      
      // Обрабатываем в транзакции для атомарности операции
      return await db.transaction(async (tx) => {
        // Записываем первый уровень - прямое приглашение
        // Используем новый интерфейс метода createReferralRelationship, который реализует требования ТЗ 3.1
        const result = await this.referralService.createReferralRelationship(userId, inviterId, 1);
        
        // Если связь не была создана (уже существовала), выходим сразу
        if (!result.isNewConnection) {
          console.log(`[ReferralBonusService] User ${userId} already has a referral chain, operation skipped`);
          return {
            success: result.success,
            isNewConnection: false,
            message: 'Пользователь уже имеет реферальную связь'
          };
        }
        
        // Получаем все вышестоящие уровни для пригласителя одним запросом
        const inviterReferrals = await tx
          .select()
          .from(referrals)
          .where(eq(referrals.user_id, inviterId))
          .orderBy(referrals.level);
        
        if (inviterReferrals.length === 0) {
          console.log(`[ReferralBonusService] No higher-level referrals found for inviter ${inviterId}, chain contains only direct relationship`);
          return {
            success: true,
            isNewConnection: true,
            message: 'Создана прямая реферальная связь (только 1-й уровень)'
          };
        }
        
        // Подготавливаем пакет для массовой вставки связей
        const referralRecords = [];
        
        // Формируем массив записей для пакетной вставки
        for (const ref of inviterReferrals) {
          // Проверяем, что уровень определен и не превышаем MAX_LEVELS
          if (ref.level === null || ref.level >= this.MAX_LEVELS) {
            continue;
          }
          
          // Определяем уровень для новой связи
          const newLevel = ref.level + 1;
          
          // Добавляем в массив для пакетной обработки
          referralRecords.push({
            user_id: userId,
            inviter_id: ref.inviter_id,
            level: newLevel,
            created_at: new Date() // Устанавливаем текущую дату создания
          });
        }
        
        // Выполняем пакетную вставку, если есть записи для вставки
        if (referralRecords.length > 0) {
          console.log(`[ReferralBonusService] Inserting ${referralRecords.length} referral relationships in batch operation`);
          
          try {
            // Используем .onConflictDoNothing для игнорирования дубликатов, если они возникнут
            await tx.insert(referrals)
              .values(referralRecords)
              .onConflictDoNothing({ 
                target: [referrals.user_id, referrals.inviter_id] 
              });
              
            console.log(`[ReferralBonusService] Batch insertion completed successfully, created ${referralRecords.length} referral relationships`);
          } catch (batchError) {
            console.error(`[ReferralBonusService] Error during batch insertion of referral relationships:`, batchError);
            
            // В случае ошибки с пакетной вставкой, откатимся к последовательной вставке как резервному методу
            for (const record of referralRecords) {
              try {
                await this.referralService.createReferral({
                  user_id: record.user_id,
                  inviter_id: record.inviter_id,
                  level: record.level
                });
              } catch (fallbackError) {
                console.error(`[ReferralBonusService] Fallback insertion error for level ${record.level}:`, fallbackError);
                // Продолжаем для остальных записей
              }
            }
          }
        }
        
        console.log(`[ReferralBonusService] Chain ${chainCreationId} created. Total levels: ${referralRecords.length + 1}`);
        return {
          success: true,
          isNewConnection: true,
          message: `Реферальная цепочка успешно создана (${referralRecords.length + 1} уровней)`
        };
      });
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
   * Начисляет реферальное вознаграждение от фарминга (доход от дохода)
   * @param userId ID пользователя, который получил фарминг-доход
   * @param earnedAmount Сумма заработка от фарминга
   * @param currency Валюта (UNI/TON)
   * @returns Объект с информацией о начисленных бонусах
   */
  async processFarmingReferralReward(userId: number, earnedAmount: number, currency: Currency): Promise<{totalRewardsDistributed: number}> {
    try {
      // Создаем уникальный идентификатор для пакета начислений
      const batchId = crypto.randomUUID();
      console.log(`[ReferralBonusService] Starting farming reward distribution. BatchID: ${batchId}, User: ${userId}, Amount: ${earnedAmount} ${currency}`);
      
      // Если сумма слишком мала, не выполняем расчеты
      if (earnedAmount < this.MIN_REWARD_THRESHOLD) {
        console.log(`[ReferralBonusService] Amount ${earnedAmount} is too small, skipping distribution`);
        return {totalRewardsDistributed: 0};
      }
      
      // Создаем запись в журнале распределения вознаграждений
      const logData = insertRewardDistributionLogSchema.parse({
        batch_id: batchId,
        source_user_id: userId,
        earned_amount: earnedAmount.toString(),
        currency: currency,
        status: 'pending'
      });
      
      // Вставляем запись журнала перед началом транзакции для отслеживания
      await db.insert(reward_distribution_logs).values(logData);
      
      try {
        // Выполняем всю логику начисления внутри транзакции для обеспечения атомарности
        const result = await db.transaction(async (tx) => {
          let totalRewardsDistributed = 0;
          let levelsProcessed = 0;
          let inviterCount = 0;
          
          // Получаем всех пригласителей пользователя внутри транзакции
          const userReferrals = await tx
            .select()
            .from(referrals)
            .where(eq(referrals.user_id, userId))
            .orderBy(referrals.level);
          
          // Если нет реферальных связей, выходим
          if (userReferrals.length === 0) {
            console.log(`[ReferralBonusService] No referrals found for user ${userId}, skipping`);
            
            // Обновляем запись журнала - завершено без распределения
            await db.update(reward_distribution_logs)
              .set({ 
                status: 'completed', 
                levels_processed: 0,
                inviter_count: 0,
                total_distributed: '0',
                completed_at: new Date()
              })
              .where(eq(reward_distribution_logs.batch_id, batchId));
              
            return {totalRewardsDistributed: 0};
          }
          
          console.log(`[ReferralBonusService] Found ${userReferrals.length} referrals for user ${userId}, processing...`);
          
          // Для каждого уровня начисляем вознаграждение
          for (const ref of userReferrals) {
            // Проверяем, что уровень определен
            if (ref.level === null) {
              continue;
            }
            
            const level = ref.level;
            levelsProcessed++;
            
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
              try {
                // Получаем пользователя-приглашателя (внутри транзакции)
                const [inviter] = await tx
                  .select()
                  .from(users)
                  .where(eq(users.id, ref.inviter_id));
                  
                if (!inviter) {
                  console.log(`[ReferralBonusService] Inviter with ID ${ref.inviter_id} not found, skipping`);
                  continue;
                }
                
                // Проверяем значения баланса и обрабатываем null значения
                const uniBalance = inviter.balance_uni !== null ? inviter.balance_uni : "0";
                const tonBalance = inviter.balance_ton !== null ? inviter.balance_ton : "0";
                
                // Увеличиваем баланс пользователя
                const newBalance = currency === Currency.UNI 
                  ? Number(uniBalance) + bonusAmount 
                  : Number(tonBalance) + bonusAmount;
                
                // Обновляем баланс пользователя внутри транзакции
                await tx
                  .update(users)
                  .set({
                    balance_uni: currency === Currency.UNI ? newBalance.toString() : uniBalance,
                    balance_ton: currency === Currency.TON ? newBalance.toString() : tonBalance
                  })
                  .where(eq(users.id, ref.inviter_id));
                
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
                  category: "bonus",
                  data: JSON.stringify({
                    batch_id: batchId,
                    level: level,
                    percent: percent
                  })
                });
                
                // Вставляем данные в таблицу транзакций внутри общей транзакции
                await tx
                  .insert(transactions)
                  .values(transactionData);
                
                // Суммируем начисленные бонусы
                totalRewardsDistributed += bonusAmount;
                inviterCount++;
                
                console.log(
                  `[Farming ReferralBonus] Level ${level} (${percent}%) | Amount: ${bonusAmount.toFixed(8)} ${currency} | ` +
                  `From: ${userId} | To: ${ref.inviter_id} | Processed`
                );
              } catch (levelError) {
                // Логируем ошибку на уровне, но продолжаем обработку остальных уровней
                console.error(`[ReferralBonusService] Error processing level ${level} for user ${userId} to inviter ${ref.inviter_id}:`, levelError);
                // Не прерываем цикл, позволяя другим уровням получить начисления
              }
            }
          }
          
          console.log(`[ReferralBonusService] Batch ${batchId} completed. Total distributed: ${totalRewardsDistributed} ${currency}`);
          
          // Обновляем запись журнала с результатами
          await tx.update(reward_distribution_logs)
            .set({ 
              status: 'completed', 
              levels_processed: levelsProcessed,
              inviter_count: inviterCount,
              total_distributed: totalRewardsDistributed.toString(),
              completed_at: new Date()
            })
            .where(eq(reward_distribution_logs.batch_id, batchId));
            
          return {totalRewardsDistributed};
        });
        
        return result;
      } catch (txError) {
        // Обновляем журнал в случае ошибки в транзакции
        const errorMessage = txError instanceof Error ? txError.message : 'Transaction failed';
        await db.update(reward_distribution_logs)
          .set({ 
            status: 'failed', 
            error_message: errorMessage,
            completed_at: new Date()
          })
          .where(eq(reward_distribution_logs.batch_id, batchId));
          
        throw txError; // Повторно бросаем ошибку для внешнего обработчика
      }
    } catch (error) {
      console.error('[ReferralBonusService] Error processing farming referral reward:', error);
      return {totalRewardsDistributed: 0};
    }
  }
  

  
  /**
   * Обрабатывает бонус за регистрацию по реферальному коду
   * @param userId ID зарегистрированного пользователя
   * @param refCode Реферальный код, по которому была совершена регистрация
   * @returns Результат обработки бонуса
   */
  async processRegistrationBonus(userId: number, refCode: string | null): Promise<boolean> {
    try {
      // Проверяем наличие реферального кода
      if (!refCode) {
        console.log(`[ReferralBonusService] No referral code provided for user ${userId}, skipping registration bonus`);
        return false;
      }
      
      console.log(`[ReferralBonusService] Processing registration bonus for user ${userId} with refCode ${refCode}`);
      
      // Находим владельца реферального кода
      const referrer = await this.userService.getUserByRefCode(refCode);
      if (!referrer) {
        console.log(`[ReferralBonusService] No user found with referral code ${refCode}, skipping registration bonus`);
        return false;
      }
      
      // Создаем реферальную цепочку
      const chainResult = await this.createReferralChain(userId, referrer.id);
      if (!chainResult.success) {
        console.log(`[ReferralBonusService] Failed to create referral chain: ${chainResult.message}`);
        return false;
      }
      
      console.log(`[ReferralBonusService] Successfully processed registration bonus for user ${userId} with refCode ${refCode}`);
      return true;
    } catch (error) {
      console.error('[ReferralBonusService] Error processing registration bonus:', error);
      return false;
    }
  }

  /**
   * Начисляет реферальное вознаграждение от покупки буст-пакета
   * @param userId ID пользователя, который купил буст
   * @param boostId ID буст-пакета
   * @param amount Сумма покупки
   * @param currency Валюта (UNI/TON)
   * @returns Объект с информацией о начисленных бонусах
   */
  async processBoostReferralReward(
    userId: number, 
    boostId: number, 
    amount: number, 
    currency: Currency
  ): Promise<{ totalRewardsDistributed: number }> {
    try {
      console.log(`[ReferralBonusService] Processing boost referral reward: userId=${userId}, boostId=${boostId}, amount=${amount} ${currency}`);
      
      // Используем ту же логику, что и для фарминга,
      // так как в обоих случаях речь идет о процентах от суммы
      const rewardResult = await this.processFarmingReferralReward(userId, amount, currency);
      
      console.log(`[ReferralBonusService] Boost referral reward processed, total: ${rewardResult.totalRewardsDistributed} ${currency}`);
      return rewardResult;
    } catch (error) {
      console.error('[ReferralBonusService] Error processing boost referral reward:', error);
      // В случае ошибки возвращаем нулевое вознаграждение, но не прерываем основной процесс
      return { totalRewardsDistributed: 0 };
    }
  }

  /**
   * Помещает реферальное вознаграждение в очередь на асинхронную обработку
   * Оптимизировано для больших реферальных сетей
   * @param userId ID пользователя, который получил фарминг-доход
   * @param earnedAmount Сумма заработка от фарминга
   * @param currency Валюта (UNI/TON)
   * @returns Идентификатор пакета для отслеживания
   */
  async queueFarmingReferralReward(userId: number, earnedAmount: number, currency: Currency): Promise<string> {
    try {
      // Валидация входных параметров
      if (userId <= 0) {
        throw new Error('Invalid user ID');
      }
      
      if (earnedAmount <= 0) {
        throw new Error('Earned amount must be positive');
      }
      
      console.log(`[ReferralBonusService] Queueing farming reward for user ${userId}, amount: ${earnedAmount} ${currency}`);
      
      // Делегируем обработку асинхронному процессору
      const batchId = await referralBonusProcessor.queueReferralReward(userId, earnedAmount, currency);
      
      console.log(`[ReferralBonusService] Successfully queued reward, batch ID: ${batchId}`);
      return batchId;
    } catch (error) {
      console.error('[ReferralBonusService] Error queueing farming referral reward:', error);
      throw error;
    }
  }
}

// Импортируем необходимые службы для создания синглтона
import { userServiceInstance } from './userServiceInstance';
import { referralServiceInstance } from './referralServiceInstance';

// Создаем единственный экземпляр сервиса
export const referralBonusServiceInstance = new ReferralBonusService(
  userServiceInstance,
  referralServiceInstance
);

/**
 * Фабричная функция для создания экземпляра сервиса ReferralBonusService
 * @returns Экземпляр сервиса ReferralBonusService
 */
export function createReferralBonusService(): IReferralBonusService {
  return referralBonusServiceInstance;
}