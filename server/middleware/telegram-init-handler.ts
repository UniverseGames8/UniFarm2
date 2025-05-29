/**
 * Покращений обробник initData з Telegram Mini App
 * 
 * Цей модуль обробляє та валідує дані від Telegram Mini App,
 * забезпечуючи стабільну роботу навіть при проблемах з валідацією.
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Налаштування для логів
const logEnabled = process.env.TELEGRAM_DEBUG === 'true';
const logPath = path.join(process.cwd(), 'logs');

// Створення директорії для логів, якщо вона не існує
if (logEnabled && !fs.existsSync(logPath)) {
  try {
    fs.mkdirSync(logPath, { recursive: true });
  } catch (err) {
    console.error('[TelegramMiddleware] Помилка створення директорії для логів:', err);
  }
}

// Функція для логування
function log(message: string, isError = false): void {
  if (!logEnabled) return;
  
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  console[isError ? 'error' : 'log'](message);
  
  if (logEnabled) {
    try {
      const logFile = path.join(logPath, isError ? 'telegram-errors.log' : 'telegram-access.log');
      fs.appendFileSync(logFile, logMessage);
    } catch (err) {
      console.error('[TelegramMiddleware] Помилка запису в лог-файл:', err);
    }
  }
}

/**
 * Отримує дані initData з різних місць запиту
 */
function getInitDataFromRequest(req: Request): string | null {
  // Спочатку перевіряємо заголовки
  const initData = 
    req.headers['telegram-init-data'] || 
    req.headers['x-telegram-init-data'] || 
    req.headers['initdata'] || 
    req.headers['x-initdata'] ||
    req.get('telegram-init-data') ||
    req.get('x-telegram-init-data') ||
    req.get('initdata') ||
    req.get('x-initdata');
  
  if (initData && typeof initData === 'string') {
    return initData;
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
 * Отримує реферальний код з різних місць запиту
 */
function getReferralCodeFromRequest(req: Request): string | null {
  // Перевіряємо start_param в initData
  const initData = getInitDataFromRequest(req);
  if (initData) {
    try {
      const urlParams = new URLSearchParams(initData);
      const startParam = urlParams.get('start_param');
      if (startParam) {
        return startParam;
      }
    } catch (e) {
      // Ігноруємо помилки парсингу
    }
  }
  
  // Перевіряємо параметри запиту
  if (req.query && req.query.ref_code && typeof req.query.ref_code === 'string') {
    return req.query.ref_code;
  }
  
  if (req.query && req.query.start_param && typeof req.query.start_param === 'string') {
    return req.query.start_param;
  }
  
  // Перевіряємо тіло запиту
  if (req.body && req.body.ref_code && typeof req.body.ref_code === 'string') {
    return req.body.ref_code;
  }
  
  if (req.body && req.body.start_param && typeof req.body.start_param === 'string') {
    return req.body.start_param;
  }
  
  return null;
}

/**
 * Парсить та валідує дані initData
 */
function validateInitData(initData: string, skipValidation = false): {
  isValid: boolean;
  userData?: any;
  userId?: number | string;
  startParam?: string;
  errors?: string[];
} {
  const errors: string[] = [];
  
  if (!initData) {
    errors.push('initData відсутній');
    return { isValid: false, errors };
  }
  
  try {
    // Розбираємо рядок initData
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    
    if (!hash) {
      errors.push('Відсутній hash в initData');
      return { isValid: false, errors };
    }
    
    // Парсимо інші дані
    const userData = urlParams.get('user');
    const authDate = urlParams.get('auth_date');
    const startParam = urlParams.get('start_param');
    
    // Перевіряємо наявність обов'язкових полів
    if (!authDate) {
      errors.push('Відсутня дата авторизації (auth_date)');
    }
    
    // Парсимо дані користувача
    let parsedUserData = null;
    let userId = null;
    
    if (userData) {
      try {
        parsedUserData = JSON.parse(userData);
        userId = parsedUserData.id;
      } catch (e) {
        errors.push(`Помилка розбору даних користувача: ${e instanceof Error ? e.message : String(e)}`);
      }
    } else {
      errors.push('Відсутні дані користувача');
    }
    
    // Перевіряємо підпис, якщо не вказано пропустити валідацію
    if (!skipValidation && process.env.TELEGRAM_BOT_TOKEN) {
      // Створюємо масив даних для перевірки
      const dataCheckArr: string[] = [];
      
      urlParams.forEach((val, key) => {
        if (key !== 'hash') {
          dataCheckArr.push(`${key}=${val}`);
        }
      });
      
      // Сортуємо масив
      dataCheckArr.sort();
      
      // Створюємо рядок даних
      const dataCheckString = dataCheckArr.join('\n');
      
      // Створюємо HMAC-SHA-256 підпис
      const secretKey = crypto.createHmac('sha256', 'WebAppData')
        .update(process.env.TELEGRAM_BOT_TOKEN)
        .digest();
      
      const calculatedHash = crypto.createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');
      
      // Перевіряємо підпис
      if (calculatedHash !== hash) {
        errors.push('Недійсний підпис (hash)');
      }
      
      // Перевіряємо термін дії
      if (authDate) {
        const authDateTimestamp = parseInt(authDate, 10) * 1000;
        const now = Date.now();
        const maxAge = (process.env.TELEGRAM_MAX_AGE_HOURS ? 
          parseInt(process.env.TELEGRAM_MAX_AGE_HOURS, 10) : 24) * 60 * 60 * 1000;
        
        if (now - authDateTimestamp > maxAge) {
          errors.push(`Дані застаріли (більше ${maxAge / (60 * 60 * 1000)} годин)`);
        }
      }
    }
    
    // Визначаємо результат валідації
    const isValid = skipValidation || errors.length === 0;
    
    return {
      isValid,
      userData: parsedUserData,
      userId,
      startParam,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (e) {
    errors.push(`Помилка обробки initData: ${e instanceof Error ? e.message : String(e)}`);
    return { isValid: false, errors };
  }
}

/**
 * Проміжний обробник для валідації даних Telegram Mini App
 */
export function telegramInitDataMiddleware(options: {
  skipValidation?: boolean;
  allowBrowserAccess?: boolean;
  requireAuth?: boolean;
} = {}) {
  const {
    skipValidation = process.env.SKIP_TELEGRAM_CHECK === 'true',
    allowBrowserAccess = process.env.ALLOW_BROWSER_ACCESS === 'true',
    requireAuth = false
  } = options;
  
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Отримуємо initData
      const initData = getInitDataFromRequest(req);
      const referralCode = getReferralCodeFromRequest(req);
      
      // Додаємо інформацію про Telegram до запиту
      req.telegram = {
        initData: initData || '',
        validated: false,
        user: null,
        userId: null,
        startParam: referralCode || null
      };
      
      // Логуємо запит
      const userAgent = req.headers['user-agent'] || 'Невідомо';
      const ip = req.ip || req.socket.remoteAddress || 'Невідомо';
      log(`Запит від ${ip}, User-Agent: ${userAgent}, Path: ${req.path}`);
      
      // Пропускаємо валідацію, якщо вказано
      if (skipValidation) {
        log('Валідацію пропущено (SKIP_TELEGRAM_CHECK=true)');
        req.telegram.validated = true;
        return next();
      }
      
      // Дозволяємо доступ з браузера, якщо вказано
      if (!initData && allowBrowserAccess) {
        log('Дозволено доступ з браузера (ALLOW_BROWSER_ACCESS=true)');
        req.telegram.validated = true;
        return next();
      }
      
      // Якщо немає initData і потрібна авторизація
      if (!initData && requireAuth) {
        log('Відмовлено в доступі: немає initData і потрібна авторизація', true);
        return res.status(401).json({
          success: false,
          error: 'Необхідна авторизація через Telegram'
        });
      }
      
      // Якщо є initData, валідуємо
      if (initData) {
        const validationResult = validateInitData(initData, skipValidation);
        
        req.telegram.validated = validationResult.isValid;
        req.telegram.user = validationResult.userData || null;
        req.telegram.userId = validationResult.userId || null;
        
        // Використовуємо startParam з валідації або реферальний код
        const validStartParam = validationResult.startParam || referralCode || '';
        req.telegram.startParam = validStartParam.length > 0 ? validStartParam : null;
        
        // Якщо валідація не пройшла і потрібна авторизація
        if (!validationResult.isValid && requireAuth) {
          log(`Відмовлено в доступі: невалідні дані ${validationResult.errors?.join(', ')}`, true);
          return res.status(401).json({
            success: false,
            error: 'Недійсні дані авторизації Telegram',
            details: validationResult.errors
          });
        }
        
        if (validationResult.isValid) {
          log(`Успішна валідація для користувача ID:${req.telegram.userId}`);
        } else {
          log(`Невалідні дані, але дозволено доступ: ${validationResult.errors?.join(', ')}`);
        }
      }
      
      next();
    } catch (error) {
      log(`Помилка в middleware: ${error instanceof Error ? error.message : String(error)}`, true);
      
      // Не блокуємо запит при помилці, але записуємо інформацію
      req.telegram = {
        initData: '',
        validated: false,
        user: null,
        userId: null,
        startParam: null,
        error: error instanceof Error ? error.message : String(error)
      };
      
      next();
    }
  };
}

// Розширюємо інтерфейс Request для TypeScript
declare global {
  namespace Express {
    interface Request {
      telegram: {
        initData: string;
        validated: boolean;
        user: any;
        userId: number | string | null;
        startParam: string | null;
        error?: string;
      };
    }
  }
}

export default telegramInitDataMiddleware;