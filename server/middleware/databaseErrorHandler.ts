/**
 * Middleware для обработки ошибок базы данных
 * Автоматически выполняет повторное подключение при потере соединения
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { testDatabaseConnection, reconnect } from '../db';
import logger from '../utils/logger';

// Змінні для контролю стану перевірки підключення
let lastConnectionCheck = 0;
let isReconnecting = false;
const CONNECTION_CHECK_INTERVAL = 60000; // Проверяем соединение не чаще чем раз в минуту

/**
 * Middleware для обработки ошибок базы данных.
 * Проверяет соединение с базой данных при необходимости и 
 * автоматически пытается переподключиться в случае проблем.
 */
export const databaseErrorHandler = async (req: Request, res: Response, next: NextFunction) => {
  // Если это статический файл или метод OPTIONS, не проверяем БД
  if (
    req.method === 'OPTIONS' || 
    !req.path.startsWith('/api/') || 
    req.path.includes('.') || 
    req.path === '/health'
  ) {
    return next();
  }
  
  const now = Date.now();
  
  // Проверяем соединение с БД не чаще раз в минуту
  if (now - lastConnectionCheck > CONNECTION_CHECK_INTERVAL) {
    lastConnectionCheck = now;
    
    // Проверяем соединение с БД только если не происходит переподключение
    if (!isReconnecting) {
      const connectionResult = await testDatabaseConnection().catch(() => ({ success: false, dbType: 'unknown' }));
      
      if (!connectionResult.success) {
        logger.warn('[DB] Потеряно соединение с базой данных. Попытка переподключения...');
        
        isReconnecting = true;
        
        try {
          const reconnected = await reconnect();
          
          if (reconnected) {
            logger.debug('[DB] Соединение с базой данных восстановлено');
          } else {
            logger.error('[DB] Не удалось восстановить соединение с базой данных');
            
            // Если запрос требует БД, но соединение не восстановлено, возвращаем ошибку
            return res.status(503).json({
              success: false,
              error: 'Database connection error. Please try again later.'
            });
          }
        } finally {
          isReconnecting = false;
        }
      }
    }
  }
  
  next();
};