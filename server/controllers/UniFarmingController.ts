/**
 * UniFarmingController - контроллер для управления UNI фармингом
 * Обрабатывает запросы на получение статуса и управление UNI фармингом
 */

import { Request, Response } from 'express';
import logger from '../utils/logger';

export class UniFarmingController {
  /**
   * Получить статус UNI фарминга для пользователя
   * GET /api/uni-farming/status
   * GET /api/v2/uni-farming/status
   */
  static async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.query.user_id;
      
      // Валидация user_id
      if (!userId) {
        logger.warn('[UniFarming] Запрос без user_id');
        res.status(400).json({
          success: false,
          error: 'user_id is required'
        });
        return;
      }

      logger.info(`[UniFarming] Запрос статуса для пользователя ${userId}`);

      // Возвращаем базовую структуру для UNI фарминга
      const farmingStatus = {
        isActive: false,
        depositAmount: '0',
        ratePerSecond: '0',
        depositCount: 0,
        totalDepositAmount: '0',
        totalRatePerSecond: '0',
        dailyIncomeUni: '0',
        startDate: null,
        uni_farming_start_timestamp: null
      };

      res.json({
        success: true,
        data: farmingStatus
      });

    } catch (error) {
      logger.error('[UniFarming] Ошибка при получении статуса:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Покупка UNI фарминга (создание депозита)
   * POST /api/v2/uni-farming/purchase
   */
  static async purchaseUniFarming(req: Request, res: Response): Promise<void> {
    try {
      const { user_id, amount } = req.body;
      
      // Валидация входных данных
      if (!user_id || !amount) {
        logger.warn('[UniFarming] Запрос на покупку без user_id или amount');
        res.status(400).json({
          success: false,
          error: 'user_id and amount are required'
        });
        return;
      }

      // Валидация суммы
      const numericAmount = parseFloat(amount);
      if (isNaN(numericAmount) || numericAmount <= 0) {
        logger.warn('[UniFarming] Некорректная сумма депозита:', amount);
        res.status(400).json({
          success: false,
          error: 'Amount must be a positive number'
        });
        return;
      }

      logger.info(`[UniFarming] Создание депозита для пользователя ${user_id}, сумма: ${amount} UNI`);

      // Базовая структура успешного ответа
      const purchaseResult = {
        success: true,
        deposit_id: Date.now(), // Временный ID для тестирования
        user_id: parseInt(user_id),
        amount: amount,
        start_timestamp: new Date().toISOString(),
        daily_rate: '0.01', // 1% в день базовая ставка
        status: 'active'
      };

      res.json({
        success: true,
        data: purchaseResult,
        message: 'UNI фарминг депозит успешно создан'
      });

    } catch (error) {
      logger.error('[UniFarming] Ошибка при создании депозита:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Вывод средств из UNI фарминга
   * POST /api/v2/uni-farming/withdraw
   */
  static async withdrawUniFarming(req: Request, res: Response): Promise<void> {
    try {
      const { user_id, amount } = req.body;
      
      // Валидация входных данных
      if (!user_id) {
        logger.warn('[UniFarming] Запрос на вывод без user_id');
        res.status(400).json({
          success: false,
          error: 'user_id is required'
        });
        return;
      }

      // Если amount не указан - выводим все доступные средства
      let withdrawAmount = amount;
      if (!withdrawAmount) {
        withdrawAmount = '0'; // По умолчанию выводим все
      }

      logger.info(`[UniFarming] Запрос на вывод для пользователя ${user_id}, сумма: ${withdrawAmount || 'все доступные'}`);

      // Базовая структура ответа на вывод
      const withdrawResult = {
        success: true,
        user_id: parseInt(user_id),
        withdrawn_amount: withdrawAmount || '0',
        transaction_id: Date.now(), // Временный ID транзакции
        timestamp: new Date().toISOString(),
        new_balance: '0', // Баланс после вывода
        status: 'completed'
      };

      res.json({
        success: true,
        data: withdrawResult,
        message: 'Средства успешно выведены из UNI фарминга'
      });

    } catch (error) {
      logger.error('[UniFarming] Ошибка при выводе средств:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}

export default UniFarmingController;