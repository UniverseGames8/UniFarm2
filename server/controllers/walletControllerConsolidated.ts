import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import 'express-session';
import { walletService, validationService } from '../services';
import { walletServiceInstance } from '../services/walletServiceInstance';
import { WalletCurrency, TransactionStatusType } from '../services/walletService';
import { ValidationError, NotFoundError } from '../middleware/errorHandler';
import { createValidationErrorFromZod, extractUserId, formatZodErrors } from '../utils/validationUtils';
import { DatabaseService } from "../db-service-wrapper";
import { userIdSchema } from '../validators/schemas';
import { sendSuccess } from '../utils/responseUtils';

// Типизация для доступа к свойствам сессии
declare module 'express-session' {
  interface SessionData {
    userId?: number;
    user?: {
      id: number;
      username: string;
      ref_code?: string;
      guest_id?: string;
    };
  }
}

/**
 * Консолидированный контроллер для работы с TON-кошельками пользователей
 * Делегирует всю бизнес-логику WalletService
 * Поддерживает работу в fallback режиме при отсутствии соединения с БД
 */
export class WalletController {
  /**
   * Получает баланс кошелька пользователя
   * @route GET /api/wallet/balance
   */
  static async getWalletBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Проверка заголовков разработки
      const isDevelopmentMode = process.env.NODE_ENV === 'development' || req.headers['x-development-mode'] === 'true';
      
      // Валидация параметров запроса
      let validationResult;
      let user_id;
      
      if (isDevelopmentMode && req.headers['x-development-user-id']) {
        // В режиме разработки можем использовать ID из заголовков
        user_id = Number(req.headers['x-development-user-id']);
        if (isNaN(user_id)) {
          return next(new ValidationError('Некорректный ID пользователя в заголовке'));
        }
      } else {
        // Проверка пользователя из сессии или query
        validationResult = userIdSchema.safeParse(req.query);
        if (!validationResult.success) {
          return next(new ValidationError(formatZodErrors(validationResult.error)));
        }
        user_id = validationResult.data.user_id;
      }

      // Заворачиваем вызов сервиса в обработчик ошибок для поддержки fallback режима
      const getBalanceWithFallback = DatabaseService(
        async (userId) => await walletService.getUserBalance(userId),
        async (error, userId) => {
          console.log(`[WalletControllerFallback] Возвращаем заглушку для баланса по ID: ${userId}`);
          return { 
            balanceUni: "0",
            balanceTon: "0"
          };
        }
      );

      const balance = await getBalanceWithFallback(user_id);
      
      // Логируем успешное получение баланса
      console.log(`[WALLET BALANCE REQUEST] User ${user_id} balance retrieved:`, JSON.stringify(balance));
      
      // Возвращаем в стандартизированном формате API
      sendSuccess(res, balance);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Привязывает TON-кошелек к аккаунту пользователя
   * @route POST /api/wallet/connect
   */
  static async connectWallet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user_id, wallet_address } = req.body;

      if (!user_id || !wallet_address) {
        return next(new ValidationError('Не указаны обязательные параметры: user_id, wallet_address'));
      }

      // Валидация User ID
      const userId = Number(user_id);
      if (isNaN(userId)) {
        return next(new ValidationError('Некорректный ID пользователя'));
      }

      // Валидация формата TON-адреса
      const addressValidation = walletServiceInstance.validateTonAddress(wallet_address);
      if (!addressValidation.isValid) {
        return next(new ValidationError(addressValidation.message || 'Некорректный формат TON-адреса'));
      }

      // Заворачиваем вызов сервиса в обработчик ошибок для поддержки fallback режима
      const connectWalletWithFallback = DatabaseService(
        async (userId: number, address: string) => await walletServiceInstance.updateWalletAddress(userId, address),
        async (error, ...args) => {
          console.error('[WalletControllerFallback] Ошибка при подключении кошелька:', error);
          return { 
            success: false, 
            error: "Временно невозможно подключить кошелек. Пожалуйста, попробуйте позже." 
          };
        }
      );

      const result = await connectWalletWithFallback(userId, wallet_address);
      
      // Логируем подключение кошелька
      console.log(`[TON CONNECT SUCCESS] User ${userId} connected wallet: ${wallet_address}`);
      
      // Возвращаем в стандартизированном формате API
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Отвязывает TON-кошелек от аккаунта пользователя
   * @route POST /api/wallet/disconnect
   */
  static async disconnectWallet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user_id } = req.body;

      if (!user_id) {
        return next(new ValidationError('Не указан обязательный параметр: user_id'));
      }

      const userId = Number(user_id);
      if (isNaN(userId)) {
        return next(new ValidationError('Некорректный ID пользователя'));
      }

      // Заворачиваем вызов сервиса в обработчик ошибок для поддержки fallback режима
      const disconnectWalletWithFallback = DatabaseService(
        walletService.disconnectWallet.bind(walletService),
        async (error, ...args) => {
          console.error('[WalletControllerFallback] Ошибка при отключении кошелька:', error);
          return { 
            success: false, 
            error: "Временно невозможно отключить кошелек. Пожалуйста, попробуйте позже." 
          };
        }
      );

      const result = await disconnectWalletWithFallback(userId);
      return res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Получает историю транзакций пользователя
   * @route GET /api/wallet/transactions
   */
  static async getTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Валидация параметров запроса
      const validationResult = userIdSchema.safeParse(req.query);
      if (!validationResult.success) {
        return next(createValidationErrorFromZod(validationResult.error));
      }

      const { user_id } = validationResult.data;
      const limit = Number(req.query.limit) || 50;
      const offset = Number(req.query.offset) || 0;
      const currency = (req.query.currency as string) || 'all';

      if (currency !== 'all' && currency !== WalletCurrency.UNI && currency !== WalletCurrency.TON) {
        return next(new ValidationError(`Неподдерживаемая валюта: ${currency}`));
      }

      // Заворачиваем вызов сервиса в обработчик ошибок для поддержки fallback режима
      const getTransactionsWithFallback = DatabaseService(
        async (userId: number, limit: number, offset: number) => {
          return await walletServiceInstance.getUserTransactions({ userId, limit, offset });
        },
        async (error, ...args) => {
          console.error('[WalletControllerFallback] Ошибка при получении транзакций:', error);
          return { 
            transactions: [],
            total: 0
          };
        }
      );

      const result = await getTransactionsWithFallback(user_id, limit, offset);
      
      // Логируем запрос транзакций
      console.log(`[WALLET TRANSACTIONS REQUEST] User ${user_id} transactions retrieved: ${result.transactions.length} items`);
      
      // Возвращаем в стандартизированном формате API
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Выводит UNI-токены на TON-кошелек
   * @route POST /api/wallet/withdraw
   */
  static async withdrawUni(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schema = z.object({
        user_id: z.number().int().positive(),
        amount: z.number().positive(),
        ton_address: z.string().min(5).max(100).optional(),
      });

      const validationResult = schema.safeParse(req.body);
      if (!validationResult.success) {
        return next(new ValidationError(formatZodErrors(validationResult.error)));
      }

      const { user_id, amount, ton_address } = validationResult.data;

      // Заворачиваем вызов сервиса в обработчик ошибок для поддержки fallback режима
      const withdrawUniWithFallback = DatabaseService(
        walletService.withdrawUni.bind(walletService),
        async (error, ...args) => {
          console.error('[WalletControllerFallback] Ошибка при выводе UNI:', error);
          return { 
            success: false, 
            error: "Временно невозможно выполнить вывод UNI. Пожалуйста, попробуйте позже." 
          };
        }
      );

      const result = await withdrawUniWithFallback({
        userId: user_id,
        amount: amount,
        currency: 'UNI',
        walletAddress: ton_address || null
      });
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Получает статус транзакции по её ID
   * @route GET /api/wallet/transaction/:id
   */
  static async getTransactionStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const transaction_id = req.params.id;
      if (!transaction_id) {
        return next(new ValidationError('Не указан ID транзакции'));
      }

      // Заворачиваем вызов сервиса в обработчик ошибок для поддержки fallback режима
      const getTransactionStatusWithFallback = DatabaseService(
        walletService.getTransactionStatus.bind(walletService),
        async (error, transaction_id) => {
          console.log(`[WalletControllerFallback] Возвращаем заглушку для статуса транзакции: ${transaction_id}`);
          return { 
            success: true, 
            data: {
              id: transaction_id,
              status: TransactionStatusType.PENDING,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          };
        }
      );

      const status = await getTransactionStatusWithFallback(transaction_id);
      return res.json(status);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Отменяет транзакцию по её ID (если возможно)
   * @route POST /api/wallet/transaction/:id/cancel
   */
  static async cancelTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const transaction_id = req.params.id;
      if (!transaction_id) {
        return next(new ValidationError('Не указан ID транзакции'));
      }

      // Валидация User ID
      const user_id = extractUserId(req);
      if (!user_id) {
        return next(new ValidationError('Не удалось определить пользователя'));
      }

      // Заворачиваем вызов сервиса в обработчик ошибок для поддержки fallback режима
      const cancelTransactionWithFallback = DatabaseService(
        walletService.cancelTransaction.bind(walletService),
        async (error, ...args) => {
          console.error('[WalletControllerFallback] Ошибка при отмене транзакции:', error);
          return { 
            success: false, 
            error: "Временно невозможно отменить транзакцию. Пожалуйста, попробуйте позже." 
          };
        }
      );

      const result = await cancelTransactionWithFallback(transaction_id, user_id);
      return res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Добавляет UNI-токены на баланс пользователя (для администраторов)
   * @route POST /api/admin/wallet/add-uni
   */
  static async adminAddUni(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user_id, amount, reason } = req.body;

      if (!user_id || !amount) {
        return next(new ValidationError('Не указаны обязательные параметры: user_id, amount'));
      }

      const userId = Number(user_id);
      const amountValue = Number(amount);

      if (isNaN(userId) || isNaN(amountValue)) {
        return next(new ValidationError('Некорректные значения: user_id и amount должны быть числами'));
      }

      const addUniWithFallback = DatabaseService(
        walletService.adminAddUni.bind(walletService),
        async (error, ...args) => {
          console.error('[WalletControllerFallback] Ошибка при добавлении UNI админом:', error);
          return { 
            success: false, 
            error: "Временно невозможно добавить UNI. Пожалуйста, попробуйте позже." 
          };
        }
      );

      const result = await addUniWithFallback(userId, amountValue, reason || 'Добавлено администратором');
      return res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Получает информацию о комиссиях за вывод UNI
   * @route GET /api/wallet/fees
   */
  static async getWithdrawalFees(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Заворачиваем вызов сервиса в обработчик ошибок для поддержки fallback режима
      const getFeesWithFallback = DatabaseService(
        walletService.getWithdrawalFees.bind(walletService),
        async (error) => {
          console.log('[WalletControllerFallback] Возвращаем заглушку для комиссий за вывод');
          return { 
            success: true, 
            data: {
              min_amount: 100,
              max_amount: 10000,
              fee_percentage: 5,
              updated_at: new Date().toISOString()
            }
          };
        }
      );

      const fees = await getFeesWithFallback();
      return res.json(fees);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Получает информацию о внешнем кошельке пользователя (например, TON)
   * @route GET /api/wallet/external-info
   */
  static async getExternalWalletInfo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Валидация параметров запроса
      const validationResult = userIdSchema.safeParse(req.query);
      if (!validationResult.success) {
        return next(createValidationErrorFromZod(validationResult.error));
      }

      const { user_id } = validationResult.data;

      // Заворачиваем вызов сервиса в обработчик ошибок для поддержки fallback режима
      const getWalletInfoWithFallback = DatabaseService(
        walletService.getExternalWalletInfo.bind(walletService),
        async (error, userId) => {
          console.log(`[WalletControllerFallback] Возвращаем заглушку для информации о внешнем кошельке по ID: ${userId}`);
          return { 
            success: true, 
            data: {
              connected: false,
              wallet_address: null,
              connection_date: null
            }
          };
        }
      );

      const info = await getWalletInfoWithFallback(user_id);
      return res.json(info);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Отменяет все незавершенные транзакции пользователя
   * @route POST /api/wallet/cancel-all-pending
   */
  static async cancelAllPendingTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user_id } = req.body;

      if (!user_id) {
        return next(new ValidationError('Не указан обязательный параметр: user_id'));
      }

      const userId = Number(user_id);
      if (isNaN(userId)) {
        return next(new ValidationError('Некорректный ID пользователя'));
      }

      // Заворачиваем вызов сервиса в обработчик ошибок для поддержки fallback режима
      const cancelAllWithFallback = DatabaseService(
        walletService.cancelAllPendingTransactions.bind(walletService),
        async (error, ...args) => {
          console.error('[WalletControllerFallback] Ошибка при отмене всех транзакций:', error);
          return { 
            success: false, 
            error: "Временно невозможно отменить транзакции. Пожалуйста, попробуйте позже." 
          };
        }
      );

      const result = await cancelAllWithFallback(userId);
      return res.json(result);
    } catch (error) {
      next(error);
    }
  }
}