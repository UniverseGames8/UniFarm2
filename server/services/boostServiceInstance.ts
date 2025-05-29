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
      throw new NotFoundError(`Буст-пакет с ID ${boostId} не найден`);
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
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: {
          balance_uni: true,
          balance_ton: true
        }
      });

      if (!user) {
        throw new NotFoundError(`Пользователь с ID ${userId} не найден`);
      }

      return {
        uniBalance: user.balance_uni ?? '0',
        tonBalance: user.balance_ton ?? '0'
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      const err = error as ErrorWithMessage;
      throw new DatabaseError(`Ошибка при получении балансов пользователя: ${err.message}`);
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
    try {
      const balances = await this.getUserBalances(userId);
      return balances.uniBalance;
    } catch (error) {
      throw error; // Пробрасываем ошибку дальше
    }
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
      // Проверяем существование пользователя
      const userExists = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: {
          id: true
        }
      });

      if (!userExists) {
        throw new NotFoundError(`Пользователь с ID ${userId} не найден`);
      }

      // Текущая дата для сравнения с датой окончания
      const currentDate = new Date();
      
      // Получаем активные буст-депозиты (действующие на текущий момент)
      const result = await db.execute(sql`
        SELECT id, user_id, boost_id, start_date, end_date
        FROM boost_deposits
        WHERE user_id = ${userId}
          AND end_date > ${currentDate}
        ORDER BY end_date DESC
      `);

      // Обогащаем данные информацией о пакетах
      return result.rows.map((row: any) => {
        try {
          const boostPackage = this.getBoostPackageById(Number(row.boost_id));
          return {
            id: Number(row.id),
            userId: Number(row.user_id),
            boostId: Number(row.boost_id),
            startDate: new Date(row.start_date),
            endDate: new Date(row.end_date),
            packageInfo: boostPackage
          };
        } catch (error) {
          console.error(`[BoostService] Ошибка при обработке буст-депозита ${row.id}:`, error);
          // Если пакет не найден, возвращаем информацию без деталей пакета
          const fallbackPackage: BoostPackage = {
            id: Number(row.boost_id),
            name: 'Неизвестный буст',
            priceUni: '0',
            priceTon: '0',
            bonusUni: '0',
            rateUni: '0',
            rateTon: '0'
          };
          
          return {
            id: Number(row.id),
            userId: Number(row.user_id),
            boostId: Number(row.boost_id),
            startDate: new Date(row.start_date),
            endDate: new Date(row.end_date),
            packageInfo: fallbackPackage
          };
        }
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      const err = error as ErrorWithMessage;
      throw new DatabaseError(`Ошибка при получении активных буст-депозитов: ${err.message}`);
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
      const result = await db.execute(sql`
        INSERT INTO boost_deposits (user_id, boost_id, start_date, end_date, bonus_uni)
        VALUES (${userId}, ${boostId}, ${startDate}, ${endDate}, ${bonusUni})
        RETURNING id
      `);
      
      if (result.rows.length === 0) {
        throw new Error('Insert did not return ID');
      }
      
      return Number(result.rows[0].id);
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
      const result = await db.execute(sql`
        INSERT INTO transactions 
        (user_id, amount, type, status, category, description, deposit_id)
        VALUES 
        (${userId}, ${amount}, 'purchase', 'completed', 'boost', 
         ${`Покупка буст-пакета #${boostId}`}, ${depositId})
        RETURNING id
      `);
      
      if (result.rows.length === 0) {
        throw new Error('Insert did not return ID');
      }
      
      return Number(result.rows[0].id);
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
        try {
          const boostPackage = this.getBoostPackageById(Number(row.boost_id));
          return {
            id: Number(row.id),
            userId: Number(row.user_id),
            boostId: Number(row.boost_id),
            packageName: boostPackage.name,
            startDate: row.start_date ? new Date(row.start_date) : null,
            endDate: row.end_date ? new Date(row.end_date) : null,
            purchaseDate: row.purchase_date ? new Date(row.purchase_date) : null,
            amount: row.amount,
            price: boostPackage.priceUni,
            bonus: boostPackage.bonusUni
          };
        } catch (error) {
          console.warn(`[BoostService] Не найден пакет буста ${row.boost_id} при получении истории:`, error);
          return {
            id: Number(row.id),
            userId: Number(row.user_id),
            boostId: Number(row.boost_id),
            packageName: 'Неизвестный буст',
            startDate: row.start_date ? new Date(row.start_date) : null,
            endDate: row.end_date ? new Date(row.end_date) : null,
            purchaseDate: row.purchase_date ? new Date(row.purchase_date) : null,
            amount: row.amount,
            price: '0',
            bonus: '0'
          };
        }
      });
    } catch (error) {
      console.error('[BoostService] Ошибка при получении истории буст-пакетов пользователя:', error);
      throw error;
    }
  }

  /**
   * Проверяет достаточность средств для покупки
   * @param balanceUni Текущий баланс UNI пользователя
   * @param priceUni Стоимость пакета в UNI
   * @throws {InsufficientFundsError} Если баланса недостаточно
   */
  validateSufficientFunds(balanceUni: string, priceUni: string): void {
    const bnBalance = new BigNumber(balanceUni);
    const bnPrice = new BigNumber(priceUni);
    
    if (bnBalance.isLessThan(bnPrice)) {
      throw new InsufficientFundsError(
        'Недостаточно средств на балансе',
        {
          balance: balanceUni,
          required: priceUni,
          deficit: bnPrice.minus(bnBalance).toString(),
          currency: 'UNI'
        }
      );
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
      const balanceUni = await this.getUserUniBalance(userId);
      
      // 3. Проверяем достаточность средств
      this.validateSufficientFunds(balanceUni, boostPackage.priceUni);
      
      // 4. Рассчитываем даты начала и окончания
      const startDate = new Date();
      const endDate = add(startDate, { days: 30 }); // Срок действия буста - 30 дней
      
      // 5. Создаем запись о депозите
      const depositId = await this.createBoostDeposit(
        userId, 
        boostId, 
        startDate, 
        endDate,
        boostPackage.bonusUni
      );
      
      // 6. Списываем средства с баланса пользователя
      const negativeAmount = new BigNumber(boostPackage.priceUni).negated().toString();
      await this.updateUserBalance(userId, negativeAmount);
      
      // 7. Создаем запись о транзакции
      const transactionId = await this.createBoostTransaction(
        userId,
        negativeAmount,
        boostId,
        depositId
      );
      
      // 8. Насчитываем бонус UNI
      await this.updateUserBalance(userId, boostPackage.bonusUni);
      
      // 9. Возвращаем результат
      return {
        success: true,
        message: `Успешная покупка буст-пакета "${boostPackage.name}"`,
        transactionId,
        depositId,
        package: boostPackage,
        startDate,
        endDate
      };
    } catch (error) {
      if (error instanceof NotFoundError || 
          error instanceof InsufficientFundsError) {
        throw error;
      }
      const err = error as ErrorWithMessage;
      throw new DatabaseError(`Ошибка при покупке буст-пакета: ${err.message}`);
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