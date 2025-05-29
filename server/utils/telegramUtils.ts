/**
 * Утилиты для работы с Telegram Mini App
 */

import crypto from 'crypto';

/**
 * Тип для результата валидации Telegram данных
 */
export interface TelegramValidationResult {
  isValid: boolean;
  userId?: number | string;
  username?: string;
  firstName?: string;
  lastName?: string;
  errors?: string[];
}

/**
 * Проверяет валидность данных Telegram Mini App
 * @param initData - Строка инициализации от Telegram Mini App
 * @param botToken - Токен телеграм бота (опционально)
 * @param isDevelopment - Режим разработки (разрешает пустые данные)
 * @returns Результат проверки
 */
export function validateTelegramInitData(
  initData: string, 
  botToken?: string,
  isDevelopment: boolean = false
): TelegramValidationResult {
  try {
    // В режиме разработки разрешаем пустые данные
    if (isDevelopment && !initData) {
      return {
        isValid: true,
        userId: '12345678',
        username: 'dev_user',
        firstName: 'Dev',
        lastName: 'User'
      };
    }
    
    // Если initData пустой, возвращаем ошибку
    if (!initData) {
      return { isValid: false, errors: ['Отсутствуют данные initData'] };
    }
    
    // Парсим данные initData
    const params = new URLSearchParams(initData);
    
    // Получаем hash из initData
    const hash = params.get('hash');
    if (!hash) {
      return { isValid: false, errors: ['Отсутствует hash в initData'] };
    }
    
    // В режиме разработки пропускаем проверку подписи
    if (isDevelopment) {
      return {
        isValid: true,
        userId: params.get('id') || '12345678',
        username: params.get('username') || 'dev_user',
        firstName: params.get('first_name') || 'Dev',
        lastName: params.get('last_name') || 'User'
      };
    }
    
    // Проверяем время инициализации (auth_date)
    const authDate = params.get('auth_date');
    if (!isDevelopment && authDate) {
      const authTimestamp = parseInt(authDate, 10);
      const currentTimestamp = Math.floor(Date.now() / 1000);
      
      // Допустимое время жизни данных - 24 часа (86400 секунд)
      const maxLifetime = 86400;
      
      if (currentTimestamp - authTimestamp > maxLifetime) {
        return { isValid: false, errors: ['Истек срок действия данных авторизации Telegram'] };
      }
    }
    
    // Проверяем, что у нас есть токен бота для проверки
    if (!botToken) {
      return { isValid: false, errors: ['Отсутствует токен бота для валидации'] };
    }
    
    // Создаем копию объекта URLSearchParams без hash параметра для проверки
    const dataParams = new URLSearchParams(initData);
    dataParams.delete('hash');

    // Сортируем параметры в алфавитном порядке
    const sortedParams: [string, string][] = [];
    dataParams.forEach((value, key) => {
      sortedParams.push([key, value]);
    });
    
    sortedParams.sort(([a], [b]) => a.localeCompare(b));

    // Создаем строку для проверки подписи
    const dataCheckString = sortedParams
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    // Создаем секретный ключ из токена бота
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    
    // Вычисляем ожидаемый хеш
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');
    
    // Сравниваем полученный и ожидаемый хеши
    const isValid = calculatedHash === hash;
    
    if (!isValid) {
      return { isValid: false, errors: ['Неверная подпись данных'] };
    }
    
    // Попытка извлечь данные пользователя из JSON-строки поля user
    let userId = params.get('id');
    let username = params.get('username');
    let firstName = params.get('first_name');
    let lastName = params.get('last_name');
    
    // Если есть поле user, попробуем его распарсить
    const userStr = params.get('user');
    if (userStr) {
      try {
        const userData = JSON.parse(userStr);
        userId = userId || userData.id?.toString();
        username = username || userData.username;
        firstName = firstName || userData.first_name;
        lastName = lastName || userData.last_name;
      } catch (e) {
        // Игнорируем ошибки парсинга
      }
    }
    
    return {
      isValid: true,
      userId: userId || undefined,
      username: username || undefined,
      firstName: firstName || undefined,
      lastName: lastName || undefined
    };
  } catch (error) {
    return { 
      isValid: false, 
      errors: [`Ошибка при проверке данных Telegram: ${error instanceof Error ? error.message : String(error)}`] 
    };
  }
}

/**
 * Получает параметр из start параметра Telegram
 * @param startParam - Строка start параметра
 * @returns Декодированный параметр
 */
export function extractReferralCodeFromStartParam(startParam: string | null): string | null {
  if (!startParam) return null;
  
  // Если стартовый параметр соответствует формату реферального кода, возвращаем его
  if (/^[A-Z0-9]{8}$/.test(startParam)) {
    return startParam;
  }
  
  // Пытаемся декодировать URL-encoded или base64 параметр
  try {
    // Проверяем URL-encoded параметр
    if (startParam.includes('%')) {
      const decoded = decodeURIComponent(startParam);
      if (/^[A-Z0-9]{8}$/.test(decoded)) {
        return decoded;
      }
    }
    
    // Пытаемся расшифровать как base64
    const decoded = Buffer.from(startParam, 'base64').toString('utf-8');
    if (/^[A-Z0-9]{8}$/.test(decoded)) {
      return decoded;
    }
  } catch (e) {
    // Если произошла ошибка декодирования, просто игнорируем
  }
  
  return null;
}