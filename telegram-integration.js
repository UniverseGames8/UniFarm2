/**
 * Интеграция Telegram Mini App с UniFarm
 * 
 * Этот модуль обеспечивает:
 * 1. Корректную проверку данных авторизации от Telegram
 * 2. Создание и авторизацию пользователей с данными из Telegram
 * 3. Восстановление сессии для авторизованных пользователей
 * 
 * Модуль использует уже существующие в проекте зависимости.
 */

const crypto = require('crypto');
const express = require('express');

/**
 * Проверяет подпись данных initData от Telegram
 * @param {string} initData - Строка initData от Telegram
 * @param {string} botToken - Токен бота Telegram
 * @returns {boolean} - Результат проверки
 */
function validateTelegramInitData(initData, botToken) {
  try {
    // Проверяем наличие токена и данных
    if (!botToken || !initData) {
      return false;
    }
    
    // Разбираем строку initData
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    
    if (!hash) {
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
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');
    
    // Проверяем подпись
    return calculatedHash === hash;
  } catch (error) {
    console.error('[Telegram Integration] ❌ Ошибка при проверке подписи:', error.message);
    return false;
  }
}

/**
 * Извлекает данные пользователя из строки initData
 * @param {string} initData - Строка initData от Telegram
 * @returns {Object|null} - Объект с данными пользователя или null при ошибке
 */
function extractUserData(initData) {
  try {
    const urlParams = new URLSearchParams(initData);
    const userStr = urlParams.get('user');
    
    if (!userStr) {
      return null;
    }
    
    return JSON.parse(userStr);
  } catch (error) {
    console.error('[Telegram Integration] ❌ Ошибка при извлечении данных пользователя:', error.message);
    return null;
  }
}

/**
 * Получает startParam из строки initData (для реферального кода)
 * @param {string} initData - Строка initData от Telegram
 * @returns {string|null} - Значение startParam или null
 */
function getStartParam(initData) {
  try {
    const urlParams = new URLSearchParams(initData);
    return urlParams.get('start_param');
  } catch {
    return null;
  }
}

/**
 * Настраивает маршруты для интеграции с Telegram Mini App
 * @param {Object} app - Express-приложение
 * @param {Object} storage - Хранилище данных (опционально)
 */
function setupTelegramRoutes(app, storage) {
  if (!app) return;
  
  // Создаем middleware для проверки и обработки данных от Telegram
  const telegramAuthMiddleware = (req, res, next) => {
    try {
      // Получаем initData из различных возможных источников
      const initData = req.body.initData || 
                       req.headers['telegram-init-data'] || 
                       req.headers['x-telegram-init-data'];
      
      // Если нет данных, просто продолжаем
      if (!initData) {
        return next();
      }
      
      // Проверяем данные, если есть токен бота
      let isValid = true;
      if (process.env.TELEGRAM_BOT_TOKEN) {
        isValid = validateTelegramInitData(initData, process.env.TELEGRAM_BOT_TOKEN);
        
        if (!isValid && process.env.NODE_ENV !== 'development') {
          console.warn('[Telegram Integration] ⚠️ Невалидная подпись данных от Telegram');
        }
      }
      
      // Даже если подпись невалидна, в режиме разработки мы извлекаем данные
      // для отладки (в production это не выполняется)
      if (isValid || process.env.NODE_ENV === 'development') {
        // Извлекаем данные пользователя
        const userData = extractUserData(initData);
        if (userData) {
          req.telegramUser = userData;
          
          // В режиме разработки выводим данные пользователя
          if (process.env.NODE_ENV === 'development') {
            console.log('[Telegram Integration] 👤 Данные пользователя:', {
              id: userData.id,
              username: userData.username,
              first_name: userData.first_name,
              last_name: userData.last_name
            });
          }
        }
        
        // Получаем реферальный код из startParam
        const startParam = getStartParam(initData);
        if (startParam) {
          req.telegramStartParam = startParam;
          console.log('[Telegram Integration] 🔗 Реферальный код:', startParam);
        }
      }
      
      next();
    } catch (error) {
      console.error('[Telegram Integration] ❌ Ошибка при проверке данных Telegram:', error.message);
      next();
    }
  };
  
  // Применяем middleware для проверки всех API-запросов
  app.use('/api', telegramAuthMiddleware);
  
  // Маршрут для восстановления сессии с данными Telegram
  app.post('/api/telegram/auth', async (req, res) => {
    try {
      // Проверяем наличие данных пользователя Telegram
      if (!req.telegramUser) {
        return res.status(400).json({
          success: false,
          error: 'Отсутствуют или недействительны данные Telegram'
        });
      }
      
      // Если есть данные пользователя, пытаемся найти в базе данных
      if (storage && typeof storage.getUserByTelegramId === 'function') {
        try {
          let user = await storage.getUserByTelegramId(req.telegramUser.id.toString());
          
          // Если пользователь не найден, создаем нового
          if (!user) {
            console.log(`[Telegram Integration] 🆕 Создаем нового пользователя для Telegram ID: ${req.telegramUser.id}`);
            
            // Генерируем уникальный гостевой ID
            const guestId = crypto.randomUUID();
            
            // Создаем нового пользователя с данными из Telegram
            user = await storage.createUser({
              username: req.telegramUser.username || `user_${req.telegramUser.id}`,
              telegram_id: req.telegramUser.id.toString(),
              first_name: req.telegramUser.first_name,
              last_name: req.telegramUser.last_name || '',
              guest_id: guestId,
              // Если есть реферальный код, сохраняем его
              parent_ref_code: req.telegramStartParam || null
            });
            
            console.log(`[Telegram Integration] ✅ Пользователь создан с ID: ${user.id}`);
          } else {
            console.log(`[Telegram Integration] ✅ Пользователь найден с ID: ${user.id}`);
          }
          
          // Сохраняем пользователя в сессии
          if (req.session) {
            req.session.userId = user.id;
            req.session.user = {
              id: user.id,
              username: user.username,
              telegram_id: user.telegram_id
            };
            console.log(`[Telegram Integration] ✅ Данные пользователя сохранены в сессии`);
          }
          
          // Возвращаем данные пользователя
          return res.json({
            success: true,
            data: {
              user_id: user.id,
              username: user.username,
              telegram_id: user.telegram_id,
              balance_uni: user.balance_uni,
              balance_ton: user.balance_ton,
              ref_code: user.ref_code,
              created_at: user.created_at
            }
          });
        } catch (storageError) {
          console.error('[Telegram Integration] ❌ Ошибка при работе с хранилищем:', storageError.message);
          return res.status(500).json({
            success: false,
            error: 'Ошибка при обработке данных пользователя'
          });
        }
      } else {
        // Если storage не доступен, возвращаем только данные из Telegram
        return res.json({
          success: true,
          data: {
            telegram_id: req.telegramUser.id,
            username: req.telegramUser.username,
            first_name: req.telegramUser.first_name,
            last_name: req.telegramUser.last_name,
            is_temporary: true
          }
        });
      }
    } catch (error) {
      console.error('[Telegram Integration] ❌ Ошибка при авторизации:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Внутренняя ошибка сервера при авторизации'
      });
    }
  });
  
  // Маршрут для проверки авторизации
  app.get('/api/telegram/me', (req, res) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Не авторизован'
      });
    }
    
    return res.json({
      success: true,
      data: req.session.user
    });
  });
  
  // Маршрут для выхода из системы
  app.post('/api/telegram/logout', (req, res) => {
    if (req.session) {
      req.session.destroy();
    }
    
    return res.json({
      success: true,
      message: 'Выход выполнен успешно'
    });
  });
  
  console.log('[Telegram Integration] ✅ Маршруты для интеграции с Telegram настроены');
}

/**
 * Настраивает полную интеграцию с Telegram Mini App
 * @param {Object} app - Express-приложение
 * @param {Object} storage - Хранилище данных (опционально)
 * @returns {Object} - Express-приложение с настроенной интеграцией
 */
function setupTelegramIntegration(app, storage) {
  if (!app) {
    throw new Error('[Telegram Integration] Не предоставлен экземпляр приложения Express');
  }
  
  console.log('[Telegram Integration] 🔧 Настройка интеграции с Telegram Mini App...');
  
  // Проверяем наличие токена бота
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.warn('[Telegram Integration] ⚠️ Переменная окружения TELEGRAM_BOT_TOKEN не установлена');
    console.warn('Проверка подписи данных Telegram будет отключена');
  }
  
  // Настраиваем маршруты для работы с Telegram
  setupTelegramRoutes(app, storage);
  
  console.log('[Telegram Integration] ✅ Интеграция с Telegram Mini App настроена');
  
  return app;
}

module.exports = {
  setupTelegramIntegration,
  validateTelegramInitData,
  extractUserData
};