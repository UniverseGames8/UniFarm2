import { Router } from 'express';
import { handleTelegramWebhook } from './webhook';
import { initializeBot } from './bot';
import logger from '../utils/logger';
import { setupWebhook, getWebhookInfo, setMenuButton } from './setup-hook';

const telegramRouter = Router();

// Вебхук для получения обновлений от Telegram
telegramRouter.post('/webhook', (req, res) => handleTelegramWebhook(req, res));

// Эндпоинт для проверки статуса бота
telegramRouter.get('/status', async (req, res) => {
  try {
    // Отримуємо інформацію про webhook замість прямого виклику API бота
    const webhookInfo = await getWebhookInfo();
    
    // Перевіряємо наявність токену бота
    const hasBotToken = Boolean(process.env.TELEGRAM_BOT_TOKEN);
    
    if (hasBotToken && webhookInfo.success) {
      return res.json({
        success: true,
        data: {
          hasToken: true,
          status: 'online',
          webhookStatus: webhookInfo.info?.url ? 'configured' : 'not_configured',
          webhookUrl: webhookInfo.info?.url,
          timestamp: new Date().toISOString()
        }
      });
    } else if (!hasBotToken) {
      return res.status(503).json({
        success: false,
        error: 'TELEGRAM_BOT_TOKEN не налаштовано',
        details: 'Токен бота відсутній у змінних середовища'
      });
    } else {
      return res.status(503).json({
        success: false,
        error: 'Telegram Bot API недоступний',
        details: webhookInfo.error || 'Неможливо отримати інформацію про webhook'
      });
    }
  } catch (error) {
    logger.error('[TelegramRoutes] Ошибка при получении статуса бота:', error);
    return res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Эндпоинт для настройки бота
telegramRouter.post('/setup', async (req, res) => {
  try {
    const appUrl = req.body.appUrl || process.env.MINI_APP_URL;
    
    if (!appUrl) {
      return res.status(400).json({ 
        success: false, 
        error: 'URL мини-приложения не указан' 
      });
    }
    
    // Налаштовуємо кнопку меню для бота
    const menuText = 'Открыть UniFarm';
    const menuResult = await setMenuButton(menuText, appUrl);
    
    if (!menuResult.success) {
      logger.warn(`[TelegramRoutes] Попередження при налаштуванні кнопки меню: ${menuResult.error}`);
    }
    
    // Налаштовуємо webhook
    // Визначаємо базовий URL для вебхука
    let baseUrl = process.env.APP_URL;
    
    // Якщо APP_URL не визначено, спробуємо використати автовизначення з поточного хоста
    if (!baseUrl) {
      // Отримуємо доменне ім'я з request headers (якщо запит прийшов через веб)
      const host = req.headers.host;
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      
      if (host) {
        baseUrl = `${protocol}://${host}`;
        logger.info(`[TelegramRoutes] Автовизначено базовий URL: ${baseUrl}`);
      } else {
        // Якщо не можемо визначити з запиту, використовуємо поточний налаштований URL вебхука
        const currentHook = await getWebhookInfo();
        if (currentHook.success && currentHook.info?.url) {
          const hookUrl = new URL(currentHook.info.url);
          baseUrl = `${hookUrl.protocol}//${hookUrl.host}`;
          logger.info(`[TelegramRoutes] Використовуємо базовий URL з поточного вебхука: ${baseUrl}`);
        } else {
          baseUrl = appUrl;
          logger.warn(`[TelegramRoutes] Не вдалося визначити базовий URL, використовуємо резервний: ${baseUrl}`);
        }
      }
    }
    
    // Формуємо остаточний URL для вебхука
    const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL || `${baseUrl}/api/telegram/webhook`;
    logger.info(`[TelegramRoutes] Налаштовуємо вебхук на URL: ${webhookUrl}`);
    const webhookResult = await setupWebhook(webhookUrl);
    
    if (!webhookResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Помилка при налаштуванні webhook',
        details: webhookResult.error
      });
    }
    
    // Ініціалізуємо бота
    const initialized = await initializeBot();
    
    return res.json({
      success: true,
      message: 'Налаштування бота успішно виконано',
      appUrl,
      webhook: {
        url: webhookUrl,
        configured: webhookResult.success
      },
      menuConfigured: menuResult.success,
      botInitialized: initialized
    });
  } catch (error) {
    logger.error('[TelegramRoutes] Ошибка при настройке бота:', error);
    return res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Endpoint для налаштування webhook
telegramRouter.get('/setup-webhook', async (req, res) => {
  try {
    const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL || `${process.env.APP_URL}/api/telegram/webhook`;
    
    // Якщо передали параметр force=true, примусово оновлюємо webhook
    const forceUpdate = req.query.force === 'true';
    
    // Отримуємо поточну інформацію про webhook
    const currentInfo = await getWebhookInfo();
    
    // Якщо webhook вже налаштований правильно і не вимагається примусове оновлення, не змінюємо його
    if (!forceUpdate && currentInfo.success && currentInfo.info?.url === webhookUrl) {
      return res.json({
        success: true,
        message: 'Webhook вже налаштований правильно',
        webhookInfo: currentInfo.info
      });
    }
    
    // Налаштовуємо webhook
    const result = await setupWebhook(webhookUrl);
    
    if (result.success) {
      return res.json({
        success: true,
        message: 'Webhook успішно налаштований',
        webhookInfo: result.info
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.error || 'Помилка при налаштуванні webhook'
      });
    }
  } catch (error) {
    logger.error('[Telegram Setup] Помилка:', error);
    return res.status(500).json({
      success: false,
      error: 'Внутрішня помилка сервера',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Endpoint для отримання інформації про поточний webhook
telegramRouter.get('/webhook-info', async (req, res) => {
  try {
    const info = await getWebhookInfo();
    
    return res.json({
      success: info.success,
      webhookInfo: info.info,
      error: info.error
    });
  } catch (error) {
    logger.error('[Telegram Info] Помилка:', error);
    return res.status(500).json({
      success: false,
      error: 'Внутрішня помилка сервера',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default telegramRouter;