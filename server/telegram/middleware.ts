/**
 * Спрощений middleware для роботи з Telegram Mini App
 * 
 * Цей модуль забезпечує обробку даних від Telegram Mini App
 * і додає їх до об'єкту запиту
 */

import { Request, Response, NextFunction } from 'express';

// Визначаємо інтерфейс для даних Telegram
interface TelegramData {
  initData: string;
  user: any | null;
  userId: number | string | null;
  startParam: string | null;
  validated: boolean;
  error?: string;
}

// Розширюємо інтерфейс Request для TypeScript
declare global {
  namespace Express {
    interface Request {
      telegram: TelegramData;
    }
  }
}

/**
 * Отримує дані initData з різних місць запиту
 */
function getInitDataFromRequest(req: Request): string | null {
  // Спочатку перевіряємо заголовки
  const headerInitData = 
    req.headers['telegram-init-data'] || 
    req.headers['x-telegram-init-data'];
  
  if (headerInitData && typeof headerInitData === 'string') {
    return headerInitData;
  }
  
  // Перевіряємо тіло запиту
  if (req.body && req.body.initData && typeof req.body.initData === 'string') {
    return req.body.initData;
  }
  
  // Перевіряємо параметри запиту
  if (req.query && req.query.initData && typeof req.query.initData === 'string') {
    return req.query.initData as string;
  }
  
  return null;
}

/**
 * Парсить дані користувача з initData
 */
function parseUserData(initData: string): { user?: any, userId?: number | string | null, startParam?: string | null } {
  try {
    const urlParams = new URLSearchParams(initData);
    const userData = urlParams.get('user');
    const startParam = urlParams.get('start_param');
    
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        return {
          user: parsedUser,
          userId: parsedUser.id,
          startParam: startParam
        };
      } catch (e) {
        console.warn('[TelegramMiddleware] Помилка парсингу даних користувача:', e);
      }
    }
    
    return { startParam };
  } catch (e) {
    console.warn('[TelegramMiddleware] Помилка парсингу initData:', e);
    return {};
  }
}

/**
 * Middleware для обробки даних Telegram Mini App
 */
export function telegramMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // Отримуємо initData
    const initData = getInitDataFromRequest(req);
    
    if (initData) {
      // Парсимо дані користувача
      const { user, userId, startParam } = parseUserData(initData);
      
      // Додаємо дані до запиту
      req.telegram = {
        initData,
        user: user || null,
        userId: userId || null,
        startParam: startParam || null,
        validated: true
      };
    } else {
      // Встановлюємо пустий об'єкт, якщо немає даних
      req.telegram = {
        initData: '',
        user: null,
        userId: null,
        startParam: null,
        validated: false
      };
    }
    
    // Продовжуємо обробку запиту
    next();
  } catch (error) {
    // Логуємо помилку, але не блокуємо запит
    console.error('[TelegramMiddleware] Помилка:', error);
    req.telegram = { 
      initData: '',
      user: null,
      userId: null,
      startParam: null,
      validated: false 
    };
    next();
  }
}

/**
 * Middleware для захисту API, що вимагає авторизацію Telegram
 */
export function requireTelegramAuth(req: Request, res: Response, next: NextFunction) {
  // Пропускаємо перевірку в режимі розробки
  if (process.env.SKIP_TELEGRAM_CHECK === 'true' || process.env.NODE_ENV === 'development') {
    return next();
  }
  
  // Перевіряємо наявність даних Telegram
  if (!req.telegram || !req.telegram.userId) {
    return res.status(401).json({
      success: false,
      error: 'Необхідна авторизація через Telegram'
    });
  }
  
  next();
}

export default telegramMiddleware;