import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { authService } from '../services/index';
import { sendSuccess, sendError } from '../utils/responseUtils';
import { userService } from '../services/index';

/**
 * Обновленный AuthController следующий принципам SOLID
 * Ответственность ограничена обработкой HTTP-запросов,
 * вся бизнес-логика вынесена в AuthService
 */
export class AuthController {
  /**
   * Аутентификация пользователя через Telegram
   */
  static async authenticateTelegram(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Создаем схему валидации данных
      const telegramAuthSchema = z.object({
        authData: z.string().optional(),
        userId: z.number().optional(),
        username: z.string().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        startParam: z.string().optional(),
        referrerId: z.number().optional(),
        refCode: z.string().optional(),
        guest_id: z.string().optional(),
        testMode: z.boolean().optional(),
      });

      // Валидируем данные запроса
      const validatedData = telegramAuthSchema.safeParse(req.body);
      
      if (!validatedData.success) {
        return sendError(res, 'Неверный формат данных', 400, validatedData.error);
      }
      
      // Определяем режим разработки
      const isDevelopment = process.env.NODE_ENV === 'development' || 
                            process.env.IS_DEV === 'true';
      
      // Вызываем сервис аутентификации
      const user = await authService.authenticateTelegram(validatedData.data, isDevelopment);
      
      // Обогащаем данные пользователя для ответа
      const userResponse = {
        id: user.id,
        username: user.username,
        telegram_id: user.telegram_id,
        guest_id: user.guest_id,
        wallet: user.wallet,
        ton_wallet_address: user.ton_wallet_address,
        ref_code: user.ref_code,
        parent_ref_code: user.parent_ref_code,
        balance_uni: user.balance_uni,
        balance_ton: user.balance_ton,
        created_at: user.created_at
      };
      
      // Возвращаем успешный ответ
      sendSuccess(res, {
        user: userResponse,
        authenticated: true,
        session_id: crypto.randomUUID() // Простой способ создания сессии для примера
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Регистрация гостевого пользователя для работы в режиме AirDrop
   */
  static async registerGuestUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Создаем схему валидации данных
      const guestRegisterSchema = z.object({
        guest_id: z.string(),
        username: z.string().optional(),
        parent_ref_code: z.string().optional(),
        ref_code: z.string().optional(),
        airdrop_mode: z.boolean().optional(),
        telegram_id: z.number().optional(),
      });
      
      // Валидируем данные запроса
      const validatedData = guestRegisterSchema.safeParse(req.body);
      
      if (!validatedData.success) {
        return sendError(res, 'Неверный формат данных', 400, validatedData.error);
      }
      
      // Вызываем сервис регистрации гостевых пользователей
      const user = await authService.registerGuestUser(validatedData.data);
      
      // Обогащаем данные пользователя для ответа
      const userResponse = {
        id: user.id,
        username: user.username,
        telegram_id: user.telegram_id,
        guest_id: user.guest_id,
        wallet: user.wallet,
        ton_wallet_address: user.ton_wallet_address,
        ref_code: user.ref_code,
        parent_ref_code: user.parent_ref_code,
        balance_uni: user.balance_uni,
        balance_ton: user.balance_ton,
        created_at: user.created_at
      };
      
      // Возвращаем успешный ответ
      sendSuccess(res, {
        user: userResponse,
        registered: true,
        session_id: crypto.randomUUID() // Простой способ создания сессии для примера
      });
    } catch (error) {
      next(error);
    }
  }
  
  /**
   * Регистрация обычного пользователя
   */
  static async registerUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Создаем схему валидации данных
      const userRegisterSchema = z.object({
        username: z.string(),
        refCode: z.string().optional(),
        parentRefCode: z.string().optional(),
        startParam: z.string().optional(),
        telegram_id: z.number().optional(),
        guest_id: z.string().optional(),
      });
      
      // Валидируем данные запроса
      const validatedData = userRegisterSchema.safeParse(req.body);
      
      if (!validatedData.success) {
        return sendError(res, 'Неверный формат данных', 400, validatedData.error);
      }
      
      // Вызываем сервис регистрации
      const user = await authService.registerUser(validatedData.data);
      
      // Обогащаем данные пользователя для ответа
      const userResponse = {
        id: user.id,
        username: user.username,
        telegram_id: user.telegram_id,
        guest_id: user.guest_id,
        wallet: user.wallet,
        ton_wallet_address: user.ton_wallet_address,
        ref_code: user.ref_code,
        parent_ref_code: user.parent_ref_code,
        balance_uni: user.balance_uni,
        balance_ton: user.balance_ton,
        created_at: user.created_at
      };
      
      // Возвращаем успешный ответ
      sendSuccess(res, {
        user: userResponse,
        registered: true,
        session_id: crypto.randomUUID() // Простой способ создания сессии для примера
      });
    } catch (error) {
      next(error);
    }
  }
}