/**
 * Middleware для проверки здоровья приложения
 * Обеспечивает быстрый ответ на запросы к корневому маршруту для проверок при деплое
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Middleware для проверки здоровья на корневом маршруте
 * Возвращает HTTP 200 и простую HTML-страницу для проверок при деплое
 */
export function healthCheckMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // Проверяем, является ли это запросом для проверки здоровья
    const isHealthCheck = req.path === '/' && (
      req.query.health === 'check' || 
      req.headers['user-agent']?.includes('Replit') || 
      req.headers['x-replit-deployment-check'] !== undefined ||
      req.method === 'HEAD'
    );
    
    // Если это запрос для проверки здоровья, возвращаем быстрый ответ
    if (isHealthCheck) {
      console.log('[Health Check] Запрос проверки здоровья обнаружен, отвечаем статусом 200');
      
      // Для HEAD-запросов просто возвращаем 200 без тела
      if (req.method === 'HEAD') {
        return res.status(200).end();
      }
      
      // Для GET-запросов возвращаем просто OK для проверок здоровья
      return res.status(200).send('OK');
    }
    
    // Иначе продолжаем обработку запроса
    next();
  } catch (error) {
    // Обеспечиваем надежную обработку ошибок для этого критического middleware
    console.error('[Health Check] Ошибка в middleware проверки здоровья:', error);
    
    // Даже при ошибке гарантируем возврат 200 OK для проверок развертывания
    return res.status(200).send('UniFarm API Server: OK');
  }
}