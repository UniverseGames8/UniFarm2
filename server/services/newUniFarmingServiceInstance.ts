/**
 * Инстанс-ориентированная имплементация сервиса множественного UNI Farming
 * 
 * Этот файл содержит реализацию сервиса множественного UNI Farming,
 * который работает с таблицей uni_farming_deposits и поддерживает множественные депозиты
 */

import { db } from '../db';
import { and, eq } from 'drizzle-orm';
import { users, uniFarmingDeposits } from '@shared/schema';
import BigNumber from 'bignumber.js';
import { transactionService as TransactionService } from './index';
import { referralBonusService } from './index';

import { 
  MultiFarmingUpdateResult, 
  CreateMultiDepositResult, 
  MultiFarmingInfo,
  Currency,
  TransactionStatus,
  TransactionType
} from './newUniFarmingService';

/**
 * Интерфейс для сервиса множественного UNI Farming
 */
export interface INewUniFarmingService {
  calculateAndUpdateUserFarming(userId: number): Promise<MultiFarmingUpdateResult>;
  createUniFarmingDeposit(userId: number, amount: string): Promise<CreateMultiDepositResult>;
  getUserFarmingDeposits(userId: number): Promise<any[]>;
  getUserFarmingInfo(userId: number): Promise<MultiFarmingInfo>;
  getUserFarmingStatus(userId: number): Promise<any>;
  harvestUserFarming(userId: number): Promise<any>;
  simulateFarmingReward(userId: number, amount: string): Promise<any>;
}

// Константы для расчетов
const DAILY_RATE = 0.005; // 0.5% в день
const SECONDS_IN_DAY = 86400;
const MIN_CHANGE_THRESHOLD = 0.000001; // Минимальный порог изменения для обновления баланса в БД

// Объявляем глобальные переменные для TypeScript
declare global {
  var _processingUsers: Map<number, boolean>;
}

// Создаем и экспортируем экземпляр сервиса
export const newUniFarmingServiceInstance: INewUniFarmingService = {
  async calculateAndUpdateUserFarming(userId: number): Promise<MultiFarmingUpdateResult> {
    // Защита от одновременных вызовов для одного пользователя
    if (!globalThis._processingUsers) {
      globalThis._processingUsers = new Map<number, boolean>();
    }

    if (globalThis._processingUsers.get(userId)) {
      return {
        totalDepositAmount: '0',
        totalRatePerSecond: '0',
        earnedThisUpdate: '0',
        depositCount: 0
      };
    }

    globalThis._processingUsers.set(userId, true);

    try {
      const [user] = await db
        .select({
          balance_uni: users.balance_uni,
          uni_farming_balance: users.uni_farming_balance
        })
        .from(users)
        .where(eq(users.id, userId));

      if (!user) {
        return {
          totalDepositAmount: '0',
          totalRatePerSecond: '0',
          earnedThisUpdate: '0',
          depositCount: 0
        };
      }

      const currentBalance = new BigNumber(user.balance_uni !== null ? user.balance_uni.toString() : '0');
      
      const activeDeposits = await db
        .select()
        .from(uniFarmingDeposits)
        .where(and(
          eq(uniFarmingDeposits.user_id, userId),
          eq(uniFarmingDeposits.is_active, true)
        ));

      if (activeDeposits.length === 0) {
        return {
          totalDepositAmount: '0',
          totalRatePerSecond: '0',
          earnedThisUpdate: '0',
          depositCount: 0
        };
      }

      let totalDepositAmount = new BigNumber(0);
      let totalRatePerSecond = new BigNumber(0);
      let totalEarnedAmount = new BigNumber(0);
      const now = new Date();

      // Обрабатываем каждый депозит
      for (const deposit of activeDeposits) {
        const depositAmount = new BigNumber(deposit.amount.toString());
        totalDepositAmount = totalDepositAmount.plus(depositAmount);

        const lastUpdate = deposit.last_updated_at;
        const secondsSinceLastUpdate = Math.floor((now.getTime() - lastUpdate.getTime()) / 1000);
        
        const MAX_SECONDS_BETWEEN_UPDATES = 10;
        
        const effectiveSeconds = Math.min(
          MAX_SECONDS_BETWEEN_UPDATES,
          Math.max(0.1, secondsSinceLastUpdate)
        );

        const ratePerSecond = new BigNumber(deposit.rate_per_second.toString());
        const earnedAmount = ratePerSecond.multipliedBy(effectiveSeconds);

        console.log(`[MultiFarming] User ${userId} Deposit #${deposit.id}: Amount=${depositAmount.toString()}, Rate=${ratePerSecond.toString()}/sec, Time=${effectiveSeconds}s, Earned=${earnedAmount.toString()}`);

        totalEarnedAmount = totalEarnedAmount.plus(earnedAmount);
        totalRatePerSecond = totalRatePerSecond.plus(ratePerSecond);

        await db
          .update(uniFarmingDeposits)
          .set({
            last_updated_at: now
          })
          .where(eq(uniFarmingDeposits.id, deposit.id));
      }

      const currentAccumulatedBalance = new BigNumber(user.uni_farming_balance !== null ? user.uni_farming_balance.toString() : '0');
      const newAccumulatedBalance = currentAccumulatedBalance.plus(totalEarnedAmount);

      const readyToUpdate = newAccumulatedBalance.isGreaterThanOrEqualTo(MIN_CHANGE_THRESHOLD);
      
      const newBalance = currentBalance.plus(totalEarnedAmount);
      const formattedNewBalance = newBalance.toFixed(6);

      if (readyToUpdate) {
        console.log(`[MultiFarming] Balance Updated User ${userId} | Balance: ${currentBalance.toFixed(6)} => ${formattedNewBalance}`);
        console.log(`[MultiFarming] Accumulated Balance User ${userId} | ${currentAccumulatedBalance.toFixed(8)} => 0 (Transferring to main balance)`);
        
        try {
          const updateResult = await db
            .update(users)
            .set({
              balance_uni: formattedNewBalance,
              uni_farming_balance: '0'
            })
            .where(eq(users.id, userId))
            .returning({ balance_uni: users.balance_uni });
          
          if (updateResult && updateResult.length > 0) {
            console.log(`[MultiFarming] Balance Updated OK User ${userId} new balance confirmed: ${updateResult[0].balance_uni}`);
            
            try {
              await TransactionService.logTransaction({
                userId,
                type: TransactionType.FARMING_REWARD,
                currency: Currency.UNI,
                amount: totalEarnedAmount.toString(),
                status: TransactionStatus.CONFIRMED,
                source: 'MultiFarming',
                category: 'farming'
              });
              
              try {
                const { totalRewardsDistributed } = await referralBonusService.processFarmingReferralReward(
                  userId,
                  totalEarnedAmount.toNumber(),
                  Currency.UNI
                );
                
                if (totalRewardsDistributed > 0) {
                  console.log(`[MultiFarming] Referral Income From Income | User ${userId} earned ${totalEarnedAmount.toString()} UNI and distributed ${totalRewardsDistributed.toFixed(8)} UNI to referrals`);
                }
              } catch (referralError) {
                console.error(`[MultiFarming] Error processing referral rewards from farming income for user ${userId}:`, referralError);
              }
            } catch (logError) {
              console.error(`[MultiFarming] Transaction Logging Error User ${userId}:`, logError);
            }
          } else {
            console.error(`[MultiFarming] Balance Update Failed User ${userId} - no rows updated`);
          }
        } catch (error) {
          console.error(`[MultiFarming] Balance Update Error User ${userId} - error updating balance:`, error);
        }
      } else {
        try {
          const updateResult = await db
            .update(users)
            .set({
              uni_farming_balance: newAccumulatedBalance.toFixed(8)
            })
            .where(eq(users.id, userId))
            .returning({ uni_farming_balance: users.uni_farming_balance });
          
          if (updateResult && updateResult.length > 0) {
            console.log(`[MultiFarming] Accumulated Balance Updated User ${userId} | ${currentAccumulatedBalance.toFixed(8)} => ${updateResult[0].uni_farming_balance}`);
          } else {
            console.error(`[MultiFarming] Accumulated Balance Update Failed User ${userId} - no rows updated`);
          }
        } catch (error) {
          console.error(`[MultiFarming] Accumulated Balance Update Error User ${userId}:`, error);
        }
        
        console.log(`[MultiFarming] Balance No Change User ${userId} | Balance remains: ${formattedNewBalance} (Accumulating: ${newAccumulatedBalance.toFixed(8)})`);
      }
      
      return {
        totalDepositAmount: totalDepositAmount.toString(),
        totalRatePerSecond: totalRatePerSecond.toString(),
        earnedThisUpdate: totalEarnedAmount.toString(),
        depositCount: activeDeposits.length
      };
    } catch (error) {
      console.error(`[MultiFarming] Error in calculateAndUpdateUserFarming for user ${userId}:`, error);
      
      return {
        totalDepositAmount: '0',
        totalRatePerSecond: '0',
        earnedThisUpdate: '0',
        depositCount: 0
      };
    } finally {
      globalThis._processingUsers.set(userId, false);
    }
  },

  async createUniFarmingDeposit(userId: number, amount: string): Promise<CreateMultiDepositResult> {
    console.log('[NewUniFarmingService] ➡️ Запрос на создание депозита, параметры:', { userId, amount });
    
    try {
      const depositAmount = new BigNumber(amount);
      if (depositAmount.isNaN() || depositAmount.isLessThanOrEqualTo(0)) {
        console.error('[NewUniFarmingService] ❌ Некорректная сумма депозита:', amount);
        return {
          success: false,
          message: 'Сумма депозита должна быть положительной'
        };
      }
      
      console.log('[NewUniFarmingService] 🔍 Проверка баланса пользователя:', userId);
      const [user] = await db
        .select({
          balance_uni: users.balance_uni
        })
        .from(users)
        .where(eq(users.id, userId));
      
      if (!user) {
        console.error('[NewUniFarmingService] ❌ Пользователь не найден:', userId);
        return {
          success: false,
          message: 'Пользователь не найден'
        };
      }
      
      const balanceUni = new BigNumber(user.balance_uni !== null ? user.balance_uni.toString() : '0');
      console.log('[NewUniFarmingService] ℹ️ Текущий баланс:', { 
        userId, 
        balance: balanceUni.toString(), 
        depositAmount: depositAmount.toString(),
        sufficientFunds: balanceUni.isGreaterThanOrEqualTo(depositAmount)
      });
      
      if (balanceUni.decimalPlaces(6).isLessThan(depositAmount)) {
        console.error('[NewUniFarmingService] ❌ Недостаточно средств:', { 
          balance: balanceUni.toString(), 
          depositAmount: depositAmount.toString() 
        });
        return {
          success: false,
          message: 'Недостаточно средств на балансе'
        };
      }
      
      if (depositAmount.isLessThan(0.001)) {
        return {
          success: false,
          message: 'Минимальная сумма пополнения - 0.001 UNI'
        };
      }
      
      const ratePerSecond = depositAmount
        .multipliedBy(DAILY_RATE)
        .dividedBy(SECONDS_IN_DAY)
        .toString();

      let newDeposit;
      try {
        const currentTime = new Date();
        [newDeposit] = await db
          .insert(uniFarmingDeposits)
          .values({
            user_id: userId,
            amount: depositAmount.toFixed(6),
            rate_per_second: ratePerSecond,
            created_at: currentTime,
            last_updated_at: currentTime,
            is_active: true
          })
          .returning();
        
        if (!newDeposit) {
          throw new Error('Ошибка при создании депозита');
        }
      } catch (err) {
        console.error('[createUniFarmingDeposit] Ошибка при вставке в БД:', err);
        return {
          success: false,
          message: 'Ошибка при создании депозита'
        };
      }

      // КРИТИЧЕСКИ ВАЖНАЯ ОПЕРАЦИЯ: Вычитание из баланса пользователя
      console.log('[NewUniFarmingService] 💸 Вычитаем из баланса:', {
        userId,
        oldBalance: balanceUni.toString(),
        subtractAmount: depositAmount.toString(),
        newBalance: balanceUni.minus(depositAmount).toString()
      });
      
      // Вычисляем новый баланс
      const newBalance = balanceUni.minus(depositAmount).toFixed(6);
      
      try {
        await db
          .update(users)
          .set({
            balance_uni: newBalance
          })
          .where(eq(users.id, userId));
          
        console.log('[NewUniFarmingService] ✅ Баланс пользователя успешно обновлен');
      } catch (error) {
        console.error('[NewUniFarmingService] ❌ Ошибка при обновлении баланса:', error);
        throw new Error('Ошибка при обновлении баланса пользователя');
      }
      
      // Логируем транзакцию
      console.log('[NewUniFarmingService] 📝 Логируем транзакцию депозита');
      await TransactionService.logTransaction({
        userId,
        type: TransactionType.DEPOSIT,
        currency: Currency.UNI,
        amount: depositAmount.toString(),
        status: TransactionStatus.CONFIRMED,
        source: 'UNI Farming Deposit',
        category: 'deposit'
      });
      
      return {
        success: true,
        message: 'Депозит успешно создан',
        depositId: newDeposit.id,
        depositAmount: depositAmount.toString(),
        ratePerSecond,
        newBalance // Добавляем новый баланс в ответ
      };
    } catch (error) {
      console.error('[createUniFarmingDeposit] Неизвестная ошибка:', error);
      return {
        success: false,
        message: 'Неожиданная ошибка при создании депозита'
      };
    }
  },

  async getUserFarmingDeposits(userId: number) {
    return await db
      .select()
      .from(uniFarmingDeposits)
      .where(and(
        eq(uniFarmingDeposits.user_id, userId),
        eq(uniFarmingDeposits.is_active, true)
      ));
  },

  async getUserFarmingInfo(userId: number): Promise<MultiFarmingInfo> {
    try {
      await this.calculateAndUpdateUserFarming(userId);
    } catch (err) {
      console.error('[getUserFarmingInfo] Ошибка при обновлении фарминга:', err);
    }
    
    const deposits = await this.getUserFarmingDeposits(userId);
    
    console.log(`[MultiFarming] getUserFarmingInfo - Actual deposits count: ${deposits.length}`);
    
    if (deposits.length === 0) {
      return {
        isActive: false,
        totalDepositAmount: '0',
        depositCount: 0,
        totalRatePerSecond: '0',
        dailyIncomeUni: '0',
        deposits: []
      };
    }

    let totalDepositAmount = new BigNumber(0);
    let totalRatePerSecond = new BigNumber(0);

    for (const deposit of deposits) {
      totalDepositAmount = totalDepositAmount.plus(new BigNumber(deposit.amount.toString()));
      totalRatePerSecond = totalRatePerSecond.plus(new BigNumber(deposit.rate_per_second.toString()));
    }

    const dailyIncomeUni = totalRatePerSecond.multipliedBy(SECONDS_IN_DAY).toString();

    return {
      isActive: deposits.length > 0,
      totalDepositAmount: totalDepositAmount.toString(),
      depositCount: deposits.length,
      totalRatePerSecond: totalRatePerSecond.toString(),
      dailyIncomeUni,
      deposits
    };
  },
  
  async getUserFarmingStatus(userId: number): Promise<any> {
    try {
      // Получаем информацию о фарминге
      const farmingInfo = await this.getUserFarmingInfo(userId);
      
      // Получаем накопленную прибыль за текущую сессию
      const [user] = await db
        .select({
          uni_farming_balance: users.uni_farming_balance,
          balance_uni: users.balance_uni
        })
        .from(users)
        .where(eq(users.id, userId));
      
      if (!user) {
        throw new Error(`Пользователь с ID ${userId} не найден`);
      }
      
      const accumulatedBalance = user.uni_farming_balance !== null ? user.uni_farming_balance.toString() : '0';
      const currentBalance = user.balance_uni !== null ? user.balance_uni.toString() : '0';
      
      // Получаем активные депозиты
      const deposits = await db
        .select()
        .from(uniFarmingDeposits)
        .where(and(
          eq(uniFarmingDeposits.user_id, userId),
          eq(uniFarmingDeposits.is_active, true)
        ));
      
      console.log(`[MultiFarming] getUserFarmingStatus - Actual deposits count: ${deposits.length}`);
      
      // Используем фактическое количество депозитов из базы данных
      return {
        isActive: farmingInfo.isActive,
        totalDepositAmount: farmingInfo.totalDepositAmount,
        depositCount: deposits.length, // Используем фактическое количество депозитов из БД
        totalRatePerSecond: farmingInfo.totalRatePerSecond,
        dailyIncomeUni: farmingInfo.dailyIncomeUni, 
        accumulatedBalance: accumulatedBalance,
        currentBalance: currentBalance,
        latestDeposits: deposits.slice(0, 5).map(deposit => ({
          id: deposit.id,
          amount: deposit.amount.toString(),
          rate_per_second: deposit.rate_per_second.toString(),
          created_at: deposit.created_at
        }))
      };
    } catch (error) {
      console.error(`Ошибка при получении статуса фарминга для пользователя ${userId}:`, error);
      throw error;
    }
  },
  
  async harvestUserFarming(userId: number): Promise<any> {
    try {
      // Получаем текущий накопленный баланс пользователя
      const [user] = await db
        .select({
          uni_farming_balance: users.uni_farming_balance
        })
        .from(users)
        .where(eq(users.id, userId));
      
      if (!user) {
        throw new Error(`Пользователь с ID ${userId} не найден`);
      }
      
      const accumulatedBalance = new BigNumber(user.uni_farming_balance !== null ? user.uni_farming_balance.toString() : '0');
      
      if (accumulatedBalance.isLessThanOrEqualTo(0)) {
        return {
          success: false,
          message: 'Нет накопленной прибыли для сбора',
          harvested_amount: '0'
        };
      }
      
      // Обновляем базу данных - переводим накопленные средства на основной баланс
      await db.transaction(async (tx) => {
        // Сбрасываем накопленный баланс
        await tx
          .update(users)
          .set({
            balance_uni: db.raw(`balance_uni + ${accumulatedBalance.toString()}`),
            uni_farming_balance: 0
          })
          .where(eq(users.id, userId));
        
        // Создаем транзакцию в истории для учета сбора фарминга
        await TransactionService.createTransaction({
          user_id: userId,
          type: 'reward' as TransactionType,
          currency: 'UNI' as Currency,
          amount: accumulatedBalance.toString(),
          status: 'confirmed' as TransactionStatus,
          source: 'UNI Farming Harvest',
          category: 'farming',
          description: 'Сбор накопленной прибыли от UNI фарминга'
        });
      });
      
      console.log(`[UniFarmingService] Пользователь ${userId} собрал ${accumulatedBalance.toString()} UNI из фарминга`);
      
      // Обработка реферальных бонусов от сбора фарминга
      await referralBonusService.processReferralBonusFromFarming(userId, accumulatedBalance.toString());
      
      return {
        success: true,
        message: 'Прибыль успешно собрана',
        harvested_amount: accumulatedBalance.toString()
      };
    } catch (error) {
      console.error(`Ошибка при сборе фарминга для пользователя ${userId}:`, error);
      throw error;
    }
  },
  
  async simulateFarmingReward(userId: number, amount: string): Promise<any> {
    try {
      // Преобразуем сумму в BigNumber для безопасных вычислений
      const depositAmount = new BigNumber(amount);
      
      if (depositAmount.isLessThanOrEqualTo(0)) {
        return {
          success: false,
          message: 'Сумма должна быть положительным числом'
        };
      }
      
      // Рассчитываем скорость накопления прибыли (rate_per_second)
      const ratePerSecond = depositAmount
        .multipliedBy(DAILY_RATE)
        .dividedBy(SECONDS_IN_DAY)
        .toString();
      
      // Рассчитываем прибыль за день
      const dailyIncome = depositAmount
        .multipliedBy(DAILY_RATE)
        .toString();
      
      // Рассчитываем прибыль за неделю
      const weeklyIncome = depositAmount
        .multipliedBy(DAILY_RATE)
        .multipliedBy(7)
        .toString();
      
      // Рассчитываем прибыль за месяц (30 дней)
      const monthlyIncome = depositAmount
        .multipliedBy(DAILY_RATE)
        .multipliedBy(30)
        .toString();
      
      return {
        success: true,
        deposit_amount: depositAmount.toString(),
        rate_per_second: ratePerSecond,
        daily_income: dailyIncome,
        weekly_income: weeklyIncome,
        monthly_income: monthlyIncome,
        annual_percentage: (DAILY_RATE * 100 * 365).toString() // Годовой процент
      };
    } catch (error) {
      console.error(`Ошибка при симуляции вознаграждения для суммы ${amount}:`, error);
      throw error;
    }
  }
};

/**
 * Функция для получения экземпляра сервиса множественного UNI Farming
 * @returns Экземпляр сервиса
 */
export function createNewUniFarmingService(): INewUniFarmingService {
  return newUniFarmingServiceInstance;
}