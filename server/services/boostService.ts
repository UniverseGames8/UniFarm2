/**
 * ВНИМАНИЕ: Используйте импорт из services/index.ts вместо прямого импорта
 * 
 * Этот файл является прокси-оберткой для обратной совместимости.
 * Для новых разработок используйте инстанс boostService из services/index.ts
 */

import { boostServiceInstance } from './boostServiceInstance.js';
export * from './boostServiceInstance.js';

/**
 * @deprecated Используйте инстанс boostService из services/index.ts
 */
export class BoostService {
  /**
   * Получает список всех доступных буст-пакетов
   * @returns Список буст-пакетов
   */
  static getBoostPackages() {
    return boostServiceInstance.getBoostPackages();
  }

  /**
   * Получает буст-пакет по ID
   * @param boostId ID буст-пакета
   * @returns Буст-пакет
   * @throws NotFoundError если буст-пакет не найден
   */
  static getBoostPackageById(boostId: number) {
    return boostServiceInstance.getBoostPackageById(boostId);
  }

  /**
   * Проверяет существование пользователя и возвращает его полный баланс
   * @param userId ID пользователя
   * @returns Объект с балансами пользователя
   * @throws NotFoundError если пользователь не найден
   * @throws DatabaseError в случае ошибки при работе с БД
   */
  static async getUserBalances(userId: number) {
    return boostServiceInstance.getUserBalances(userId);
  }

  /**
   * Получает UNI баланс пользователя
   * @param userId ID пользователя
   * @returns Баланс пользователя в UNI
   * @throws NotFoundError если пользователь не найден
   */
  static async getUserUniBalance(userId: number) {
    return boostServiceInstance.getUserUniBalance(userId);
  }

  /**
   * Получает все активные Boost-депозиты пользователя
   * @param userId ID пользователя
   * @returns Список активных Boost-депозитов с информацией о буст-пакетах
   * @throws NotFoundError если пользователь не найден
   * @throws DatabaseError в случае ошибки при работе с БД
   */
  static async getUserActiveBoosts(userId: number) {
    return boostServiceInstance.getUserActiveBoosts(userId);
  }

  /**
   * Проверяет, достаточно ли у пользователя средств для покупки буст-пакета
   * @param balanceUni Баланс пользователя в UNI
   * @param priceUni Стоимость буст-пакета в UNI
   * @throws InsufficientFundsError если средств недостаточно
   */
  static validateSufficientFunds(balanceUni: string, priceUni: string) {
    return boostServiceInstance.validateSufficientFunds(balanceUni, priceUni);
  }

  /**
   * Покупает буст-пакет для пользователя
   * @param userId ID пользователя
   * @param boostId ID буст-пакета
   * @returns Результат покупки
   * @throws NotFoundError если пользователь или буст-пакет не найден
   * @throws InsufficientFundsError если у пользователя недостаточно средств
   * @throws DatabaseError в случае ошибки при работе с БД
   */
  static async purchaseBoost(userId: number, boostId: number) {
    return boostServiceInstance.purchaseBoost(userId, boostId);
  }
}