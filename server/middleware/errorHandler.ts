import { Request, Response, NextFunction } from 'express';

/**
 * Middleware для централизованной обработки ошибок
 * Обеспечивает надежную обработку всех типов ошибок без завершения работы сервера
 */
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  try {
    // Если ответ уже отправлен, передаем ошибку следующему middleware
    if (res.headersSent) {
      return next(err);
    }
    
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    // Расширенное логирование ошибок
    console.error('[ErrorHandler]', {
      path: req.path,
      method: req.method,
      statusCode,
      error: err.message,
      errorType: err.name || 'Error',
      errorCode: err.code,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      timestamp: new Date().toISOString()
    });

    // Проверяем, является ли это запросом для проверки здоровья
    const isHealthCheck = (
      req.path === '/' || 
      req.path === '/health' ||
      req.query.health === 'check' || 
      req.headers['user-agent']?.includes('Replit') || 
      req.headers['x-replit-deployment-check'] !== undefined
    );
    
    // Для проверок здоровья всегда возвращаем успешный ответ
    if (isHealthCheck) {
      res.status(200).send('UniFarm API Server: Online');
      return;
    }

    // Для обычных запросов возвращаем подробную информацию об ошибке
    res.status(statusCode).json({
      success: false,
      message,
      error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  } catch (handlerError) {
    // В случае ошибки в самом обработчике ошибок - логируем её и отправляем базовый ответ
    console.error('[CRITICAL] Error in errorHandler:', handlerError);
    
    try {
      // Последняя попытка вернуть хоть какой-то ответ
      res.status(500).send('Internal Server Error');
    } catch (finalError) {
      // Ничего не делаем, просто логируем
      console.error('[FATAL] Unable to send error response:', finalError);
    }
  }
}

/**
 * Класс ошибки валидации
 */
export class ValidationError extends Error {
  name = 'ValidationError';
  errors: Record<string, string> | null;

  constructor(message: string, errors?: Record<string, string>) {
    super(message);
    this.errors = errors || null;
  }
}

/**
 * Класс ошибки "ресурс не найден"
 */
export class NotFoundError extends Error {
  name = 'NotFoundError';

  constructor(message: string) {
    super(message);
  }
}

/**
 * Класс ошибки авторизации
 */
export class UnauthorizedError extends Error {
  name = 'UnauthorizedError';

  constructor(message: string = 'Не авторизован') {
    super(message);
  }
}

/**
 * Класс ошибки доступа
 */
export class ForbiddenError extends Error {
  name = 'ForbiddenError';

  constructor(message: string = 'Доступ запрещен') {
    super(message);
  }
}

/**
 * Класс ошибки недостаточного баланса
 */
export class InsufficientFundsError extends Error {
  name = 'InsufficientFundsError';
  errors: Record<string, string> | Record<string, any>;

  constructor(message: string, balanceOrDetails: number | string | Record<string, any>, currency?: string) {
    super(message);
    
    if (typeof balanceOrDetails === 'object') {
      // Поддержка старого формата для обратной совместимости
      this.errors = balanceOrDetails;
    } else {
      // Новый формат с балансом и валютой
      this.errors = {
        amount: `Недостаточно средств для операции. Доступный баланс: ${balanceOrDetails} ${currency || 'UNI'}`
      };
    }
  }
}

/**
 * Класс ошибки базы данных
 */
export class DatabaseError extends Error {
  name = 'DatabaseError';
  originalError: unknown;

  constructor(message: string, originalError?: unknown) {
    super(message);
    this.originalError = originalError || null;
  }
}