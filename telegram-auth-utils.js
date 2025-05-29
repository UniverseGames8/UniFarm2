/**
 * Утилиты для авторизации через Telegram Mini App
 * Модуль включает функции для проверки и разбора данных initData от Telegram
 */

const crypto = require('crypto');
const querystring = require('querystring');

/**
 * Проверяет подпись данных initData от Telegram
 * @param {string} initData - Строка initData от Telegram Mini App
 * @returns {boolean} - Результат проверки подписи
 */
function validateTelegramInitData(initData) {
  try {
    // Проверяем наличие токена бота
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      console.error('[Telegram Auth] ⚠️ TELEGRAM_BOT_TOKEN не установлен');
      return false;
    }
    
    // Разбираем строку initData
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    
    if (!hash) {
      console.error('[Telegram Auth] ⚠️ Отсутствует hash в initData');
      return false;
    }
    
    // Создаем массив данных для проверки
    const dataCheckArr = [];
    
    // Создаем отсортированный массив параметров (без hash)
    urlParams.forEach((val, key) => {
      if (key !== 'hash') {
        dataCheckArr.push(`${key}=${val}`);
      }
    });
    
    // Сортируем массив
    dataCheckArr.sort();
    
    // Создаем строку данных
    const dataCheckString = dataCheckArr.join('\n');
    
    // Создаем HMAC-SHA-256 подпись
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(process.env.TELEGRAM_BOT_TOKEN).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');
    
    // Проверяем подпись
    const isValid = calculatedHash === hash;
    
    if (!isValid) {
      console.error('[Telegram Auth] ⚠️ Неверная подпись initData');
      console.error(`[Telegram Auth] Вычисленный хеш: ${calculatedHash}`);
      console.error(`[Telegram Auth] Полученный хеш: ${hash}`);
    }
    
    return isValid;
  } catch (error) {
    console.error('[Telegram Auth] ❌ Ошибка при проверке подписи:', error.message);
    return false;
  }
}

/**
 * Разбирает и извлекает данные пользователя из строки initData
 * @param {string} initData - Строка initData от Telegram Mini App
 * @returns {Object|null} - Объект с данными пользователя или null при ошибке
 */
function parseTelegramUserData(initData) {
  try {
    // Разбираем строку initData
    const urlParams = new URLSearchParams(initData);
    const userStr = urlParams.get('user');
    
    if (!userStr) {
      console.error('[Telegram Auth] ⚠️ Отсутствуют данные пользователя в initData');
      return null;
    }
    
    // Разбираем JSON строку с данными пользователя
    const user = JSON.parse(userStr);
    
    // Проверяем обязательные поля
    const requiredFields = ['id', 'first_name'];
    const missingFields = requiredFields.filter(field => !user[field]);
    
    if (missingFields.length > 0) {
      console.error(`[Telegram Auth] ⚠️ Отсутствуют обязательные поля пользователя: ${missingFields.join(', ')}`);
      return null;
    }
    
    // Формируем объект с данными пользователя
    return {
      telegramId: user.id,
      firstName: user.first_name,
      lastName: user.last_name || '',
      username: user.username || '',
      languageCode: user.language_code || 'en',
      isPremium: user.is_premium || false,
      // Дополнительная информация
      authDate: urlParams.get('auth_date'),
      queryId: urlParams.get('query_id'),
      startParam: urlParams.get('start_param')
    };
  } catch (error) {
    console.error('[Telegram Auth] ❌ Ошибка при разборе данных пользователя:', error.message);
    return null;
  }
}

/**
 * Комплексная функция для обработки данных от Telegram
 * Проверяет подпись и извлекает данные пользователя
 * @param {string} initData - Строка initData от Telegram Mini App
 * @returns {Object} - Результат обработки данных
 */
function processTelegramInitData(initData) {
  if (!initData) {
    return {
      isValid: false,
      error: 'Не предоставлены данные initData',
      user: null
    };
  }
  
  // Проверяем подпись
  const isValid = validateTelegramInitData(initData);
  
  if (!isValid) {
    return {
      isValid: false,
      error: 'Недействительная подпись данных',
      user: null
    };
  }
  
  // Извлекаем данные пользователя
  const userData = parseTelegramUserData(initData);
  
  if (!userData) {
    return {
      isValid: true,
      error: 'Ошибка при извлечении данных пользователя',
      user: null
    };
  }
  
  return {
    isValid: true,
    error: null,
    user: userData
  };
}

// Экспортируем функции для использования в других модулях
module.exports = {
  validateTelegramInitData,
  parseTelegramUserData,
  processTelegramInitData
};