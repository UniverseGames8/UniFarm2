import { ZodError } from 'zod';
import { ValidationError } from '../middleware/errorHandler';
import { Request } from 'express';

/**
 * Преобразует ошибки Zod в формат, понятный для ValidationError
 * @param zodError Ошибка валидации от Zod
 * @returns Объект с ошибками в формате Record<string, string>
 */
export function formatZodErrors(zodError: ZodError): Record<string, string> {
  const formatted: Record<string, string> = {};
  
  const formattedErrors = zodError.format();
  
  // Более типобезопасная версия с явной проверкой типов и свойств
  Object.keys(formattedErrors).forEach(key => {
    const error = formattedErrors[key as keyof typeof formattedErrors];
    if (key !== '_errors' && error && typeof error === 'object' && '_errors' in error && Array.isArray(error._errors) && error._errors.length > 0) {
      formatted[key] = error._errors.join(', ');
    }
  });
  
  // Если нет специфичных ошибок полей, используем общие ошибки
  if (Object.keys(formatted).length === 0 && 
      '_errors' in formattedErrors && 
      Array.isArray(formattedErrors._errors) && 
      formattedErrors._errors.length > 0) {
    formatted.general = formattedErrors._errors.join(', ');
  }
  
  return formatted;
}

/**
 * Создает ValidationError на основе ошибки Zod
 * @param message Общее сообщение об ошибке
 * @param zodError Ошибка валидации от Zod
 * @returns ValidationError с отформатированными ошибками
 */
export function createValidationErrorFromZod(message: string, zodError: ZodError): ValidationError {
  return new ValidationError(message, formatZodErrors(zodError));
}

/**
 * Извлекает ID пользователя из различных источников запроса
 * Порядок приоритета: параметр user_id в теле запроса или query -> сессия -> параметр из URL
 * 
 * @param req Объект запроса Express
 * @returns ID пользователя или undefined, если не найден
 */
export function extractUserId(req: Request): number | undefined {
  let userId: number | undefined;
  
  // Проверяем наличие user_id в теле запроса или query параметрах
  if (req.body && typeof req.body.user_id === 'number') {
    userId = req.body.user_id;
  } else if (req.body && typeof req.body.user_id === 'string') {
    userId = parseInt(req.body.user_id);
    if (isNaN(userId)) userId = undefined;
  } else if (req.query && typeof req.query.user_id === 'string') {
    userId = parseInt(req.query.user_id);
    if (isNaN(userId)) userId = undefined;
  }
  
  // Если не нашли в теле/параметрах, проверяем сессию
  if (!userId && req.session && req.session.userId) {
    userId = req.session.userId;
  }
  
  // В последнюю очередь проверяем параметры маршрута
  if (!userId && req.params && req.params.userId) {
    userId = parseInt(req.params.userId);
    if (isNaN(userId)) userId = undefined;
  }
  
  return userId;
}