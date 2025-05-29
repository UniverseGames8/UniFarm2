/**
 * Модуль для ініціалізації та керування Telegram ботом
 * 
 * Цей модуль відповідає за налаштування та роботу з Telegram ботом,
 * включаючи webhook, обробку повідомлень та інтеграцію з Mini App.
 */

import { Express, Request, Response, RequestHandler } from 'express';
import { setupWebhook, getWebhookInfo, setMenuButton } from './setup-hook';
import { setTelegramBotInitialized } from './globalState';
import { createRouteSafely, createSafeHandler } from '../utils/express-helpers';
import logger from '../utils/logger';

// Максимальное количество попыток для операций с Telegram API
const MAX_TELEGRAM_RETRIES = 3;
// Базовая задержка между повторными попытками (в мс)
const BASE_RETRY_DELAY = 1000;

// Telegram Bot інстанс
export const telegramBot = {
  initialize: async (): Promise<boolean> => {
    return await initializeBot();
  },
  setupRoutes: (app: Express): void => {
    setupBotRoutes(app);
  },
  getStatus: async () => {
    try {
      return {
        hasToken: Boolean(process.env.TELEGRAM_BOT_TOKEN),
        miniAppUrl: process.env.MINI_APP_URL || process.env.APP_URL,
        webhookUrl: process.env.TELEGRAM_WEBHOOK_URL,
        menuText: BOT_MENU_TEXT
      };
    } catch (error) {
      console.error('[Telegram Bot] Помилка при отриманні статусу бота:', error);
      return { error: 'Помилка при отриманні статусу бота' };
    }
  }
};

// Налаштування для бота
const BOT_MENU_TEXT = 'Открыть UniFarm';

/**
 * Выполняет операцию с автоматическими повторными попытками при ошибке
 * @param operation Функция, выполняющая операцию
 * @param name Название операции для логирования
 * @param maxRetries Максимальное количество попыток
 * @param baseDelay Базовая задержка между попытками (мс)
 * @returns Результат операции или null при неудаче
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  name: string,
  maxRetries: number = MAX_TELEGRAM_RETRIES,
  baseDelay: number = BASE_RETRY_DELAY
): Promise<T | null> {
  let lastError: any = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Если это повторная попытка, логируем
      if (attempt > 1) {
        logger.info(`[Telegram Bot] Повторная попытка #${attempt} для операции: ${name}`);
      }
      
      // Выполняем операцию
      const result = await operation();
      
      // Если это была повторная попытка и она успешна, логируем успех
      if (attempt > 1) {
        logger.info(`[Telegram Bot] Операция ${name} успешно выполнена после ${attempt} попыток`);
      }
      
      return result;
    } catch (error) {
      lastError = error;
      logger.warn(`[Telegram Bot] Ошибка #${attempt} при выполнении операции ${name}: ${error instanceof Error ? error.message : String(error)}`);
      
      // Если это последняя попытка, не ждем
      if (attempt < maxRetries) {
        // Экспоненциальная задержка с небольшим случайным фактором
        const delay = baseDelay * Math.pow(1.5, attempt - 1) * (0.8 + Math.random() * 0.4);
        logger.debug(`[Telegram Bot] Ожидание ${Math.round(delay)}мс перед следующей попыткой...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  logger.error(`[Telegram Bot] Операция ${name} не удалась после ${maxRetries} попыток. Последняя ошибка: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
  return null;
}

/**
 * Ініціалізує бота та налаштовує необхідні компоненти
 */
export async function initializeBot(): Promise<boolean> {
  try {
    logger.info('[Telegram Bot] Початок ініціалізації бота');
    
    // Сбрасываем состояние инициализации в начале
    setTelegramBotInitialized(false);
    
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!botToken) {
      logger.error('[Telegram Bot] TELEGRAM_BOT_TOKEN не встановлено в змінних середовища');
      return false;
    }
    
    // Отримуємо URL для Mini App - ПРИНУДИТЕЛЬНО ИСПОЛЬЗУЕМ ПРОДАКШН URL
    const miniAppUrl = process.env.MINI_APP_URL || process.env.APP_URL || 'https://uni-farm-connect-x-lukyanenkolawfa.replit.app';
    
    if (!miniAppUrl) {
      logger.error('[Telegram Bot] MINI_APP_URL або APP_URL не встановлено в змінних середовища');
      return false;
    }
    
    // Налаштовуємо кнопку меню для бота с автоматическими повторными попытками
    const menuResult = await withRetry(
      async () => await setMenuButton(BOT_MENU_TEXT, miniAppUrl),
      'настройка кнопки меню'
    );
    
    if (!menuResult || !menuResult.success) {
      logger.warn(`[Telegram Bot] Предупреждение при настройке кнопки меню: ${menuResult?.error || 'Неизвестная ошибка'}`);
    } else {
      logger.info('[Telegram Bot] Кнопка меню успешно настроена');
    }
    
    // Отримуємо URL для webhook - ПРИНУДИТЕЛЬНО ИСПОЛЬЗУЕМ ПРОДАКШН URL
    const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL || `${miniAppUrl}/api/telegram/webhook`;
    
    if (!webhookUrl) {
      logger.warn('[Telegram Bot] TELEGRAM_WEBHOOK_URL не встановлено, webhook не буде налаштовано');
    } else {
      // Налаштовуємо webhook с автоматическими повторными попытками
      const webhookResult = await withRetry(
        async () => await setupWebhook(webhookUrl),
        'настройка webhook'
      );
      
      if (!webhookResult || !webhookResult.success) {
        logger.warn(`[Telegram Bot] Предупреждение при настройке webhook: ${webhookResult?.error || 'Неизвестная ошибка'}`);
      } else {
        logger.info('[Telegram Bot] Webhook успешно настроен');
      }
    }
    
    // Установка флага успешной инициализации
    setTelegramBotInitialized(true);
    logger.info('[Telegram Bot] Инициализация бота успешно завершена');
    return true;
  } catch (error) {
    logger.error('[Telegram Bot] Ошибка при инициализации бота:', error instanceof Error ? error.message : String(error));
    // Дополнительная информация для отладки
    if (error instanceof Error && error.stack) {
      logger.debug('[Telegram Bot] Стек ошибки:', error.stack);
    }
    // Гарантируем, что флаг не будет установлен в случае ошибки
    setTelegramBotInitialized(false);
    return false;
  }
}

/**
 * Налаштовує маршрути для обробки повідомлень від Telegram
 */
export function setupBotRoutes(app: Express): void {
  // Создаем типобезопасную обертку для маршрутов
  const route = createRouteSafely(app);
  
  // Маршрут для webhook с типобезопасным обработчиком
  route.post('/api/telegram/webhook', createSafeHandler(handleWebhook));
  
  // Маршрут для перевірки стану бота
  route.get('/api/telegram/status', createSafeHandler(handleBotStatus));
  
  // Маршрут для перевірки та оновлення webhook
  import('../check-webhook').then(module => {
    route.get('/api/telegram/check-webhook', createSafeHandler(module.checkWebhookHandler));
    console.log('[Telegram Bot] Додано маршрут для перевірки webhook');
  }).catch(error => {
    console.error('[Telegram Bot] Помилка імпорту модуля check-webhook:', error);
  });
  
  console.log('[Telegram Bot] Маршрути для бота налаштовано');
}

/**
 * Структура сообщения для логирования webhook-данных
 */
interface WebhookLogMessage {
  timestamp: string;
  updateId?: number;
  messageId?: number;
  chatId?: number;
  fromId?: number;
  messageType: string;
  command?: string;
  text?: string;
}

/**
 * Извлекает важную информацию из обновления Telegram для логирования
 * @param update Объект обновления от Telegram
 * @returns Структурированное сообщение для лога
 */
function extractWebhookLogInfo(update: any): WebhookLogMessage {
  const logMessage: WebhookLogMessage = {
    timestamp: new Date().toISOString(),
    messageType: 'unknown'
  };

  try {
    // Добавляем ID обновления
    if (update.update_id) {
      logMessage.updateId = update.update_id;
    }

    // Обработка обычных сообщений
    if (update.message) {
      logMessage.messageType = 'message';
      logMessage.messageId = update.message.message_id;
      logMessage.chatId = update.message.chat?.id;
      logMessage.fromId = update.message.from?.id;
      logMessage.text = update.message.text;

      // Проверяем на команду
      if (update.message.text && update.message.text.startsWith('/')) {
        logMessage.messageType = 'command';
        logMessage.command = update.message.text.split(' ')[0];
      }
    } 
    // Обработка callback запросов
    else if (update.callback_query) {
      logMessage.messageType = 'callback_query';
      logMessage.fromId = update.callback_query.from?.id;
      logMessage.messageId = update.callback_query.message?.message_id;
      logMessage.chatId = update.callback_query.message?.chat?.id;
      logMessage.text = update.callback_query.data;
    }
    // Обработка inline запросов
    else if (update.inline_query) {
      logMessage.messageType = 'inline_query';
      logMessage.fromId = update.inline_query.from?.id;
      logMessage.text = update.inline_query.query;
    }
  } catch (error) {
    logger.warn('[Telegram Bot] Ошибка при извлечении информации из обновления:', error);
  }

  return logMessage;
}

/**
 * Обробляє повідомлення від Telegram, які надходять через webhook
 */
async function handleWebhook(req: Request, res: Response): Promise<void> {
  let logInfo: WebhookLogMessage | null = null;
  
  try {
    const update = req.body;
    
    // Извлекаем информацию для логирования
    logInfo = extractWebhookLogInfo(update);
    
    // Логируем входящее обновление в структурированном виде
    logger.info(`[Telegram Bot] Получено обновление: тип=${logInfo.messageType}, chatId=${logInfo.chatId || 'н/д'}, fromId=${logInfo.fromId || 'н/д'}`);
    
    // Детальное логирование только в режиме отладки
    if (process.env.DEBUG_TELEGRAM === 'true') {
      logger.debug('[Telegram Bot] Данные обновления:', JSON.stringify(update));
    }
    
    // Быстро отвечаем на запрос, чтобы Telegram не повторял его
    res.status(200).send('OK');
    
    // Здесь будет асинхронная обработка сообщений от Telegram, независимо от ответа
    // Так как мы уже отправили ответ, ошибки в этой части не повлияют на ответ Telegram
    try {
      // Тут будет обработка повідомлень від Telegram
      // Пример: processMessage(update);
    } catch (processingError) {
      logger.error('[Telegram Bot] Ошибка при обработке сообщения:', 
        processingError instanceof Error ? processingError.message : String(processingError));
    }
    
  } catch (error) {
    logger.error('[Telegram Bot] Ошибка при обработке webhook:', 
      error instanceof Error ? error.message : String(error));
    
    // Если логирование не успело выполниться
    if (!logInfo) {
      logger.error('[Telegram Bot] Не удалось извлечь информацию о сообщении для логирования');
    }
    
    // Отвечаем ошибкой только если не отправили успешный ответ
    if (!res.headersSent) {
      res.status(500).send('Internal Server Error');
    }
  }
}

/**
 * Повертає інформацію про стан бота
 */
async function handleBotStatus(req: Request, res: Response): Promise<void> {
  try {
    // Отримуємо інформацію про webhook з использованием системы повторных попыток
    const webhookInfo = await withRetry(
      async () => await getWebhookInfo(),
      'получение информации о webhook'
    );
    
    // Информация о состоянии Telegram бота
    const botInfo = {
      hasToken: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      miniAppUrl: process.env.MINI_APP_URL || process.env.APP_URL,
      webhookUrl: process.env.TELEGRAM_WEBHOOK_URL,
      webhookInfo: webhookInfo && webhookInfo.success ? webhookInfo.info : null,
      webhookError: webhookInfo ? webhookInfo.error : 'Не удалось получить информацию',
      menuText: BOT_MENU_TEXT,
      version: '1.0.0', // Версию можно обновлять при изменениях в функциональности бота
      lastInitialized: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: botInfo
    });
  } catch (error) {
    logger.error('[Telegram Bot] Ошибка при получении статуса бота:', 
      error instanceof Error ? error.message : String(error));
    
    // Дополнительное логирование для отладки
    if (error instanceof Error && error.stack) {
      logger.debug('[Telegram Bot] Стек ошибки:', error.stack);
    }
    
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении статуса бота',
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

