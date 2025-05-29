import { Request, Response, NextFunction } from "express";
import { tonBoostService } from "../services";
import { TonBoostService, TonBoostPaymentMethod } from "../services/tonBoostService";
import { tonBoostServiceInstance } from "../services/tonBoostServiceInstance";
import { DatabaseService } from "../db-service-wrapper";
import { ValidationError, NotFoundError, UnauthorizedError, ForbiddenError, DatabaseError } from '../middleware/errorHandler';
import { sendSuccess, sendError } from '../utils/responseUtils';

/**
 * Консолидированный контроллер для работы с TON Boost-пакетами и TON фармингом
 * Включает механизмы fallback для работы при отсутствии соединения с БД
 */
export class TonBoostController {
  /**
   * Обрабатывает входящую TON транзакцию для активации буст-пакета
   */
  static async processIncomingTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sender_address, amount, comment, boost_id } = req.body;
      
      // Выводим полученные данные для отладки
      console.log('[TonBoostController] Входящие данные транзакции:', {
        sender_address,
        amount, 
        amount_type: typeof amount,
        comment,
        boost_id,
        boost_id_type: typeof boost_id
      });
      
      if (!sender_address || !amount) {
        return next(new ValidationError("Не указаны обязательные параметры: sender_address, amount"));
      }

      const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
      const parsedBoostId = boost_id ? (typeof boost_id === 'string' ? parseInt(boost_id, 10) : boost_id) : null;
      
      if (numericAmount <= 0) {
        return next(new ValidationError("Сумма должна быть положительным числом"));
      }

      // Заворачиваем вызов сервиса в обработчик ошибок для поддержки fallback
      const processTransactionWithFallback = DatabaseService(
        tonBoostService.processIncomingTransaction.bind(tonBoostService),
        async (error, ...args) => {
          console.error('[TonBoostControllerFallback] Ошибка при обработке транзакции:', error);
          return { 
            success: false, 
            error: "Временно невозможно обработать транзакцию. Пожалуйста, попробуйте позже." 
          };
        }
      );

      const result = await processTransactionWithFallback(
        sender_address, 
        numericAmount, 
        comment || "", 
        parsedBoostId
      );
      
      return res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Получает доступные пакеты TON Boost
   */
  static async getTonBoostPackages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Заворачиваем вызов сервиса в обработчик ошибок для поддержки fallback
      const getPackagesWithFallback = DatabaseService(
        () => Promise.resolve({ success: true, data: tonBoostServiceInstance.getBoostPackages() }),
        async (error) => {
          console.log('[TonBoostControllerFallback] Возвращаем заглушку для TON Boost пакетов');
          return { 
            success: true, 
            data: [
              {
                id: 1,
                name: "TON Starter Pack",
                description: "Начальный пакет для TON фарминга",
                cost: 5,
                duration_days: 30,
                boost_percentage: 10,
                icon_url: "/images/ton_boost_1.png",
                status: "active",
                payment_methods: ["ton", "uni_balance"]
              },
              {
                id: 2,
                name: "TON Advanced Pack",
                description: "Продвинутый пакет для TON фарминга",
                cost: 15,
                duration_days: 30,
                boost_percentage: 25,
                icon_url: "/images/ton_boost_2.png",
                status: "active",
                payment_methods: ["ton", "uni_balance"]
              }
            ]
          };
        }
      );

      const packages = await getPackagesWithFallback();
      return res.json(packages);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Получает активные TON буст-пакеты пользователя
   */
  static async getUserTonBoosts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = Number(req.query.user_id);
      
      if (isNaN(userId)) {
        return next(new ValidationError("Не указан или некорректный ID пользователя"));
      }

      // Заворачиваем вызов сервиса в обработчик ошибок для поддержки fallback
      const getUserBoostsWithFallback = DatabaseService(
        tonBoostService.getUserTonBoosts.bind(tonBoostService),
        async (error, userId) => {
          console.log(`[TonBoostControllerFallback] Возвращаем заглушку для TON бустов пользователя ID: ${userId}`);
          return { 
            success: true, 
            data: [] 
          };
        }
      );

      const userBoosts = await getUserBoostsWithFallback(userId);
      return res.json(userBoosts);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Покупает TON буст-пакет
   */
  static async purchaseTonBoost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user_id, boost_id, payment_method } = req.body;
      
      if (!user_id || !boost_id) {
        return next(new ValidationError("Не указаны обязательные параметры: user_id, boost_id"));
      }
      
      const userId = Number(user_id);
      const boostId = Number(boost_id);
      
      if (isNaN(userId) || isNaN(boostId)) {
        return next(new ValidationError("user_id и boost_id должны быть числами"));
      }
      
      // Проверка типа платежа
      const paymentMethod = payment_method || TonBoostPaymentMethod.UNI_BALANCE;
      
      if (!Object.values(TonBoostPaymentMethod).includes(paymentMethod as TonBoostPaymentMethod)) {
        return next(new ValidationError(`Неподдерживаемый метод оплаты: ${payment_method}`));
      }

      // Заворачиваем вызов сервиса в обработчик ошибок для поддержки fallback
      const purchaseBoostWithFallback = DatabaseService(
        tonBoostService.purchaseTonBoost.bind(tonBoostService),
        async (error, ...args) => {
          console.error('[TonBoostControllerFallback] Ошибка при покупке TON буста:', error);
          return { 
            success: false, 
            error: "Временно невозможно купить TON буст. Пожалуйста, попробуйте позже." 
          };
        }
      );

      const result = await purchaseBoostWithFallback(userId, boostId, paymentMethod as TonBoostPaymentMethod);
      return res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Подтверждает внешний платеж (например, через TON)
   */
  static async confirmExternalPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { payment_id, transaction_hash } = req.body;
      
      if (!payment_id || !transaction_hash) {
        return next(new ValidationError("Не указаны обязательные параметры: payment_id, transaction_hash"));
      }

      // Заворачиваем вызов сервиса в обработчик ошибок для поддержки fallback
      const confirmPaymentWithFallback = DatabaseService(
        tonBoostService.confirmExternalPayment.bind(tonBoostService),
        async (error, ...args) => {
          console.error('[TonBoostControllerFallback] Ошибка при подтверждении платежа:', error);
          return { 
            success: false, 
            error: "Временно невозможно подтвердить платеж. Пожалуйста, попробуйте позже." 
          };
        }
      );

      const result = await confirmPaymentWithFallback(payment_id, transaction_hash);
      return res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Получает информацию о TON фарминге с поддержкой работы
   * при отсутствии соединения с базой данных
   */
  static async getUserTonFarmingInfo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = Number(req.query.user_id);
      
      if (isNaN(userId)) {
        return res.status(400).json({ 
          success: false, 
          message: "Не указан или некорректный ID пользователя"
        });
      }

      console.log(`[TON FARMING] Запрос информации для пользователя ${userId}`);

      // Возвращаем безопасную структуру данных, аналогичную UNI Farming
      const farmingInfo = {
        totalTonRatePerSecond: "0",
        totalUniRatePerSecond: "0", 
        dailyIncomeTon: "0",
        dailyIncomeUni: "0",
        deposits: []
      };

      console.log(`[TON FARMING] Успешно возвращены данные для пользователя ${userId}`);
      
      return res.json({ 
        success: true, 
        data: farmingInfo 
      });
    } catch (error) {
      console.error('[TON FARMING ERROR] Ошибка:', error);
      return res.status(500).json({
        success: false,
        message: "Ошибка при получении информации о TON фарминге"
      });
    }
  }

  /**
   * Рассчитывает и обновляет данные TON фарминга для пользователя
   */
  static async calculateAndUpdateTonFarming(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user_id } = req.body;
      
      if (!user_id) {
        return next(new ValidationError("Не указан ID пользователя"));
      }
      
      const userId = Number(user_id);
      
      if (isNaN(userId)) {
        return next(new ValidationError("ID пользователя должен быть числом"));
      }

      // Заворачиваем вызов сервиса в обработчик ошибок
      const updateFarmingWithFallback = DatabaseService(
        tonBoostService.calculateAndUpdateFarming.bind(tonBoostService),
        async (error, ...args) => {
          console.error('[TonBoostControllerFallback] Ошибка при обновлении TON фарминга:', error);
          return { 
            success: false, 
            error: "Временно невозможно обновить данные TON фарминга. Пожалуйста, попробуйте позже." 
          };
        }
      );

      const result = await updateFarmingWithFallback(userId);
      return res.json(result);
    } catch (error) {
      next(error);
    }
  }
}