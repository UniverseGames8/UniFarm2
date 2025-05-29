import { Response } from 'express';

/**
 * Отправляет успешный ответ API
 * @param res Объект ответа Express
 * @param data Данные для отправки
 * @param message Опциональное сообщение об успехе
 * @param status HTTP статус код (по умолчанию 200)
 */
export function sendSuccess(res: Response, data: any, message?: string, status: number = 200): void {
  res.status(status).json({
    success: true,
    message,
    data
  });
}

/**
 * Отправляет успешный ответ API с массивом данных
 */
export function sendSuccessArray(res: Response, data: any[], status: number = 200): void {
  res.status(status).json({
    success: true,
    data
  });
}

/**
 * Отправляет ответ об ошибке API
 */
export function sendError(res: Response, message: string, status: number = 400, error?: any): void {
  const errorResponse: { success: boolean; error: any } = {
    success: false,
    error: {
      message,
      details: error
    }
  };

  res.status(status).json(errorResponse);
}

/**
 * Отправляет ответ о серверной ошибке API
 */
export function sendServerError(res: Response, message: string = 'Internal Server Error', error?: any): void {
  const errorResponse: { success: boolean; error: any } = {
    success: false,
    error: {
      message,
      details: error
    }
  };

  res.status(500).json(errorResponse);
}

/**
 * Преобразует ошибку в стандартный объект ошибки API
 */
export function formatError(message: string, error?: any): any {
  return {
    success: false,
    error: {
      message,
      details: error
    }
  };
}

/**
 * Проверяет, является ли строка валидным JSON
 */
export function isValidJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
}