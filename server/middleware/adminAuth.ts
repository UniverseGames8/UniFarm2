/**
 * Middleware для аутентификации администраторов по Telegram username
 * 
 * Проверяет, что запрос исходит от авторизованного администратора
 * на основе Telegram username, который невозможно подделать.
 */

import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

interface AdminAuthRequest extends Request {
  admin?: {
    username: string;
    isAuthenticated: boolean;
    authenticatedAt: Date;
  };
}

/**
 * Список авторизованных администраторов (Telegram usernames)
 * В production должен быть в переменных окружения
 */
const getAuthorizedAdmins = (): string[] => {
  const adminUsernames = process.env.ADMIN_USERNAMES;
  if (!adminUsernames) {
    logger.warn('[AdminAuth] ADMIN_USERNAMES не настроен в переменных окружения');
    return [];
  }
  
  return adminUsernames.split(',').map(username => username.trim().toLowerCase());
};

/**
 * Middleware для проверки админских прав по username
 */
export const requireAdminAuth = (req: AdminAuthRequest, res: Response, next: NextFunction): void => {
  try {
    // Получаем username из разных источников
    const username = (
      req.query.admin_username || 
      req.body.admin_username || 
      req.headers['x-admin-username']
    ) as string;

    // Получаем секретный ключ для дополнительной защиты
    const adminKey = (
      req.query.admin_key || 
      req.body.admin_key || 
      req.headers['x-admin-key']
    ) as string;

    // Проверяем наличие обязательных параметров
    if (!username || !adminKey) {
      logger.warn('[AdminAuth] Попытка доступа без username или admin_key', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        hasUsername: !!username,
        hasAdminKey: !!adminKey
      });

      return res.status(401).json({
        success: false,
        error: 'Требуется аутентификация: admin_username и admin_key'
      });
    }

    // Проверяем секретный ключ
    if (adminKey !== process.env.ADMIN_SECRET) {
      logger.warn('[AdminAuth] Неверный admin_key', {
        ip: req.ip,
        username: username,
        path: req.path
      });

      return res.status(403).json({
        success: false,
        error: 'Неверный ключ доступа'
      });
    }

    // Получаем список авторизованных администраторов
    const authorizedAdmins = getAuthorizedAdmins();
    
    if (authorizedAdmins.length === 0) {
      logger.error('[AdminAuth] Список администраторов пуст - доступ заблокирован');
      return res.status(503).json({
        success: false,
        error: 'Административная панель временно недоступна'
      });
    }

    // Проверяем, есть ли username в списке администраторов
    const normalizedUsername = username.toLowerCase().replace('@', '');
    const isAuthorized = authorizedAdmins.includes(normalizedUsername);

    if (!isAuthorized) {
      logger.warn('[AdminAuth] Неавторизованная попытка доступа', {
        username: normalizedUsername,
        ip: req.ip,
        path: req.path,
        userAgent: req.get('User-Agent'),
        authorizedAdmins: authorizedAdmins.length
      });

      return res.status(403).json({
        success: false,
        error: 'Доступ запрещен: неавторизованный пользователь'
      });
    }

    // Успешная аутентификация
    req.admin = {
      username: normalizedUsername,
      isAuthenticated: true,
      authenticatedAt: new Date()
    };

    // Логируем успешный доступ администратора
    logger.info('[AdminAuth] Успешная аутентификация администратора', {
      username: normalizedUsername,
      ip: req.ip,
      path: req.path,
      timestamp: new Date().toISOString()
    });

    next();
  } catch (error) {
    logger.error('[AdminAuth] Ошибка при проверке админских прав:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Ошибка сервера при аутентификации'
    });
  }
};

/**
 * Middleware для логирования всех админских действий
 */
export const logAdminAction = (action: string) => {
  return (req: AdminAuthRequest, res: Response, next: NextFunction): void => {
    const adminUsername = req.admin?.username || 'unknown';
    
    logger.info('[AdminAudit] Административное действие', {
      action: action,
      admin: adminUsername,
      ip: req.ip,
      path: req.path,
      method: req.method,
      query: req.query,
      timestamp: new Date().toISOString(),
      userAgent: req.get('User-Agent')
    });

    next();
  };
};

export default requireAdminAuth;