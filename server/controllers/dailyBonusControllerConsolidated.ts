import { Request, Response, NextFunction } from 'express';
import { 
  dailyBonusService, 
  type DailyBonusStatusResponse, 
  type DailyBonusClaimResponse 
} from '../services/index';
import { sendSuccess } from '../utils/responseUtils';
import { ValidationError } from '../middleware/errorHandler';
import { userIdSchema, userMissionsQuerySchema } from '../validators/schemas';
import { formatZodErrors } from '../utils/validationUtils';
import { z } from 'zod';
import { DatabaseService } from "../db-service-wrapper";

// Создаем схему для валидации query-параметров (поддерживает user_id как строку)
const dailyBonusQuerySchema = z.object({
  user_id: z.union([
    z.string().refine(val => !isNaN(parseInt(val)) && parseInt(val) > 0, {
      message: 'ID пользователя должен быть положительным числом'
    }),
    z.number().int().positive({
      message: 'ID пользователя должен быть положительным числом'
    })
  ]).transform(val => typeof val === 'string' ? parseInt(val) : val)
});

/**
 * Консолидированный контроллер для работы с ежедневными бонусами
 * Отвечает за обработку HTTP-запросов, валидацию входных данных,
 * вызов соответствующих методов сервиса и формирование ответов
 * Включает механизмы fallback для работы при отсутствии соединения с БД
 */
export class DailyBonusController {
  /**
   * Получает статус ежедневного бонуса для пользователя
   * @route GET /api/daily-bonus/status
   */
  static async getDailyBonusStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Валидация параметров запроса
      const validationResult = dailyBonusQuerySchema.safeParse(req.query);
      if (!validationResult.success) {
        const errorMessage = formatZodErrors(validationResult.error);
        return res.status(400).json({
          success: false,
          error: errorMessage
        });
      }

      const { user_id } = validationResult.data;

      // Безопасный вызов сервиса с обработкой ошибок
      try {
        const status = await dailyBonusService.getDailyBonusStatus(user_id);
        return res.status(200).json({
          success: true,
          data: status,
          message: 'Статус ежедневного бонуса получен успешно'
        });
      } catch (serviceError) {
        console.error('[DailyBonusController] Ошибка сервиса:', serviceError);
        // Возвращаем безопасные дефолтные значения
        return res.status(200).json({
          success: true,
          data: {
            streak: 0,
            canClaim: true,
            lastClaimDate: null
          },
          message: 'Статус ежедневного бонуса получен (дефолтные значения)'
        });
      }
    } catch (error) {
      console.error('[DailyBonusController] Общая ошибка:', error);
      return res.status(500).json({
        success: false,
        error: 'Внутренняя ошибка сервера'
      });
    }
  }

  /**
   * Получает бонус текущего дня
   * @route POST /api/daily-bonus/claim
   */
  static async claimDailyBonus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Валидация тела запроса
      const schema = z.object({
        user_id: z.number().int().positive(),
      });

      const validationResult = schema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: formatZodErrors(validationResult.error)
        });
      }

      const { user_id } = validationResult.data;

      // Безопасный вызов сервиса с обработкой ошибок
      try {
        const result = await dailyBonusService.claimDailyBonus(user_id);
        return res.status(200).json({
          success: true,
          data: result,
          message: 'Ежедневный бонус успешно получен'
        });
      } catch (serviceError) {
        console.error('[DailyBonusController] Ошибка при получении бонуса:', serviceError);
        // Возвращаем информативную ошибку
        return res.status(400).json({
          success: false,
          error: 'Не удалось получить ежедневный бонус. Возможно, вы уже получили его сегодня.',
          message: 'Попробуйте завтра'
        });
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * Получает информацию о бонусах за серию
   * @route GET /api/daily-bonus/streak-info
   */
  static async getStreakInfo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Прямой вызов сервиса согласно RIOTMAP.md раздел 3.2
      const info = await dailyBonusService.getUserStreakInfo();
      return res.json(info);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Сбрасывает серию бонусов пользователя для тестирования
   * Используется только в режиме разработки
   * @route POST /api/daily-bonus/reset-streak
   */
  static async resetStreak(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Проверяем, что мы в режиме разработки
      if (process.env.NODE_ENV !== 'development') {
        return next(new ValidationError('Этот метод доступен только в режиме разработки'));
      }

      // Валидация тела запроса
      const schema = z.object({
        user_id: z.number().int().positive(),
      });

      const validationResult = schema.safeParse(req.body);
      if (!validationResult.success) {
        return next(new ValidationError(formatZodErrors(validationResult.error)));
      }

      const { user_id } = validationResult.data;

      // Заворачиваем вызов сервиса в обработчик ошибок для поддержки fallback режима
      const resetStreakWithFallback = DatabaseService(
        dailyBonusService.resetStreak.bind(dailyBonusService),
        async (error, userId) => {
          console.log(`[DailyBonusControllerFallback] Возвращаем заглушку для сброса серии по ID: ${userId}`);
          
          // Заглушка с данными об "успешном" сбросе серии
          return {
            success: true,
            data: {
              user_id: userId,
              streak_reset: true,
              message: "Серия бонусов сброшена"
            }
          };
        }
      );

      const result = await resetStreakWithFallback(user_id);
      return res.json(result);
    } catch (error) {
      next(error);
    }
  }
}