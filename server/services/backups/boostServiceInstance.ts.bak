import { db } from '../db.js';
import { users, transactions, farmingDeposits } from '@shared/schema';
import { eq, sql, desc } from 'drizzle-orm';
import { BigNumber } from 'bignumber.js';
import { add } from 'date-fns';
import { 
  DatabaseError, 
  NotFoundError, 
  InsufficientFundsError, 
  ValidationError 
} from '../middleware/errorHandler.js';

// Вспомогательный тип для более безопасной обработки ошибок
type ErrorWithMessage = {
  message: string;
};

/**
 * Модель буст-пакета
 */
export interface BoostPackage {
  id: number;
  name: string;
  priceUni: string;    // Стоимость в UNI
  priceTon: string;    // Стоимость в TON (для будущего использования)
  bonusUni: string;    // Бонус UNI, который получит пользователь
  rateUni: string;     // Доходность в UNI (% в день)
  rateTon: string;     // Доходность в TON (% в день)
}

/**
 * Результат покупки буст-пакета
 */
export interface PurchaseBoostResult {
  success: boolean;
  message: string;
  transactionId?: number;
  depositId?: number;
  package?: BoostPackage;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Расширенные данные о буст-депозите с информацией о пакете
 */
export interface BoostDepositWithPackage {
  id: number;
  userId: number;
  boostId: number;
  startDate: Date;
  endDate: Date;
  packageInfo: BoostPackage;
}

/**
 * Баланс пользователя
 */
export interface UserBalance {
  uniBalance: string;      // Баланс UNI
  tonBalance: string;      // Баланс TON
}

/**
 * Интерфейс сервиса для работы с буст-пакетами и фармингом
 */
export interface IBoostService {
  /**
   * Получает список доступных буст-пакетов
   * @returns Массив буст-пакетов
   */
  getBoostPackages(): BoostPackage[];

  /**
   * Получает буст-пакет по ID
   * @param boostId ID буст-пакета
   * @returns Объект буст-пакета
   * @throws {NotFoundError} Если буст-пакет не найден
   */
  getBoostPackageById(boostId: number): BoostPackage;

  /**
   * Получает балансы пользователя
   * @param userId ID пользователя
   * @returns Объект с балансами UNI и TON
   * @throws {NotFoundError} Если пользователь не найден
   * @throws {DatabaseError} При ошибке запроса к БД
   */
  getUserBalances(userId: number): Promise<UserBalance>;

  /**
   * Получает баланс UNI пользователя
   * @param userId ID пользователя
   * @returns Строковое представление баланса UNI
   * @throws {NotFoundError} Если пользователь не найден
   * @throws {DatabaseError} При ошибке запроса к БД
   */
  getUserUniBalance(userId: number): Promise<string>;

  /**
   * Получает активные буст-депозиты пользователя
   * @param userId ID пользователя
   * @returns Массив буст-депозитов с информацией о пакетах
   * @throws {NotFoundError} Если пользователь не найден
   * @throws {DatabaseError} При ошибке запроса к БД
   */
  getUserActiveBoosts(userId: number): Promise<BoostDepositWithPackage[]>;

  /**
   * Получает активные фарминг-буст пакеты пользователя
   * @param userId ID пользователя
   * @returns Массив буст-депозитов для фарминга
   * @throws {NotFoundError} Если пользователь не найден
   * @throws {DatabaseError} При ошибке запроса к БД
   */
  getUserFarmingBoosts(userId: number): Promise<any[]>;

  /**
   * Получает историю покупки буст-пакетов пользователя
   * @param userId ID пользователя
   * @returns История покупок буст-пакетов
   * @throws {NotFoundError} Если пользователь не найден
   * @throws {DatabaseError} При ошибке запроса к БД
   */
  getUserBoostHistory(userId: number): Promise<any[]>;

  /**
   * Проверяет достаточность средств для покупки
   * @param balanceUni Текущий баланс UNI пользователя
   * @param priceUni Стоимость пакета в UNI
   * @throws {InsufficientFundsError} Если баланса недостаточно
   */
  validateSufficientFunds(balanceUni: string, priceUni: string): void;

  /**
   * Покупает буст-пакет для пользователя
   * @param userId ID пользователя
   * @param boostId ID буст-пакета
   * @returns Результат покупки
   * @throws {NotFoundError} Если пользователь или буст-пакет не найдены
   * @throws {InsufficientFundsError} Если баланса недостаточно
   * @throws {DatabaseError} При ошибке транзакции в БД
   */
  purchaseBoost(userId: number, boostId: number): Promise<PurchaseBoostResult>;
}

/**
 * Реализация сервиса для работы с буст-пакетами и фармингом
 */
class BoostServiceImpl implements IBoostService {
  /**
   * Список доступных буст-пакетов (унифицировано с фронтендом)
   * @private
   */
  private readonly boostPackages: BoostPackage[] = [
    {
      id: 1,
      name: 'Starter Boost',
      priceUni: '100000',
      priceTon: '1',
      bonusUni: '10000',
      rateUni: '0.0', // Доходность только в TON
      rateTon: '0.5'
    },
    {
      id: 2,
      name: 'Standard Boost',
      priceUni: '500000',
      priceTon: '5',
      bonusUni: '75000',
      rateUni: '0.0', // Доходность только в TON
      rateTon: '1.0'
    },
    {
      id: 3,
      name: 'Advanced Boost',
      priceUni: '1500000',
      priceTon: '15',
      bonusUni: '250000',
      rateUni: '0.0', // Доходность только в TON
      rateTon: '2.0'
    },
    {
      id: 4,
      name: 'Premium Boost',
      priceUni: '2500000',
      priceTon: '25',
      bonusUni: '500000',
      rateUni: '0.0', // Доходность только в TON
      rateTon: '2.5'
    }
  ];

  /**
   * Получает список доступных буст-пакетов
   * @returns Массив буст-пакетов
   */
  getBoostPackages(): BoostPackage[] {
    return this.boostPackages;
  }

  /**
   * Получает буст-пакет по ID
   * @param boostId ID буст-пакета
   * @returns Объект буст-пакета
   * @throws {NotFoundError} Если буст-пакет не найден
   */
  getBoostPackageById(boostId: number): BoostPackage {
    const boostPackage = this.boostPackages.find(p => p.id === boostId);
    if (!boostPackage) {
      throw new NotFoundError(`Boost package with ID ${boostId} not found`);
    }
    return boostPackage;
  }

  /**
   * Получает балансы пользователя
   * @param userId ID пользователя
   * @returns Объект с балансами UNI и TON
   * @throws {NotFoundError} Если пользователь не найден
   * @throws {DatabaseError} При ошибке запроса к БД
   */
  async getUserBalances(userId: number): Promise<UserBalance> {
    try {
      const [user] = await db.select({
        balance_uni: users.balance_uni,
        balance_ton: users.balance_ton
      }).from(users).where(eq(users.id, userId));

      if (!user) {
        throw new NotFoundError(`User with ID ${userId} not found`);
      }

      return {
        uniBalance: user.balance_uni || '0',
        tonBalance: user.balance_ton || '0'
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      const err = error as ErrorWithMessage;
      throw new DatabaseError(`Failed to get user balances: ${err.message}`);
    }
  }

  /**
   * Получает баланс UNI пользователя
   * @param userId ID пользователя
   * @returns Строковое представление баланса UNI
   * @throws {NotFoundError} Если пользователь не найден
   * @throws {DatabaseError} При ошибке запроса к БД
   */
  async getUserUniBalance(userId: number): Promise<string> {
    const { uniBalance } = await this.getUserBalances(userId);
    return uniBalance;
  }

  /**
   * Получает активные буст-депозиты пользователя
   * @param userId ID пользователя
   * @returns Массив буст-депозитов с информацией о пакетах
   * @throws {NotFoundError} Если пользователь не найден
   * @throws {DatabaseError} При ошибке запроса к БД
   */
  async getUserActiveBoosts(userId: number): Promise<BoostDepositWithPackage[]> {
    try {
      // Сначала проверяем, существует ли пользователь
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        throw new NotFoundError(`User with ID ${userId} not found`);
      }

      // Получаем активные депозиты
      const currentDate = new Date();
      const deposits = await db.select()
        .from(farmingDeposits)
        .where(
          sql`${farmingDeposits.user_id} = ${userId} AND 
              ${farmingDeposits.deposit_type} LIKE 'boost_%' AND 
              (${farmingDeposits.expires_at} IS NULL OR ${farmingDeposits.expires_at} > ${currentDate})`
        )
        .orderBy(desc(farmingDeposits.created_at));

      // Преобразуем результаты запроса в нужный формат
      const boostedDeposits: BoostDepositWithPackage[] = deposits.map(deposit => {
        const boostId = Number(deposit.boost_id) || 1;
        const packageInfo = this.getBoostPackageById(boostId);

        return {
          id: deposit.id,
          userId: deposit.user_id || 0,
          boostId: boostId,
          startDate: deposit.created_at || new Date(),
          endDate: deposit.expires_at || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          packageInfo
        };
      });

      return boostedDeposits;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      const err = error as ErrorWithMessage;
      throw new DatabaseError(`Failed to get user active boosts: ${err.message}`);
    }
  }

  /**
   * Проверяет достаточность средств для покупки
   * @param balanceUni Текущий баланс UNI пользователя
   * @param priceUni Стоимость пакета в UNI
   * @throws {InsufficientFundsError} Если баланса недостаточно
   */
  validateSufficientFunds(balanceUni: string, priceUni: string): void {
    const balance = new BigNumber(balanceUni);
    const price = new BigNumber(priceUni);

    if (balance.isLessThan(price)) {
      throw new InsufficientFundsError(
        `Insufficient UNI balance. Required: ${priceUni}, Available: ${balanceUni}`,
        balanceUni,
        'UNI'
      );
    }
  }

  /**
   * Создает запись о буст-депозите
   * @param userId ID пользователя
   * @param boostId ID буст-пакета
   * @param startDate Дата начала буста
   * @param endDate Дата окончания буста
   * @param bonusUni Бонусные UNI
   * @returns ID созданного депозита
   * @private
   */
  private async createBoostDeposit(
    userId: number,
    boostId: number,
    startDate: Date,
    endDate: Date,
    bonusUni: string
  ): Promise<number> {
    try {
      const depositType = `boost_${boostId}`;
      const [deposit] = await db.insert(farmingDeposits).values({
        user_id: userId,
        amount_uni: bonusUni,
        rate_uni: '0',
        rate_ton: this.getBoostPackageById(boostId).rateTon,
        last_claim: startDate,
        is_boosted: true,
        deposit_type: depositType,
        boost_id: boostId,
        expires_at: endDate
      }).returning({ id: farmingDeposits.id });

      return deposit.id;
    } catch (error) {
      const err = error as ErrorWithMessage;
      throw new DatabaseError(`Failed to create boost deposit: ${err.message}`);
    }
  }

  /**
   * Создает запись о транзакции покупки буста
   * @param userId ID пользователя
   * @param amount Сумма списания UNI
   * @param boostId ID буст-пакета
   * @param depositId ID связанного депозита
   * @returns ID созданной транзакции
   * @private
   */
  private async createBoostTransaction(
    userId: number,
    amount: string,
    boostId: number,
    depositId: number
  ): Promise<number> {
    try {
      const [transaction] = await db.insert(transactions).values({
        user_id: userId,
        type: 'boost_purchase',
        currency: 'UNI',
        amount: amount,
        status: 'confirmed',
        description: `Boost package purchase (ID: ${boostId})`,
        category: 'boost',
        source: 'boost_purchase',
        data: JSON.stringify({
          boost_id: boostId,
          deposit_id: depositId
        })
      }).returning({ id: transactions.id });

      return transaction.id;
    } catch (error) {
      const err = error as ErrorWithMessage;
      throw new DatabaseError(`Failed to create boost transaction: ${err.message}`);
    }
  }

  /**
   * Обновляет баланс пользователя
   * @param userId ID пользователя
   * @param uniAmount Сумма списания (отрицательная) или начисления (положительная)
   * @private
   */
  private async updateUserBalance(
    userId: number,
    uniAmount: string
  ): Promise<void> {
    try {
      await db.update(users)
        .set({
          balance_uni: sql`${users.balance_uni} + ${uniAmount}`
        })
        .where(eq(users.id, userId));
    } catch (error) {
      const err = error as ErrorWithMessage;
      throw new DatabaseError(`Failed to update user balance: ${err.message}`);
    }
  }

  /**
   * Получает активные фарминг-буст пакеты пользователя
   * @param userId ID пользователя
   * @returns Массив буст-депозитов для фарминга
   * @throws {NotFoundError} Если пользователь не найден
   * @throws {DatabaseError} При ошибке запроса к БД
   */
  async getUserFarmingBoosts(userId: number): Promise<any[]> {
    try {
      // Получаем активные буст-депозиты пользователя
      const activeBoosts = await this.getUserActiveBoosts(userId);
      
      // Преобразуем их в формат для API
      return activeBoosts.map(boost => ({
        id: boost.id,
        userId: boost.userId,
        boostId: boost.boostId,
        packageName: boost.packageInfo.name,
        startDate: boost.startDate,
        endDate: boost.endDate,
        rateUni: boost.packageInfo.rateUni,
        rateTon: boost.packageInfo.rateTon
      }));
    } catch (error) {
      console.error('[BoostService] Ошибка при получении фарминг-бустов пользователя:', error);
      throw error;
    }
  }

  /**
   * Получает историю покупки буст-пакетов пользователя
   * @param userId ID пользователя
   * @returns История покупок буст-пакетов
   * @throws {NotFoundError} Если пользователь не найден
   * @throws {DatabaseError} При ошибке запроса к БД
   */
  async getUserBoostHistory(userId: number): Promise<any[]> {
    try {
      // Запрос к БД для получения истории покупок буст-пакетов
      const result = await db.execute(sql`
        SELECT 
          bd.id, 
          bd.user_id, 
          bd.boost_id, 
          bd.start_date, 
          bd.end_date,
          t.amount,
          t.created_at as purchase_date
        FROM 
          boost_deposits bd
        JOIN 
          transactions t ON t.deposit_id = bd.id
        WHERE 
          bd.user_id = ${userId}
        ORDER BY 
          t.created_at DESC
      `);
      
      // Обогащаем данные информацией о буст-пакетах
      return result.rows.map((row: any) => {
        const boostPackage = this.getBoostPackageById(row.boost_id);
        return {
          id: row.id,
          userId: row.user_id,
          boostId: row.boost_id,
          packageName: boostPackage.name,
          startDate: row.start_date,
          endDate: row.end_date,
          purchaseDate: row.purchase_date,
          amount: row.amount,
          price: boostPackage.priceUni,
          bonus: boostPackage.bonusUni
        };
      });
    } catch (error) {
      console.error('[BoostService] Ошибка при получении истории буст-пакетов пользователя:', error);
      throw error;
    }
  }

  /**
   * Покупает буст-пакет для пользователя
   * @param userId ID пользователя
   * @param boostId ID буст-пакета
   * @returns Результат покупки
   * @throws {NotFoundError} Если пользователь или буст-пакет не найдены
   * @throws {InsufficientFundsError} Если баланса недостаточно
   * @throws {DatabaseError} При ошибке транзакции в БД
   */
  async purchaseBoost(userId: number, boostId: number): Promise<PurchaseBoostResult> {
    try {
      // 1. Получаем информацию о пакете
      const boostPackage = this.getBoostPackageById(boostId);

      // 2. Получаем баланс пользователя
      const uniBalance = await this.getUserUniBalance(userId);

      // 3. Проверяем достаточность средств
      this.validateSufficientFunds(uniBalance, boostPackage.priceUni);

      // 4. Вычисляем даты начала и окончания буста (30 дней)
      const startDate = new Date();
      const endDate = add(startDate, { days: 30 });

      // 5. Сумма для списания с баланса (отрицательная)
      const debitAmount = `-${boostPackage.priceUni}`;

      // 6. Сумма бонуса для зачисления
      const bonusAmount = boostPackage.bonusUni;

      // Выполняем операции в транзакции
      let depositId: number;
      let transactionId: number;

      try {
        // 7. Создаем запись о депозите
        depositId = await this.createBoostDeposit(
          userId,
          boostId,
          startDate,
          endDate,
          bonusAmount
        );

        // 8. Создаем запись о транзакции
        transactionId = await this.createBoostTransaction(
          userId,
          debitAmount,
          boostId,
          depositId
        );

        // 9. Обновляем баланс пользователя
        await this.updateUserBalance(userId, debitAmount);

        // 10. Зачисляем бонус
        await this.updateUserBalance(userId, bonusAmount);

        return {
          success: true,
          message: `Successfully purchased ${boostPackage.name}`,
          transactionId,
          depositId,
          package: boostPackage,
          startDate,
          endDate
        };
      } catch (error) {
        const err = error as ErrorWithMessage;
        throw new DatabaseError(`Failed to complete boost purchase: ${err.message}`);
      }
    } catch (error) {
      if (
        error instanceof NotFoundError ||
        error instanceof InsufficientFundsError ||
        error instanceof DatabaseError
      ) {
        return {
          success: false,
          message: error.message
        };
      }
      const err = error as ErrorWithMessage;
      return {
        success: false,
        message: `Unexpected error: ${err.message}`
      };
    }
  }
}

/**
 * Создает экземпляр сервиса для работы с буст-пакетами
 * @returns Экземпляр IBoostService
 */
export function createBoostService(): IBoostService {
  return new BoostServiceImpl();
}

/**
 * Экспортируем экземпляр сервиса для использования в приложении
 */
export const boostServiceInstance = createBoostService();