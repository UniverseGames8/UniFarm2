/**
 * Инстанс-ориентированная имплементация сервиса TON Boost
 * 
 * Этот файл содержит основную реализацию сервиса TON Boost,
 * который работает на базе конкретного инстанса
 */

import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { 
  tonBoostDeposits, 
  type TonBoostDeposit, 
  type InsertTonBoostDeposit,
  transactions,
  users,
  type User,
  type InsertTransaction,
  insertTransactionSchema
} from "@shared/schema";
import BigNumber from "bignumber.js";
import { type IReferralBonusService } from "./referralBonusServiceInstance";
import { referralBonusServiceInstance } from "./referralBonusServiceInstance";

// Extended type for User to handle legacy farming fields
// This is for backwards compatibility only, a proper schema update should be done in the future
interface ExtendedUser extends User {
  // These fields are not in the schema but may be used by old code
  farming_balance_ton?: string;
  farming_balance_uni?: string;
  farming_last_update?: Date;
}

// Define Currency enum if not available in schema
enum Currency {
  TON = "TON",
  UNI = "UNI"
}

// Константы для расчетов
const SECONDS_IN_DAY = 86400;
const TON_MIN_CHANGE_THRESHOLD = 0.000001; // Минимальный порог для обновления баланса в БД (0.000001 TON)

// Адрес TON кошелька проекта для приема платежей
const TON_WALLET_ADDRESS = "UQBlrUfJMIlAcyYzttyxV2xrrvaHHIKEKeetGZbDoitTRWT8";

// Каталог буст-пакетов (стандартизирован по утвержденной структуре)
const boostPackages = [
  {
    id: 1,
    name: "Starter Boost",
    priceTon: "1.0",
    bonusUni: "10000.0",    // Бонус UNI при покупке
    rateTon: "0.5",         // 0.5% в день для TON
    rateUni: "0.0"          // Нет дополнительной доходности в UNI
  },
  {
    id: 2,
    name: "Standard Boost",
    priceTon: "5.0",
    bonusUni: "75000.0",    // Бонус UNI при покупке
    rateTon: "1.0",         // 1.0% в день для TON
    rateUni: "0.0"          // Нет дополнительной доходности в UNI
  },
  {
    id: 3,
    name: "Advanced Boost",
    priceTon: "15.0",
    bonusUni: "250000.0",   // Бонус UNI при покупке
    rateTon: "2.0",         // 2.0% в день для TON
    rateUni: "0.0"          // Нет дополнительной доходности в UNI
  },
  {
    id: 4,
    name: "Premium Boost",
    priceTon: "25.0",
    bonusUni: "500000.0",   // Бонус UNI при покупке
    rateTon: "2.5",         // 2.5% в день для TON
    rateUni: "0.0"          // Нет дополнительной доходности в UNI
  }
];

/**
 * Перечисления для модуля TON Boost
 */
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

/**
 * Типы данных для модуля TON Boost
 */
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

/**
 * Интерфейс сервиса TON Boost
 */
export interface ITonBoostService {
  getBoostPackages(): TonBoostPackage[];
  getBoostPackageById(boostId: number): TonBoostPackage | undefined;
  getUserActiveBoosts(userId: number): Promise<TonBoostDeposit[]>;
  createTonBoostDeposit(depositData: InsertTonBoostDeposit): Promise<TonBoostDeposit>;
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

/**
 * Класс сервиса TON Boost
 * Предоставляет методы для работы с TON Boost-пакетами
 */
class TonBoostService implements ITonBoostService {
  constructor(
    private readonly referralBonusService: IReferralBonusService
  ) {}

  /**
   * Получает список всех доступных буст-пакетов
   * @returns Список буст-пакетов
   */
  getBoostPackages(): TonBoostPackage[] {
    return boostPackages;
  }

  /**
   * Получает буст-пакет по ID
   * @param boostId ID буст-пакета
   * @returns Буст-пакет или undefined, если не найден
   */
  getBoostPackageById(boostId: number): TonBoostPackage | undefined {
    // Проверка на валидный ID и его наличие в списке packages
    if (!boostId || isNaN(boostId) || boostId < 1 || boostId > boostPackages.length) {
      console.log(`[TonBoostService] Недопустимый ID буст-пакета: ${boostId}`);
      return undefined;
    }

    const pkg = boostPackages.find(pkg => pkg.id === boostId);

    // Проверка, что у пакета есть цена в TON
    if (!pkg || !pkg.priceTon || pkg.priceTon === 'null') {
      console.log(`[TonBoostService] Пакет найден, но цена отсутствует: ${JSON.stringify(pkg)}`);
      return undefined;
    }

    return pkg;
  }

  /**
   * Получает все активные TON Boost-депозиты пользователя
   * @param userId ID пользователя
   * @returns Список активных TON Boost-депозитов
   */
  async getUserActiveBoosts(userId: number): Promise<TonBoostDeposit[]> {
    try {
      console.log(`[TON FARMING] Запрос активных депозитов для пользователя ${userId}`);
      
      // Проверяем существование таблицы перед запросом
      const tableCheckQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'ton_boost_deposits'
        );
      `;
      
      const tableExists = await db.query(tableCheckQuery);
      
      if (!tableExists.rows?.[0]?.exists) {
        console.log(`[TON FARMING] Таблица ton_boost_deposits не найдена, возвращаем пустой массив`);
        return [];
      }
      
      // Запрашиваем данные только если таблица существует
      const query = `
        SELECT * FROM ton_boost_deposits 
        WHERE user_id = $1 AND is_active = true
      `;
      
      const result = await db.query(query, [userId]);
      const userDeposits = result.rows || [];

      console.log(`[TON FARMING] Найдено ${userDeposits.length} активных депозитов для пользователя ${userId}`);
      return userDeposits;
    } catch (error) {
      console.error(`[TON FARMING ERROR] Ошибка при получении депозитов пользователя ${userId}:`, error);
      // Возвращаем пустой массив вместо падения
      return [];
    }
  }

  /**
   * Создает запись о TON Boost-депозите
   * @param depositData Данные депозита
   * @returns Созданный депозит
   */
  async createTonBoostDeposit(depositData: InsertTonBoostDeposit): Promise<TonBoostDeposit> {
    const [deposit] = await db
      .insert(tonBoostDeposits)
      .values(depositData)
      .returning();

    return deposit;
  }

  /**
   * Рассчитывает скорость начисления TON и UNI в секунду
   * @param amount Сумма депозита TON
   * @param rateTonPerDay Доходность TON в день (%)
   * @param rateUniPerDay Доходность UNI в день (%)
   * @returns Объект с двумя ставками - для TON и UNI
   */
  calculateRatesPerSecond(amount: string, rateTonPerDay: string, rateUniPerDay: string): { 
    tonRatePerSecond: string, 
    uniRatePerSecond: string 
  } {
    // Защита от null значений
    const safeAmount = amount || "0";
    const safeTonRate = rateTonPerDay || "0";
    const safeUniRate = rateUniPerDay || "0";

    const tonRatePerSecond = new BigNumber(safeAmount)
      .multipliedBy(new BigNumber(safeTonRate).dividedBy(100))
      .dividedBy(SECONDS_IN_DAY)
      .toString();

    const uniRatePerSecond = new BigNumber(safeAmount)
      .multipliedBy(new BigNumber(safeUniRate).dividedBy(100))
      .dividedBy(SECONDS_IN_DAY)
      .toString();

    return { tonRatePerSecond, uniRatePerSecond };
  }

  /**
   * Рассчитывает и обновляет баланс фарминга TON для пользователя
   * @param userId ID пользователя
   * @returns Результат обновления с информацией о начисленных средствах
   */
  async calculateAndUpdateUserTonFarming(userId: number): Promise<TonFarmingUpdateResult> {
    try {
      // Получаем активные TON Boost-депозиты пользователя
      const activeDeposits = await this.getUserActiveBoosts(userId);

      if (activeDeposits.length === 0) {
        return {
          success: true,
          userId,
          earnedTon: "0",
          earnedUni: "0",
          lastUpdateTimestamp: Math.floor(Date.now() / 1000)
        };
      }

      // Получаем информацию о пользователе
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));

      if (!user) {
        throw new Error(`Пользователь с ID ${userId} не найден`);
      }

      // Рассчитываем заработанные средства для каждого депозита
      let totalEarnedTon = new BigNumber(0);
      let totalEarnedUni = new BigNumber(0);

      const currentTimestamp = Math.floor(Date.now() / 1000);
      // Явное приведение к расширенному типу для работы со старым кодом
      const extendedUser = user as ExtendedUser;

      // Используем uni_farming_last_update вместо farming_last_update (если такое свойство есть)
      const lastUpdateTimestamp = user.uni_farming_last_update 
        ? Math.floor(new Date(user.uni_farming_last_update).getTime() / 1000)
        : currentTimestamp;

      // Время в секундах с последнего обновления
      const elapsedSeconds = Math.max(0, currentTimestamp - lastUpdateTimestamp);

      if (elapsedSeconds <= 0) {
        return {
          success: true,
          userId,
          earnedTon: "0",
          earnedUni: "0",
          lastUpdateTimestamp: currentTimestamp
        };
      }

      // Рассчитываем доходность для каждого депозита и обновляем accumulated_ton
      for (const deposit of activeDeposits) {
        // Начисления TON: rate_ton_per_second * elapsed_time
        const earnedTon = new BigNumber(deposit.rate_ton_per_second || "0")
          .multipliedBy(elapsedSeconds);

        // Начисления UNI: rate_uni_per_second * elapsed_time
        const earnedUni = new BigNumber(deposit.rate_uni_per_second || "0")
          .multipliedBy(elapsedSeconds);

        totalEarnedTon = totalEarnedTon.plus(earnedTon);
        totalEarnedUni = totalEarnedUni.plus(earnedUni);

        // Обновляем накопленные значения и время последнего обновления для каждого депозита
        if (earnedTon.isGreaterThan(0)) {
          const currentAccumulatedTon = new BigNumber(deposit.accumulated_ton || "0");
          const newAccumulatedTon = currentAccumulatedTon.plus(earnedTon);

          console.log(`[TonBoostService] Обновление депозита ID ${deposit.id}: добавлено ${earnedTon} TON, всего накоплено: ${newAccumulatedTon} TON`);

          // Обновляем депозит
          await db
            .update(tonBoostDeposits)
            .set({
              accumulated_ton: newAccumulatedTon.toString(),
              last_updated_at: new Date(currentTimestamp * 1000)
            })
            .where(eq(tonBoostDeposits.id, deposit.id));
        }
      }

      // Обновляем время последнего обновления пользователя, если были начисления
      if (totalEarnedTon.isGreaterThan(TON_MIN_CHANGE_THRESHOLD) || totalEarnedUni.isGreaterThan(0)) {
        // Обновляем время последнего обновления
        await db
          .update(users)
          .set({
            uni_farming_last_update: new Date(currentTimestamp * 1000)
          })
          .where(eq(users.id, userId));

        // Создаем транзакцию для начисления TON фарминга, если было начисление
        if (totalEarnedTon.isGreaterThan(TON_MIN_CHANGE_THRESHOLD)) {
          try {
            await db
              .insert(transactions)
              .values({
                user_id: userId,
                type: "ton_farming_reward",
                currency: "TON",
                amount: totalEarnedTon.toString(),
                status: "confirmed",
                source: "TON Boost фарминг",
                category: "farming"
              });

            console.log(`[TonBoostService] Создана транзакция начисления TON фарминга: ${totalEarnedTon} TON для пользователя ${userId}`);
          } catch (txError) {
            console.error(`[TonBoostService] Ошибка при создании транзакции начисления TON фарминга: ${txError}`);
            // Не прерываем выполнение основного процесса при ошибке создания транзакции
          }
        }
      }

      return {
        success: true,
        userId,
        earnedTon: totalEarnedTon.toString(),
        earnedUni: totalEarnedUni.toString(),
        lastUpdateTimestamp: currentTimestamp
      };
    } catch (error) {
      console.error(`[TonBoostService] Ошибка при обновлении TON фарминга: ${error}`);
      return {
        success: false,
        userId,
        earnedTon: "0",
        earnedUni: "0",
        lastUpdateTimestamp: Math.floor(Date.now() / 1000)
      };
    }
  }

  /**
   * Получает информацию о TON фарминге пользователя
   * @param userId ID пользователя
   * @returns Информацию о TON фарминге пользователя
   */
  async getUserTonFarmingInfo(userId: number): Promise<TonFarmingInfo> {
    try {
      console.log(`[TON FARMING INFO] Начало загрузки данных для пользователя ${userId}`);
      
      // Получаем активные TON Boost-депозиты пользователя
      const activeDeposits = await this.getUserActiveBoosts(userId);

      // Рассчитываем общую скорость начисления TON и UNI
      let totalTonRatePerSecond = new BigNumber(0);
      let totalUniRatePerSecond = new BigNumber(0);

      for (const deposit of activeDeposits) {
        totalTonRatePerSecond = totalTonRatePerSecond.plus(deposit.rate_ton_per_second || "0");
        totalUniRatePerSecond = totalUniRatePerSecond.plus(deposit.rate_uni_per_second || "0");
      }

      // Рассчитываем дневной доход
      const dailyIncomeTon = totalTonRatePerSecond.multipliedBy(SECONDS_IN_DAY);
      const dailyIncomeUni = totalUniRatePerSecond.multipliedBy(SECONDS_IN_DAY);

      const result = {
        totalTonRatePerSecond: totalTonRatePerSecond.toString(),
        totalUniRatePerSecond: totalUniRatePerSecond.toString(),
        dailyIncomeTon: dailyIncomeTon.toString(),
        dailyIncomeUni: dailyIncomeUni.toString(),
        deposits: activeDeposits
      };

      console.log(`[TON FARMING INFO] Loaded for user_id=${userId}, deposits: ${activeDeposits.length}, daily TON: ${dailyIncomeTon.toString()}`);
      return result;
    } catch (error) {
      console.error(`[TON FARMING ERROR] Критическая ошибка при загрузке данных пользователя ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Запускает обновление TON фарминга для всех пользователей с активными депозитами
   * @returns Результат обновления
   */
  async updateAllUsersTonFarming(): Promise<{
    success: boolean;
    usersUpdated: number;
    errors: number;
  }> {
    try {
      console.log('[TonBoostService] Запуск обновления TON фарминга для всех пользователей');

      // Получаем уникальные user_id из активных депозитов
      const activeDepositsQuery = await db
        .select({ userId: tonBoostDeposits.user_id })
        .from(tonBoostDeposits)
        .where(
          and(
            eq(tonBoostDeposits.is_active, true)
          )
        )
        .groupBy(tonBoostDeposits.user_id);

      const userIds = activeDepositsQuery.map(row => row.userId);
      console.log(`[TonBoostService] Найдено ${userIds.length} пользователей с активными TON депозитами`);

      let successCount = 0;
      let errorCount = 0;

      // Обновляем каждого пользователя
      for (const userId of userIds) {
        try {
          const result = await this.calculateAndUpdateUserTonFarming(userId);
          if (result.success) {
            successCount++;
            // Логируем только если было реальное начисление
            if (new BigNumber(result.earnedTon).isGreaterThan(TON_MIN_CHANGE_THRESHOLD)) {
              console.log(`[TonBoostService] Успешно обновлен TON фарминг для пользователя ${userId}: +${result.earnedTon} TON`);
            }
          } else {
            errorCount++;
            console.error(`[TonBoostService] Ошибка обновления TON фарминга для пользователя ${userId}`);
          }
        } catch (userError) {
          errorCount++;
          console.error(`[TonBoostService] Исключение при обновлении пользователя ${userId}: ${userError}`);
        }
      }

      console.log(`[TonBoostService] Обновление TON фарминга завершено: успешно=${successCount}, ошибок=${errorCount}`);

      return {
        success: true,
        usersUpdated: successCount,
        errors: errorCount
      };

    } catch (error) {
      console.error(`[TonBoostService] Критическая ошибка при обновлении TON фарминга для всех пользователей: ${error}`);
      return {
        success: false,
        usersUpdated: 0,
        errors: 0
      };
    }
  }

  /**
   * Выводит накопленные TON с фарминга на баланс пользователя
   * @param userId ID пользователя
   * @returns Результат вывода TON
   */
  async harvestTonFarming(userId: number): Promise<{ 
    success: boolean; 
    message: string; 
    harvestedTon: string; 
    transactionId?: number; 
  }> {
    try {
      // Обновляем баланс фарминга пользователя
      const updateResult = await this.calculateAndUpdateUserTonFarming(userId);

      if (!updateResult.success) {
        return {
          success: false,
          message: "Ошибка при расчете фарминга",
          harvestedTon: "0"
        };
      }

      // Если нет средств для вывода
      if (new BigNumber(updateResult.earnedTon).isLessThanOrEqualTo(0)) {
        return {
          success: false,
          message: "Нет средств для вывода",
          harvestedTon: "0"
        };
      }

      // Получаем пользователя
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));

      if (!user) {
        return {
          success: false,
          message: "Пользователь не найден",
          harvestedTon: "0"
        };
      }

      // Текущий баланс пользователя
      const userBalanceTon = new BigNumber(user.balance_ton || "0");
      const harvestedTon = new BigNumber(updateResult.earnedTon);

      // Обновляем баланс пользователя
      const newBalanceTon = userBalanceTon.plus(harvestedTon);

      await db
        .update(users)
        .set({
          balance_ton: newBalanceTon.toString(),
        })
        .where(eq(users.id, userId));

      // Создаем транзакцию для начисления TON
      const [transaction] = await db
        .insert(transactions)
        .values({
          user_id: userId,
          type: "farming_harvest",
          currency: "TON",
          amount: harvestedTon.toString(),
          status: "confirmed",
          source: "TON Boost", // Источник транзакции
          category: "farming"  // Категория - фарминг
        })
        .returning();

      // Сбрасываем accumulated_ton до 0 для всех активных депозитов пользователя
      // Получаем активные депозиты пользователя
      const activeDeposits = await this.getUserActiveBoosts(userId);

      // Сбрасываем накопленное значение для каждого депозита
      for (const deposit of activeDeposits) {
        console.log(`[TonBoostService] Сброс накопленного TON для депозита ID ${deposit.id}: сброшено ${deposit.accumulated_ton} TON`);

        await db
          .update(tonBoostDeposits)
          .set({
            accumulated_ton: "0",
            last_updated_at: new Date()
          })
          .where(eq(tonBoostDeposits.id, deposit.id));
      }

      // Обрабатываем реферальное вознаграждение от фарминга
      try {
        await this.referralBonusService.processFarmingReferralReward(
          userId,
          parseFloat(harvestedTon.toString()),
          Currency.TON
        );
      } catch (refError) {
        console.error(`[TonBoostService] Ошибка при обработке реферального вознаграждения от фарминга: ${refError}`);
        // Не прерываем основной процесс, если реферальное вознаграждение не удалось начислить
      }

      return {
        success: true,
        message: "Средства успешно выведены на баланс",
        harvestedTon: harvestedTon.toString(),
        transactionId: transaction.id
      };
    } catch (error) {
      console.error(`[TonBoostService] Ошибка при выводе TON фарминга: ${error}`);
      return {
        success: false,
        message: "Произошла ошибка при выводе средств",
        harvestedTon: "0"
      };
    }
  }

  /**
   * Покупает TON буст-пакет для пользователя
   * @param userId ID пользователя
   * @param boostId ID буст-пакета
   * @param paymentMethod Метод оплаты (по умолчанию - внутренний баланс)
   * @returns Результат покупки
   */
  async purchaseTonBoost(
    userId: number, 
    boostId: number, 
    paymentMethod: TonBoostPaymentMethod = TonBoostPaymentMethod.INTERNAL_BALANCE
  ): Promise<PurchaseTonBoostResult> {
    try {
      // Получаем информацию о буст-пакете
      const boostPackage = this.getBoostPackageById(boostId);
      if (!boostPackage) {
        return {
          success: false,
          message: "Выбранный буст-пакет не найден"
        };
      }

      // Получаем информацию о пользователе
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));

      if (!user) {
        return {
          success: false,
          message: "Пользователь не найден"
        };
      }

      // Проверяем метод оплаты
      if (paymentMethod === TonBoostPaymentMethod.INTERNAL_BALANCE) {
        // Проверка баланса пользователя
        const userBalance = new BigNumber(user.balance_ton || "0");
        const packagePrice = new BigNumber(boostPackage.priceTon);

        if (userBalance.isLessThan(packagePrice)) {
          return {
            success: false,
            message: "Недостаточно средств на балансе",
            boostPackage
          };
        }

        // Списываем средства с баланса пользователя
        const newBalance = userBalance.minus(packagePrice);

        await db
          .update(users)
          .set({
            balance_ton: newBalance.toString()
          })
          .where(eq(users.id, userId));

        // Создаем транзакцию списания TON
        const [purchaseTransaction] = await db
          .insert(transactions)
          .values({
            user_id: userId,
            type: "boost_purchase",
            currency: "TON",
            amount: `-${packagePrice.toString()}`, // Отрицательная сумма - списание
            status: "confirmed",
            source: `TON Boost (ID: ${boostId})`,
            category: "boost",
            description: `Покупка TON Boost (${boostPackage.name})`
          })
          .returning();

        // Начисляем бонусные UNI
        const bonusUni = new BigNumber(boostPackage.bonusUni);
        const currentUniBalance = new BigNumber(user.balance_uni || "0");
        const newUniBalance = currentUniBalance.plus(bonusUni);

        await db
          .update(users)
          .set({
            balance_uni: newUniBalance.toString()
          })
          .where(eq(users.id, userId));

        // Создаем транзакцию начисления UNI
        const [bonusTransaction] = await db
          .insert(transactions)
          .values({
            user_id: userId,
            type: "boost_bonus",
            currency: "UNI",
            amount: bonusUni.toString(),
            status: "confirmed",
            source: `TON Boost (ID: ${boostId})`,
            category: "bonus",
            description: `Бонус за покупку TON Boost (${boostPackage.name})`
          })
          .returning();

        // Рассчитываем скорость начисления TON и UNI в секунду
        const { tonRatePerSecond, uniRatePerSecond } = this.calculateRatesPerSecond(
          boostPackage.priceTon,
          boostPackage.rateTon,
          boostPackage.rateUni
        );

        // Создаем запись о депозите TON Boost
        const deposit = await this.createTonBoostDeposit({
          user_id: userId,
          ton_amount: boostPackage.priceTon,
          bonus_uni: boostPackage.bonusUni,
          rate_ton_per_second: tonRatePerSecond,
          rate_uni_per_second: uniRatePerSecond,
          is_active: true
        });

        // Обрабатываем реферальное вознаграждение
        try {
          // Используем метод processFarmingReferralReward для обработки реферального вознаграждения
          // так как он универсальный для разных типов тарнзакций
          console.log(`[TonBoostService] Обрабатываем реферальное вознаграждение от покупки TON Boost`);
          await this.referralBonusService.processFarmingReferralReward(
            userId,
            parseFloat(boostPackage.priceTon),
            Currency.TON
          );
        } catch (refError) {
          console.error(`[TonBoostService] Ошибка при обработке реферального вознаграждения: ${refError}`);
          // Не прерываем основной процесс, если реферальное вознаграждение не удалось начислить
        }

        return {
          success: true,
          message: "TON Boost успешно активирован",
          boostPackage,
          depositId: deposit.id,
          paymentMethod: TonBoostPaymentMethod.INTERNAL_BALANCE,
          purchaseTransaction,
          bonusTransaction,
          transactionId: purchaseTransaction.id
        };
      } else if (paymentMethod === TonBoostPaymentMethod.EXTERNAL_WALLET) {
        // Здесь должен быть код для оплаты через внешний кошелек
        // Это заглушка для интерфейса
        return {
          success: true,
          message: "Для завершения покупки отправьте TON на указанный адрес",
          boostPackage,
          paymentMethod: TonBoostPaymentMethod.EXTERNAL_WALLET,
          paymentStatus: TonBoostExternalPaymentStatus.PENDING,
          paymentLink: `ton://transfer/${TON_WALLET_ADDRESS}?amount=${boostPackage.priceTon}&text=boost_${userId}_${boostId}`
        };
      } else {
        return {
          success: false,
          message: "Неподдерживаемый метод оплаты"
        };
      }
    } catch (error) {
      console.error(`[TonBoostService] Ошибка при покупке TON Boost: ${error}`);
      return {
        success: false,
        message: "Произошла ошибка при активации TON Boost"
      };
    }
  }
}

// Создаем экземпляр сервиса
export const tonBoostServiceInstance = new TonBoostService(referralBonusServiceInstance);

/**
 * Фабричная функция для создания экземпляра сервиса TonBoost
 * Используется для внедрения зависимостей и упрощения тестирования
 * @returns Экземпляр сервиса ITonBoostService
 */
export function createTonBoostService(): ITonBoostService {
  return tonBoostServiceInstance;
}