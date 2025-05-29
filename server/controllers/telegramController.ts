import { Request, Response, NextFunction } from 'express';
import { telegramService } from '../services/index';
import { ValidationError } from '../middleware/errorHandler';
import { z } from 'zod';

/**
 * Схема валидации входящих данных для обработки initData
 */
const initDataSchema = z.object({
  initData: z.string().min(1, 'Поле initData не может быть пустым')
});

/**
 * Схема валидации входящих данных для регистрации
 */
const registerTelegramUserSchema = z.object({
  initData: z.string().min(1, 'Поле initData не может быть пустым'),
  referrer: z.string().optional().nullable()
});

/**
 * Контроллер для работы с Telegram API
 * Отвечает за обработку запросов связанных с Telegram Mini App
 */
export class TelegramController {
  /**
   * Обрабатывает webhook от Telegram
   * @route POST /api/telegram/webhook
   */
  static async handleWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      console.log('[TelegramController] Получен webhook от Telegram');
      
      // Даже при неудачной обработке webhook мы всегда отвечаем 200 OK,
      // чтобы Telegram не пытался повторно отправить запрос
      const result = await telegramService.handleWebhook(req.body);
      
      // Отправляем 200 OK в любом случае
      res.status(200).send('OK');
    } catch (error) {
      console.error('[TelegramController] Ошибка при обработке webhook:', error);
      // Даже при ошибке отправляем 200 OK, чтобы Telegram не пытался переотправить запрос
      res.status(200).send('Error processed');
    }
  }

  /**
   * Валидирует данные инициализации Telegram (initData)
   * @route POST /api/telegram/validate-init-data
   */
  static async validateInitData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Валидация входящих данных с использованием Zod
      const validatedData = initDataSchema.parse(req.body);
      
      // Вызываем сервис для обработки бизнес-логики
      const result = await telegramService.validateInitData(validatedData.initData);
      
      // Форматируем ответ в зависимости от результата
      if (result.user) {
        res.json({
          success: true,
          data: {
            isValid: true,
            user: result.user
          }
        });
      } else if (result.telegramId) {
        res.json({
          success: true,
          data: {
            isValid: true,
            telegramId: result.telegramId,
            needRegistration: true
          }
        });
      } else {
        res.json({
          success: true,
          data: result
        });
      }
    } catch (error) {
      // Ошибка передается в центральный обработчик ошибок
      next(error);
    }
  }

  /**
   * Получает информацию о мини-приложении
   * @route GET /api/telegram/mini-app-info
   */
  static async getMiniAppInfo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Получаем информацию о мини-приложении из сервиса
      const miniAppInfo = telegramService.getMiniAppInfo();
      
      // Возвращаем результат
      res.json({
        success: true,
        data: miniAppInfo
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Регистрирует пользователя через Telegram
   * @route POST /api/telegram/register
   */
  static async registerTelegramUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Валидация входящих данных с использованием Zod
      const validatedData = registerTelegramUserSchema.parse(req.body);
      
      // Вызываем сервис для регистрации пользователя
      const user = await telegramService.registerUser({
        initData: validatedData.initData,
        referrer: validatedData.referrer || null
      });
      
      // Возвращаем результат
      res.json({
        success: true,
        data: {
          user,
          message: 'Пользователь успешно зарегистрирован'
        }
      });
    } catch (error) {
      next(error);
    }
  }
}