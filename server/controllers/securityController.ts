import { Request, Response, NextFunction } from 'express';
import { telegramDataSchema, headersSchema } from '../services/securityService';
import { securityService } from '../services/index';
import { sendSuccess } from '../utils/responseUtils';
import { z } from 'zod';

/**
 * Контроллер безопасности, отвечающий за проверку и валидацию данных
 */
export class SecurityController {
  /**
   * Валидирует данные инициализации Telegram
   */
  static async validateTelegramInitData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Получаем данные из тела запроса
      const dataFromBody = telegramDataSchema.safeParse(req.body);
      
      if (!dataFromBody.success) {
        throw new Error('Невалидный формат данных в теле запроса');
      }
      
      // Проверяем заголовки
      const headersData = headersSchema.safeParse(req.headers);
      
      // Извлекаем данные Telegram из заголовков, если они там есть
      const telegramInitData = headersData.success ? 
                            securityService.extractTelegramDataFromHeaders(headersData.data) : 
                            null;
      
      // Объединяем данные из тела и заголовков
      const data = {
        ...dataFromBody.data,
        telegramInitData: telegramInitData || undefined
      };
      
      // Определяем режим разработки
      const isDevelopment = process.env.NODE_ENV === 'development' || 
                         process.env.IS_DEV === 'true' || 
                         req.body.testMode === true;
      
      // Проверяем валидность данных
      await securityService.validateTelegramData(data, isDevelopment);
      
      // Парсим данные для возврата клиенту
      let parsedData = null;
      const authData = data.telegramInitData || data.authData;
      
      if (authData) {
        parsedData = securityService.parseTelegramInitData(authData);
      }
      
      // Отправляем положительный ответ
      sendSuccess(res, {
        valid: true,
        data: parsedData ? {
          user_id: parsedData.id || (parsedData.user ? parsedData.user.id : null),
          username: parsedData.username || (parsedData.user ? parsedData.user.username : null),
          first_name: parsedData.first_name || (parsedData.user ? parsedData.user.first_name : null),
          auth_date: parsedData.auth_date
        } : null
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Проверяет разрешения пользователя
   */
  static async checkPermission(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Валидация входных данных
      const permissionSchema = z.object({
        userId: z.number(),
        permission: z.string()
      });
      
      const validatedData = permissionSchema.safeParse(req.body);
      
      if (!validatedData.success) {
        throw new Error('Невалидный формат данных');
      }
      
      // Проверяем разрешения
      const hasPermission = await securityService.checkUserPermission(
        validatedData.data.userId,
        validatedData.data.permission
      );
      
      // Отправляем результат
      sendSuccess(res, {
        hasPermission,
        permission: validatedData.data.permission
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Санитизирует пользовательский ввод
   */
  static sanitizeUserInput(req: Request, res: Response, next: NextFunction): void {
    try {
      // Валидация входных данных
      const sanitizeSchema = z.object({
        input: z.string()
      });
      
      const validatedData = sanitizeSchema.safeParse(req.body);
      
      if (!validatedData.success) {
        throw new Error('Невалидный формат данных');
      }
      
      // Очищаем ввод
      const sanitizedInput = securityService.sanitizeInput(validatedData.data.input);
      
      // Отправляем результат
      sendSuccess(res, {
        original: validatedData.data.input,
        sanitized: sanitizedInput
      });
    } catch (error) {
      next(error);
    }
  }
}