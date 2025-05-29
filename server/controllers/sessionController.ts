import { Request, Response } from "express";
import { extendedStorage } from "../storage-adapter-extended";
import { userService } from "../services";
import 'express-session';
import { adaptedSendSuccess as sendSuccess, adaptedSendError as sendError, adaptedSendServerError as sendServerError } from '../utils/apiResponseAdapter';
import { dbUserToApiUser } from '../utils/userAdapter';
import { DatabaseService } from "../db-service-wrapper";
import logger from '../utils/logger';

// Для корректной работы с сессией расширяем интерфейс Request
// Это временное решение, обходящее проблему с типизацией express-session
type RequestWithSession = Request & {
  session?: {
    userId?: number;
    user?: {
      id: number;
      username: string;
      ref_code?: string;
      guest_id?: string;
    };
  };
};

/**
 * Контроллер для управления сессиями пользователей и восстановления кабинета
 * 
 * Этап 5: Безопасное восстановление пользователя
 * Обеспечивает стабильную работу системы, при которой один и тот же пользователь (по guest_id)
 * всегда получает доступ к своему кабинету, даже при повторных заходах.
 */
export class SessionController {
  /**
   * Создает тестовую сессию для режима разработки
   * @param req Запрос
   * @param res Ответ с данными тестового пользователя
   */
  static async devLogin(req: RequestWithSession, res: Response): Promise<any> {
    // В продакшн-версії цей метод недоступний взагалі
    return sendError(res, 'Ця функція недоступна в продакшн-середовищі', 403);
  }
  /**
   * Восстанавливает сессию пользователя по guest_id без создания нового аккаунта
   * @param req Запрос с guest_id в параметрах
   * @param res Ответ с данными пользователя или ошибкой
   */
  static async restoreSession(req: RequestWithSession, res: Response): Promise<any> {
    try {
      // Отримуємо параметри для відновлення сесії
      const { guest_id, telegram_id } = req.body;
      
      // В продакшн-версії не використовуємо тестових користувачів
      
      // Перевіряємо наявність guest_id
      if (!guest_id) {
        return sendError(res, 'Відсутній guest_id в запиті', 400, { error_code: 'MISSING_GUEST_ID' });
      }
      
      // Шукаємо користувача за guest_id
      const user = await extendedStorage.getUserByGuestId(guest_id);
      
      // Перевіряємо, чи знайдено користувача
      if (!user) {
        return sendError(res, 'Користувач не знайдений', 404, { error_code: 'USER_NOT_FOUND' });
      }
      
      // Якщо передано telegram_id і він відрізняється від збереженого, 
      // не блокуємо відновлення, оскільки пріоритет у guest_id
      
      // Перевіряємо наявність реферального коду у користувача
      let updatedUser = user;
      if (!user.ref_code) {
        try {
          // Генеруємо унікальний реферальний код
          const refCode = await userService.generateRefCode();
          
          // Оновлюємо користувача з новим кодом
          const result = await userService.updateUserRefCode(user.id, refCode);
          
          if (result) {
            updatedUser = result;
          }
        } catch (err) {
          // Обробляємо помилки, але не блокуємо авторизацію
          logger.error(`[SessionController] Помилка при генерації реферального коду:`, err instanceof Error ? err.message : String(err));
        }
      }
      
      // Зберігаємо дані користувача в Express-сесії для подальших запитів
      if (req.session) {
        req.session.userId = updatedUser.id;
        req.session.user = {
          id: updatedUser.id,
          username: updatedUser.username || '',
          ref_code: updatedUser.ref_code || undefined,
          guest_id: updatedUser.guest_id || undefined
        };
      }
      
      // Повертаємо дані користувача (без конфіденційної інформації)
      // Використовуємо updatedUser, щоб повернути актуальний ref_code
      sendSuccess(res, {
        user_id: updatedUser.id,
        username: updatedUser.username,
        telegram_id: updatedUser.telegram_id, 
        balance_uni: updatedUser.balance_uni,
        balance_ton: updatedUser.balance_ton,
        ref_code: updatedUser.ref_code,
        guest_id: updatedUser.guest_id,
        created_at: updatedUser.created_at,
        parent_ref_code: updatedUser.parent_ref_code
      }, 'Сесія успішно відновлена', 200);
    } catch (error) {
      sendServerError(res, 'Внутрішня помилка сервера при відновленні сесії', { error_code: 'SESSION_RESTORE_FAILED' });
    }
  }
}