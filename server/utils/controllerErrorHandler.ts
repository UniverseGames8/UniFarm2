import { Request, Response, NextFunction } from 'express';
import { ValidationError, NotFoundError, UnauthorizedError, ForbiddenError, DatabaseError } from '../middleware/errorHandler';

/**
 * Вспомогательная функция для стандартизации обработки ошибок в контроллерах
 * Функция обертывает контроллер и перенаправляет все ошибки через next(error)
 * 
 * @param handler Функция-контроллер
 * @returns Обернутая функция с обработкой ошибок
 */
export const asyncErrorHandler = <T>(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<T>
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Конвертирует ошибки валидации в стандартный формат ValidationError
 * 
 * @param message Сообщение об ошибке
 * @param errors Дополнительные детали ошибок (опционально)
 * @returns Объект ValidationError
 */
export const validationError = (message: string, errors?: Record<string, string>): ValidationError => {
  return new ValidationError(message, errors);
};

/**
 * Конвертирует ошибки "не найдено" в стандартный формат NotFoundError
 * 
 * @param message Сообщение об ошибке
 * @returns Объект NotFoundError
 */
export const notFoundError = (message: string): NotFoundError => {
  return new NotFoundError(message);
};

/**
 * Конвертирует ошибки авторизации в стандартный формат UnauthorizedError
 * 
 * @param message Сообщение об ошибке (опционально)
 * @returns Объект UnauthorizedError
 */
export const unauthorizedError = (message?: string): UnauthorizedError => {
  return new UnauthorizedError(message);
};

/**
 * Конвертирует ошибки доступа в стандартный формат ForbiddenError
 * 
 * @param message Сообщение об ошибке (опционально)
 * @returns Объект ForbiddenError
 */
export const forbiddenError = (message?: string): ForbiddenError => {
  return new ForbiddenError(message);
};

/**
 * Конвертирует ошибки базы данных в стандартный формат DatabaseError
 * 
 * @param message Сообщение об ошибке
 * @param originalError Оригинальная ошибка (опционально)
 * @returns Объект DatabaseError
 */
export const databaseError = (message: string, originalError?: unknown): DatabaseError => {
  return new DatabaseError(message, originalError);
};