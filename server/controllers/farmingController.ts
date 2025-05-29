import { Request, Response } from 'express';
import { userService, farmingService, transactionService } from '../services';
import { sendSuccess, sendSuccessArray, sendError, sendServerError } from '../utils/responseUtils';
import { extractUserId } from '../utils/validationUtils';
import { depositSchema } from '../validators/schemas';
import { ZodError } from 'zod';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * Контроллер для работы с фарминг-депозитами и бустами
 */
export class FarmingController {
  /**
   * Получает активные фарминг-депозиты пользователя
   */
  static async getUserFarmingDeposits(req: Request, res: Response): Promise<void> {
    try {
      const userId = extractUserId(req, 'query');
      
      if (!userId) {
        sendError(res, 'Invalid user ID', 400);
        return;
      }

      const deposits = await farmingService.getUserFarmingDeposits(userId);
      sendSuccessArray(res, deposits);
    } catch (error) {
      console.error('Error fetching farming deposits:', error);
      sendServerError(res, 'Failed to fetch farming deposits');
    }
  }

  /**
   * Создает новый депозит (покупка буста)
   */
  static async createDeposit(req: Request, res: Response): Promise<void> {
    try {
      // Валидация тела запроса
      const validationResult = depositSchema.safeParse(req.body);
      if (!validationResult.success) {
        return sendError(res, 'Invalid request data', 400, validationResult.error.format());
      }

      const { user_id, amount, package_id } = validationResult.data;
      
      // Проверка существования пользователя
      const user = await userService.getUserById(user_id);
      if (!user) {
        return sendError(res, 'User not found', 404);
      }

      const amountFloat = parseFloat(amount);
      
      // Проверка достаточности баланса
      const userBalance = user.balance_uni ? parseFloat(user.balance_uni.toString()) : 0;
      if (userBalance < amountFloat) {
        return sendError(res, 'Недостаточно средств на балансе', 400);
      }
      
      // Проверка минимальной суммы пополнения (0.001 UNI)
      if (amountFloat < 0.001) {
        return sendError(res, 'Минимальная сумма пополнения - 0.001 UNI', 400);
      }

      // Определяем ставки в зависимости от пакета
      // В реальном приложении эти данные могут быть в базе данных
      const rateUni = "5.00"; // Базовая ставка в %
      const rateTon = "1.00"; // Базовая ставка в %

      // Создаем фарминг-депозит
      const deposit = await farmingService.createFarmingDeposit({
        user_id,
        amount_uni: amount,
        rate_uni: rateUni,
        rate_ton: rateTon,
        last_claim: new Date()
      });

      // Создаем транзакцию
      await transactionService.createTransaction({
        user_id,
        type: 'deposit',
        amount,
        currency: 'UNI',
        status: 'confirmed'
      });

      // Обновляем баланс пользователя
      await db
        .update(users)
        .set({
          balance_uni: sql`${users.balance_uni} - ${amount}`
        })
        .where(eq(users.id, user_id));

      sendSuccess(res, {
        success: true,
        message: `Deposit of ${amount} UNI created successfully.`,
        deposit_id: deposit.id
      });
    } catch (error) {
      console.error('Error creating deposit:', error);
      sendServerError(res, 'Failed to create deposit');
    }
  }
}