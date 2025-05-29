/**
 * Middleware для проверки прав доступа администратора
 * 
 * Проверяет, имеет ли текущий пользователь права администратора.
 * В простейшей реализации проверяет, является ли пользователь
 * пользователем с ID=1 (суперадминистратор).
 * 
 * В более сложной реализации может проверять роли пользователя
 * из базы данных или другого источника.
 */

import { Request, Response, NextFunction } from 'express';

// Интерфейс для типизации расширенного объекта запроса с пользователем
interface RequestWithUser extends Request {
  user?: {
    id: number;
    [key: string]: any;
  };
}

/**
 * Middleware для проверки прав администратора
 * В текущей реализации считаем администратором пользователя с ID=1
 * 
 * Для тестирования API используется заголовок X-Admin-User-ID,
 * который содержит ID пользователя, имеющего права администратора.
 */
export function adminAuthMiddleware(req: RequestWithUser, res: Response, next: NextFunction) {
  console.log(`[AdminAuth] Начало проверки доступа: ${req.method} ${req.originalUrl}`);
  console.log(`[AdminAuth] Заголовки запроса:`, JSON.stringify(req.headers, null, 2));
  
  // Проверяем заголовок X-Admin-User-ID для тестирования API
  const adminUserIdHeader = req.header('X-Admin-User-ID');
  console.log(`[AdminAuth] Заголовок X-Admin-User-ID: ${adminUserIdHeader || 'отсутствует'}`);
  
  // Если заголовок X-Admin-User-ID есть и это числовой ID=1,
  // считаем пользователя администратором
  if (adminUserIdHeader && parseInt(adminUserIdHeader) === 1) {
    // Устанавливаем объект пользователя для дальнейшего использования
    req.user = { 
      id: 1,
      role: 'admin',
      fromHeader: true 
    };
    
    console.log(`[AdminAuth] Доступ разрешен: пользователь #1 аутентифицирован как администратор через заголовок`);
    return next();
  }
  
  // Если заголовок не задан, проверяем авторизацию через сессию
  if (!req.user) {
    console.log('[AdminAuth] Доступ запрещен: пользователь не авторизован');
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Для доступа к этому ресурсу требуется авторизация'
    });
  }
  
  // ID администратора (в продакшне лучше хранить в базе или переменных окружения)
  const adminUserId = 1;
  
  // Проверка прав: пользователь должен быть администратором
  if (req.user.id !== adminUserId) {
    console.log(`[AdminAuth] Доступ запрещен: пользователь #${req.user.id} не является администратором`);
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Недостаточно прав для доступа к этому ресурсу'
    });
  }
  
  // Если все проверки пройдены, пропускаем запрос дальше
  console.log(`[AdminAuth] Доступ разрешен: пользователь #${req.user.id} аутентифицирован как администратор`);
  next();
}