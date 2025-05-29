import { Request, Response, NextFunction } from 'express';

/**
 * Расширяем тип Response для добавления новых методов
 */
declare module 'express' {
  interface Response {
    success: <T>(data: T) => Response;
    error: (message: string, errors?: Record<string, string> | null, statusCode?: number) => Response;
  }
}

/**
 * Middleware для стандартизации ответов API
 * Добавляет методы success и error для упрощения формирования стандартных ответов
 */
export function responseFormatter(req: Request, res: Response, next: NextFunction): void {
  // Успешный ответ
  res.success = function<T>(data: T): Response {
    return this.status(200).json({
      success: true,
      data
    });
  };

  // Ответ с ошибкой
  res.error = function(message: string, errors: Record<string, string> | null = null, statusCode = 400): Response {
    const response: {
      success: false;
      message: string;
      errors?: Record<string, string> | null;
    } = {
      success: false,
      message
    };

    if (errors) {
      response.errors = errors;
    }

    return this.status(statusCode).json(response);
  };

  next();
}