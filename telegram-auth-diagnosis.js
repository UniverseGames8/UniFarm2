/**
 * Диагностический скрипт для проверки авторизации через Telegram Mini App
 * Анализирует формат и валидацию данных initData от Telegram
 * 
 * Использование:
 * node telegram-auth-diagnosis.js "TELEGRAM_INIT_DATA"
 * 
 * где TELEGRAM_INIT_DATA — это строка с данными авторизации от Telegram
 */

import crypto from 'crypto';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const querystring = require('querystring');

// Проверяем наличие переменной окружения с токеном бота
console.log('[Диагностика Auth] 📊 Проверка наличия токена Telegram бота...');

// Проверяем наличие TELEGRAM_BOT_TOKEN
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('[Диагностика Auth] ⚠️ Переменная окружения TELEGRAM_BOT_TOKEN не найдена!');
  console.log('[Диагностика Auth] ℹ️ Валидация подписи initData не будет возможна без токена бота.');
} else {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const maskedToken = token.substring(0, 5) + '...' + token.substring(token.length - 5);
  console.log(`[Диагностика Auth] ✅ Токен бота найден: ${maskedToken}`);
}

// Получаем initData из аргументов командной строки
const initData = process.argv[2];

if (!initData) {
  console.error('[Диагностика Auth] ❌ Ошибка: Необходимо указать initData как аргумент.');
  console.log('Пример использования: node telegram-auth-diagnosis.js "query_id=AAHdF6IQAAAAAN0XohDhrOrc&user=%7B%22id%22%3A123456789%2C%22first_name%22..."');
  process.exit(1);
}

console.log('[Диагностика Auth] 🔍 Начинаем анализ данных initData...');

// Функция для проверки валидности данных инициализации
function validateInitData(initData, botToken) {
  try {
    // Разбираем строку initData
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    
    if (!hash) {
      return {
        isValid: false,
        error: 'Отсутствует hash в initData',
        params: Object.fromEntries(urlParams.entries())
      };
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
    
    // Если есть токен бота, проверяем подпись
    if (botToken) {
      // Создаем HMAC-SHA-256 подпись
      const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
      const calculatedHash = crypto.createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');
      
      // Проверяем подпись
      const isValid = calculatedHash === hash;
      
      return {
        isValid,
        calculatedHash,
        receivedHash: hash,
        error: isValid ? null : 'Hash не совпадает с расчетным значением',
        params: Object.fromEntries(urlParams.entries())
      };
    } else {
      // Если токен бота недоступен, возвращаем только данные без проверки
      return {
        isValid: null, // Невозможно проверить без токена
        error: 'Токен бота недоступен для проверки подписи',
        params: Object.fromEntries(urlParams.entries())
      };
    }
  } catch (error) {
    return {
      isValid: false,
      error: `Ошибка при обработке initData: ${error.message}`,
      originalError: error
    };
  }
}

// Функция для разбора пользовательских данных из initData
function parseUserData(initData) {
  try {
    const urlParams = new URLSearchParams(initData);
    const userStr = urlParams.get('user');
    
    if (!userStr) {
      return {
        success: false,
        error: 'Поле user отсутствует в initData'
      };
    }
    
    // Пытаемся разобрать JSON строку с данными пользователя
    const user = JSON.parse(userStr);
    
    // Проверяем обязательные поля пользователя
    const requiredFields = ['id', 'first_name'];
    const missingFields = requiredFields.filter(field => !user[field]);
    
    if (missingFields.length > 0) {
      return {
        success: false,
        error: `Отсутствуют обязательные поля в данных пользователя: ${missingFields.join(', ')}`,
        user
      };
    }
    
    return {
      success: true,
      user
    };
  } catch (error) {
    return {
      success: false,
      error: `Ошибка при разборе данных пользователя: ${error.message}`,
      originalError: error
    };
  }
}

// Основная функция для проверки initData
function checkInitData(initData) {
  console.log('[Диагностика Auth] 📝 Предоставленная строка initData:');
  console.log(initData);
  
  // Проверяем формат данных
  let validationResult;
  try {
    validationResult = validateInitData(initData, process.env.TELEGRAM_BOT_TOKEN);
    
    console.log('\n[Диагностика Auth] 🔐 Результат проверки подписи:');
    if (validationResult.isValid === null) {
      console.log('⚠️ Проверка подписи невозможна из-за отсутствия токена бота');
    } else if (validationResult.isValid) {
      console.log('✅ Подпись initData верна!');
    } else {
      console.error('❌ Подпись initData недействительна!');
      console.error(`Полученный hash: ${validationResult.receivedHash}`);
      console.error(`Расчетный hash: ${validationResult.calculatedHash}`);
    }
    
    // Показываем полученные параметры
    console.log('\n[Диагностика Auth] 📋 Параметры из initData:');
    for (const [key, value] of Object.entries(validationResult.params || {})) {
      if (key === 'user') {
        console.log(`${key}: <сложные данные>`);
      } else {
        console.log(`${key}: ${value}`);
      }
    }
    
    // Проверяем данные пользователя
    console.log('\n[Диагностика Auth] 👤 Анализ данных пользователя:');
    const userResult = parseUserData(initData);
    
    if (userResult.success) {
      console.log('✅ Данные пользователя успешно разобраны');
      console.log('ID пользователя:', userResult.user.id);
      console.log('Имя:', userResult.user.first_name);
      console.log('Фамилия:', userResult.user.last_name || '<не указана>');
      console.log('Username:', userResult.user.username || '<не указан>');
      
      // Имитируем поиск пользователя в базе данных
      console.log('\n[Диагностика Auth] 🔍 Симуляция восстановления сессии:');
      console.log(`1. Поиск пользователя с telegram_id = ${userResult.user.id}`);
      console.log('2. Если найден - восстановление сессии');
      console.log('3. Если не найден - создание нового пользователя');
      
      // Проверяем наличие startParam для реферальной системы
      const startParam = validationResult.params.start_param || null;
      if (startParam) {
        console.log('\n[Диагностика Auth] 🔗 Обнаружен реферальный параметр:');
        console.log(`Реферальный код: ${startParam}`);
        console.log('Этот код должен быть сохранен при создании пользователя для связи с приглашающим.');
      }
    } else {
      console.error('❌ Ошибка при разборе данных пользователя:');
      console.error(userResult.error);
    }
    
  } catch (error) {
    console.error('[Диагностика Auth] ❌ Критическая ошибка при обработке initData:');
    console.error(error);
  }
  
  // Общие рекомендации
  console.log('\n[Диагностика Auth] 📝 Общие рекомендации:');
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.log('⚠️ Необходимо установить переменную окружения TELEGRAM_BOT_TOKEN для валидации подписи.');
  }
  
  if (validationResult && validationResult.error) {
    console.log(`⚠️ Исправить проблему: ${validationResult.error}`);
  }
  
  console.log('✅ Убедитесь, что обработка initData происходит на каждом запросе к /api/session/restore.');
  console.log('✅ Проверьте корректность настроек CORS для работы с Telegram Mini App.');
  console.log('✅ Убедитесь, что сессия сохраняется в cookies с правильными параметрами Secure и SameSite.');
}

// Запуск проверки
checkInitData(initData);