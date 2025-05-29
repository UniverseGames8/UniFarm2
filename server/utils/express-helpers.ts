/**
 * Вспомогательный модуль для типобезопасной работы с Express
 * Предоставляет утилиты для регистрации маршрутов и обработчиков с корректной типизацией
 */

import { Express, Request, Response, NextFunction, RequestHandler } from 'express';
import logger from './logger';

/**
 * Обертка для безопасной регистрации маршрутов с проверкой типов
 * @param app Экземпляр приложения Express
 */
export function createRouteSafely(app: Express) {
  return {
    /**
     * Регистрирует GET маршрут с типобезопасным обработчиком
     * @param path Путь маршрута
     * @param handler Обработчик запроса
     */
    get: (path: string, handler: RequestHandler) => {
      app.get(path, handler);
      logger.debug(`[Routes] Зарегистрирован GET маршрут: ${path}`);
    },

    /**
     * Регистрирует POST маршрут с типобезопасным обработчиком
     * @param path Путь маршрута
     * @param handler Обработчик запроса
     */
    post: (path: string, handler: RequestHandler) => {
      app.post(path, handler);
      logger.debug(`[Routes] Зарегистрирован POST маршрут: ${path}`);
    },

    /**
     * Регистрирует PUT маршрут с типобезопасным обработчиком
     * @param path Путь маршрута
     * @param handler Обработчик запроса
     */
    put: (path: string, handler: RequestHandler) => {
      app.put(path, handler);
      logger.debug(`[Routes] Зарегистрирован PUT маршрут: ${path}`);
    },

    /**
     * Регистрирует DELETE маршрут с типобезопасным обработчиком
     * @param path Путь маршрута
     * @param handler Обработчик запроса
     */
    delete: (path: string, handler: RequestHandler) => {
      app.delete(path, handler);
      logger.debug(`[Routes] Зарегистрирован DELETE маршрут: ${path}`);
    },

    /**
     * Регистрирует использование маршрутизатора
     * @param path Базовый путь
     * @param router Экземпляр маршрутизатора
     */
    use: (path: string, router: any) => {
      app.use(path, router);
      logger.debug(`[Routes] Зарегистрирован маршрутизатор для пути: ${path}`);
    }
  };
}

/**
 * Создает типобезопасную обертку для обработчиков маршрутов с обработкой ошибок
 * @param handler Функция-обработчик запроса
 * @returns Типобезопасная обертка для обработчика
 */
export function createSafeHandler(handler: (req: Request, res: Response, next: NextFunction) => Promise<any> | any): RequestHandler {
  // Обходим несоответствие типов через двойное приведение типа
  return (async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (typeof handler !== 'function') {
        logger.error('[Routes] Обработчик не является функцией:', handler);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: 'Внутренняя ошибка сервера: неверный обработчик'
          });
        }
        return;
      }
      
      await handler(req, res, next);
      
    } catch (error) {
      logger.error('[Routes] Ошибка в обработчике маршрута:', error);
      
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Внутренняя ошибка сервера',
          message: error instanceof Error ? error.message : String(error)
        });
      } else {
        next(error);
      }
    }
  }) as unknown as RequestHandler;
}