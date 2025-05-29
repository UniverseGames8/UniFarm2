import { Request, Response } from 'express';
import { sendSuccess, sendError, sendServerError } from '../utils/responseUtils';
import { adminService } from '../services/index';
import { 
  adminKeySchema, 
  adminParamsSchema,
  type AdminParams 
} from '../services/adminServiceInstance';
import { ForbiddenError, ValidationError } from '../middleware/errorHandler';
import { z } from 'zod';

/**
 * Контроллер для административных функций
 * Соответствует принципам SOLID:
 * - Single Responsibility (SRP): обрабатывает только HTTP запросы, валидацию и делегирует логику сервису
 * - Open/Closed (OCP): легко расширяется новыми методами без изменения существующих
 * - Liskov Substitution (LSP): не нарушает контрактов интерфейсов
 * - Interface Segregation (ISP): разделяет интерфейсы по назначению
 * - Dependency Inversion (DIP): зависит от абстракций (сервисов), а не реализаций
 */
export class AdminController {
  /**
   * Получает список всех пользователей с их Telegram ID
   * Эндпоинт используется для диагностики проблем с Telegram ID
   * @access Только администраторы
   */
  static async listUsersWithTelegramId(req: Request, res: Response): Promise<void> {
    try {
      // Получаем админский ключ из заголовка
      const adminKey = req.headers['x-admin-key'] as string;
      
      // Валидируем ключ через схему Zod
      const validationResult = adminKeySchema.safeParse({ adminKey });
      
      if (!validationResult.success) {
        const errorMessage = validationResult.error.errors.map((e: any) => e.message).join(', ');
        console.warn(`[AdminController] Ошибка валидации: ${errorMessage}`);
        return sendError(res, errorMessage, 400);
      }
      
      try {
        // Проверяем права администратора
        adminService.verifyAdminAccess(adminKey);
      } catch (error) {
        if (error instanceof ForbiddenError) {
          return sendError(res, error.message, 403);
        }
        throw error;
      }
      
      // Валидируем и получаем параметры запроса
      const queryParams: AdminParams = {};
      
      // Разбираем параметры из query строки, если они есть
      if (req.query) {
        // Парсим и конвертируем параметры в нужные типы
        if (req.query.limit) queryParams.limit = parseInt(req.query.limit as string);
        if (req.query.offset) queryParams.offset = parseInt(req.query.offset as string);
        if (req.query.sortBy) queryParams.sortBy = req.query.sortBy as any;
        if (req.query.sortDirection) queryParams.sortDirection = req.query.sortDirection as any;
        if (req.query.showTestAccounts !== undefined) {
          queryParams.showTestAccounts = (req.query.showTestAccounts === 'true');
        }
      }
      
      // Валидируем дополнительные параметры
      const paramsResult = adminParamsSchema.safeParse(queryParams);
      
      if (!paramsResult.success) {
        const errorMessage = paramsResult.error.errors.map((e: any) => e.message).join(', ');
        console.warn(`[AdminController] Ошибка параметров: ${errorMessage}`);
        return sendError(res, errorMessage, 400);
      }
      
      // Получаем данные через сервис
      const result = await adminService.listUsersWithTelegramId(paramsResult.data);
      
      // Отправляем успешный ответ
      sendSuccess(res, result);
    } catch (error) {
      console.error('[AdminController] Ошибка при получении списка пользователей:', error);
      sendServerError(res, error instanceof Error ? error.message : 'Неизвестная ошибка');
    }
  }
}