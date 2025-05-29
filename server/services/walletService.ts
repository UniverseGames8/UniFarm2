/**
 * Прокси-модуль для доступа к сервису работы с кошельками
 * 
 * Этот файл использует паттерн прокси для перенаправления вызовов статических методов
 * к методам экземпляра IWalletService из walletServiceInstance.
 * 
 * Такой подход позволяет сохранить обратную совместимость с кодом, использующим
 * статические методы, но при этом использовать преимущества инстанс-паттерна.
 */

import { 
  walletServiceInstance,
  IWalletService,
  WalletCurrency,
  BalanceOperationType,
  TransactionStatusType,
  GetTransactionsParams,
  WithdrawRequest,
  DepositRequest,
  WalletBindRequest,
  WalletOperationResult,
  WalletInfo,
  AddressValidationResult,
  UserTransaction
} from './walletServiceInstance.js';
import { NotFoundError, ValidationError, InsufficientFundsError } from '../middleware/errorHandler.js';
import { TransactionType, TransactionCategory } from './transactionService.js';

// Реэкспорт типов для обратной совместимости
export { 
  WalletCurrency,
  BalanceOperationType,
  TransactionStatusType,
  type GetTransactionsParams,
  type WithdrawRequest,
  type DepositRequest,
  type WalletBindRequest,
  type WalletOperationResult,
  type WalletInfo,
  type AddressValidationResult,
  type UserTransaction
};

/**
 * Сервис для работы с кошельком пользователя
 * Обеспечивает все операции с балансом и транзакциями пользователей
 * в соответствии с принципами SOLID
 */
export class WalletService {
  /**
   * Получает информацию о кошельке пользователя
   * @param userId ID пользователя
   * @returns Полная информация о кошельке пользователя
   * @throws {NotFoundError} если пользователь не найден
   */
  static async getWalletInfo(userId: number): Promise<WalletInfo> {
    return await walletServiceInstance.getWalletInfo(userId);
  }

  /**
   * Получает адрес TON-кошелька пользователя
   * @param userId ID пользователя
   * @returns Объект с ID пользователя и адресом кошелька
   * @throws {NotFoundError} если пользователь не найден
   */
  static async getWalletAddress(userId: number): Promise<{ userId: number; walletAddress: string | null }> {
    return await walletServiceInstance.getWalletAddress(userId);
  }
  
  /**
   * Проверяет уникальность адреса TON-кошелька
   * @param walletAddress Адрес TON-кошелька для проверки
   * @param currentUserId ID текущего пользователя (исключается из проверки)
   * @returns true, если адрес уникален или принадлежит currentUserId
   * @throws {ValidationError} если адрес уже привязан к другому пользователю
   */
  static async checkWalletAddressAvailability(walletAddress: string, currentUserId: number): Promise<boolean> {
    return await walletServiceInstance.checkWalletAddressAvailability(walletAddress, currentUserId);
  }
  
  /**
   * Обновляет адрес TON-кошелька пользователя
   * @param userId ID пользователя
   * @param walletAddress Новый адрес TON-кошелька
   * @returns Обновленная информация о пользователе
   * @throws {NotFoundError} если пользователь не найден
   * @throws {ValidationError} если адрес недопустим
   */
  static async updateWalletAddress(userId: number, walletAddress: string): Promise<{ userId: number; walletAddress: string }> {
    return await walletServiceInstance.updateWalletAddress(userId, walletAddress);
  }

  /**
   * Получает баланс пользователя
   * @param userId ID пользователя
   * @returns Объект с балансами UNI и TON
   * @throws {NotFoundError} если пользователь не найден
   */
  static async getUserBalance(userId: number): Promise<{ balanceUni: string; balanceTon: string }> {
    return await walletServiceInstance.getUserBalance(userId);
  }
  
  /**
   * Обновляет баланс пользователя
   * @param userId ID пользователя
   * @param amount Сумма для изменения баланса (может быть отрицательной)
   * @param currency Валюта (UNI или TON)
   * @param transactionType Тип транзакции
   * @param params Дополнительные параметры транзакции
   * @returns Обновленный баланс пользователя
   * @throws {NotFoundError} если пользователь не найден
   * @throws {InsufficientFundsError} если недостаточно средств для снятия
   */
  static async updateBalance(
    userId: number,
    amount: number, 
    currency: WalletCurrency,
    transactionType: string,
    params: {
      walletAddress?: string | null;
      source?: string;
      category?: string;
      txHash?: string;
      status?: TransactionStatusType;
    } = {}
  ): Promise<{ newBalance: string; transactionId: number }> {
    return await walletServiceInstance.updateBalance(userId, amount, currency, transactionType, params);
  }

  /**
   * Проверяет формат TON-адреса
   * @param address Адрес TON-кошелька
   * @returns Результат проверки с флагом и сообщением
   */
  static validateTonAddress(address: string): AddressValidationResult {
    return walletServiceInstance.validateTonAddress(address);
  }

  /**
   * Регистрирует депозит средств
   * @param request Параметры пополнения
   * @returns Результат операции пополнения
   * @throws {NotFoundError} если пользователь не найден
   * @throws {ValidationError} если параметры некорректны
   */
  static async depositFunds(request: DepositRequest): Promise<WalletOperationResult> {
    return await walletServiceInstance.depositFunds(request);
  }

  /**
   * Выводит средства с кошелька пользователя
   * @param request Параметры вывода средств
   * @returns Результат операции вывода
   * @throws {NotFoundError} если пользователь не найден
   * @throws {ValidationError} если параметры некорректны
   * @throws {InsufficientFundsError} если недостаточно средств
   */
  static async withdrawFunds(request: WithdrawRequest): Promise<WalletOperationResult> {
    return await walletServiceInstance.withdrawFunds(request);
  }
  
  /**
   * Подтверждает транзакцию вывода средств
   * @param transactionId ID транзакции для подтверждения
   * @param txHash Хеш транзакции в блокчейне (если есть)
   * @returns Обновленная транзакция
   * @throws {NotFoundError} если транзакция не найдена
   * @throws {ValidationError} если транзакция не является выводом или имеет неподходящий статус
   */
  static async confirmWithdrawal(transactionId: number, txHash?: string): Promise<UserTransaction> {
    return await walletServiceInstance.confirmWithdrawal(transactionId, txHash);
  }
  
  /**
   * Отклоняет транзакцию вывода средств и делает возврат средств
   * @param transactionId ID транзакции для отклонения
   * @param reason Причина отклонения
   * @returns Обновленная транзакция и транзакция возврата
   * @throws {NotFoundError} если транзакция не найдена
   * @throws {ValidationError} если транзакция не является выводом или имеет неподходящий статус
   */
  static async rejectWithdrawal(transactionId: number, reason: string): Promise<{ transaction: UserTransaction; refund: UserTransaction }> {
    return await walletServiceInstance.rejectWithdrawal(transactionId, reason);
  }
  
  /**
   * Получает транзакции пользователя
   * @param params Параметры запроса
   * @returns Массив транзакций и общее количество
   */
  static async getUserTransactions(params: GetTransactionsParams): Promise<{ transactions: UserTransaction[]; total: number }> {
    return await walletServiceInstance.getUserTransactions(params);
  }
  
  /**
   * Получает транзакции TON Boost для пользователя
   * @param userId ID пользователя
   * @returns Массив транзакций TON Boost
   */
  static async getUserTonBoostTransactions(userId: number): Promise<any[]> {
    return await walletServiceInstance.getUserTonBoostTransactions(userId);
  }
}