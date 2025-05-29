import { Request, Response } from 'express';
import logger from '../utils/logger';
import fetch from 'node-fetch';
import { handleSmartBotUpdate } from './smartBot';

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
      first_name: string;
      username?: string;
    };
    date: number;
    text?: string;
    entities?: {
      type: string;
      offset: number;
      length: number;
    }[];
  };
  callback_query?: {
    id: string;
    from: {
      id: number;
      first_name: string;
      username?: string;
    };
    message?: {
      message_id: number;
      chat: {
        id: number;
        type: string;
        first_name: string;
        username?: string;
      };
      text?: string;
    };
    data: string;
  };
}

/**
 * Обработчик вебхука от Telegram
 */
export async function handleTelegramWebhook(req: Request, res: Response) {
  try {
    // Проверяем наличие токена бота
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      logger.error('[TelegramWebhook] TELEGRAM_BOT_TOKEN не найден');
      return res.status(500).json({ success: false, error: 'Bot token not configured' });
    }

    // Получаем обновление от Telegram
    const update = req.body as TelegramUpdate;
    
    if (!update) {
      logger.error('[TelegramWebhook] Получено пустое обновление');
      return res.status(400).json({ success: false, error: 'Empty update received' });
    }
    
    logger.debug('[TelegramWebhook] Получено обновление:', JSON.stringify(update));
    
    // Быстро отвечаем Telegram, чтобы он не повторял запрос
    res.status(200).json({ success: true });
    
    // Дальше обрабатываем обновление через умный бот
    handleSmartBotUpdate(update).catch(error => {
      logger.error('[TelegramWebhook] Ошибка при обработке обновления умным ботом:', error);
    });
  } catch (error) {
    logger.error('[TelegramWebhook] Ошибка в обработчике вебхука:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

/**
 * Обрабатывает обновление от Telegram (УДАЛЕНО - используем умный бот)
 */
async function processUpdate(update: TelegramUpdate): Promise<void> {
  // Эта функция больше не используется - все обрабатывается через handleSmartBotUpdate
  logger.info('[TelegramWebhook] processUpdate вызвана, но используется умный бот');
}

/**
 * Обрабатывает команду бота
 */
/**
 * Відправляє повідомлення в Telegram
 */
async function sendMessage(chatId: number, text: string, options: any = {}): Promise<boolean> {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!botToken) {
      logger.error('[TelegramWebhook] TELEGRAM_BOT_TOKEN не встановлено');
      return false;
    }
    
    const apiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        ...options
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`[TelegramWebhook] Помилка при відправці повідомлення: ${response.status} - ${errorText}`);
      return false;
    }
    
    return true;
  } catch (error) {
    logger.error('[TelegramWebhook] Помилка при відправці повідомлення:', error);
    return false;
  }
}

// УДАЛЕНО: старый обработчик команд - теперь используется умный бот

/**
 * Обрабатывает обычное текстовое сообщение
 */
async function handleTextMessage(text: string, chatId: number, userId: number): Promise<void> {
  try {
    // Здесь может быть логика обработки текстовых сообщений
    // Например, ответы на часто задаваемые вопросы или помощь пользователю
    
    await sendMessage(chatId, `Спасибо за ваше сообщение! Используйте команду /help, чтобы узнать о доступных функциях бота.`);
  } catch (error) {
    logger.error('[TelegramWebhook] Ошибка при обработке текстового сообщения:', error);
  }
}

/**
 * Обрабатывает нажатие на кнопку
 */
async function handleCallbackQuery(data: string, chatId: number, userId: number, queryId: string): Promise<void> {
  try {
    // Здесь может быть логика обработки нажатий на кнопки
    // Например, подтверждение действий или навигация по меню
    
    // Отправляем ответ пользователю
    await sendMessage(chatId, 'Действие выполнено');
    
    // Отвечаем на callback_query
    await answerCallbackQuery(queryId, 'Успешно');
  } catch (error) {
    logger.error('[TelegramWebhook] Ошибка при обработке callback_query:', error);
  }
}

/**
 * Відправляє відповідь на callback_query
 */
async function answerCallbackQuery(callbackQueryId: string, text: string = ''): Promise<boolean> {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!botToken) {
      logger.error('[TelegramWebhook] TELEGRAM_BOT_TOKEN не встановлено');
      return false;
    }
    
    const apiUrl = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`[TelegramWebhook] Помилка при відповіді на callback query: ${response.status} - ${errorText}`);
      return false;
    }
    
    return true;
  } catch (error) {
    logger.error('[TelegramWebhook] Помилка при відповіді на callback query:', error);
    return false;
  }
}

/**
 * Обрабатывает команду /start
 */
async function handleStartCommand(chatId: number, userId: number): Promise<void> {
  try {
    // Проверяем наличие имени приложения в переменных окружения
    const baseUrl = process.env.MINI_APP_URL || 'https://uni-farm-connect-x-lukyanenkolawfa.replit.app';
    // Добавляем версию для принудительного сброса кэша Telegram
    const appUrl = `${baseUrl}?v=${Date.now()}`;
    
    const welcomeText = `
Добро пожаловать в UniFarm!

UniFarm - это платформа для фарминга и заработка UNI токенов.

Для начала работы нажмите кнопку "Открыть UniFarm" ниже.`;
    
    await sendMessage(chatId, welcomeText, {
      parse_mode: 'Markdown',
      reply_markup: JSON.stringify({
        inline_keyboard: [
          [{ text: '🚀 Открыть UniFarm', web_app: { url: appUrl } }]
        ]
      })
    });
  } catch (error) {
    logger.error('[TelegramWebhook] Ошибка при обработке команды start:', error);
  }
}

/**
 * Обрабатывает команду /help
 */
async function handleHelpCommand(chatId: number): Promise<void> {
  try {
    const helpText = `
*Доступные команды:*

/start - Начать использовать UniFarm
/help - Показать эту справку
/deposit - Информация о внесении депозита
/withdraw - Информация о выводе средств
/referral - Реферальная программа

Для более удобного взаимодействия используйте мини-приложение, доступное по кнопке меню.`;
    
    await sendMessage(chatId, helpText, {
      parse_mode: 'Markdown'
    });
  } catch (error) {
    logger.error('[TelegramWebhook] Ошибка при обработке команды help:', error);
  }
}

/**
 * Обрабатывает команду /deposit
 */
async function handleDepositCommand(chatId: number): Promise<void> {
  try {
    const depositText = `
*Внесение депозита*

Для внесения депозита в UniFarm:

1. Нажмите на кнопку меню "Открыть UniFarm"
2. Перейдите в раздел "Депозит"
3. Выберите сумму и период депозита
4. Подтвердите операцию

Минимальная сумма депозита: 10 UNI`;
    
    await sendMessage(chatId, depositText, {
      parse_mode: 'Markdown'
    });
  } catch (error) {
    logger.error('[TelegramWebhook] Ошибка при обработке команды deposit:', error);
  }
}

/**
 * Обрабатывает команду /withdraw
 */
async function handleWithdrawCommand(chatId: number): Promise<void> {
  try {
    const withdrawText = `
*Вывод средств*

Для вывода средств из UniFarm:

1. Нажмите на кнопку меню "Открыть UniFarm"
2. Перейдите в раздел "Баланс"
3. Нажмите кнопку "Вывести"
4. Укажите сумму и адрес кошелька
5. Подтвердите операцию

Минимальная сумма вывода: 1 UNI`;
    
    await sendMessage(chatId, withdrawText, {
      parse_mode: 'Markdown'
    });
  } catch (error) {
    logger.error('[TelegramWebhook] Ошибка при обработке команды withdraw:', error);
  }
}

/**
 * Обрабатывает команду /referral
 */
async function handleReferralCommand(chatId: number): Promise<void> {
  try {
    const referralText = `
*Реферальная программа*

Пригласите друзей в UniFarm и получайте:

- 10% от депозитов рефералов первого уровня
- 5% от депозитов рефералов второго уровня
- 2.5% от депозитов рефералов третьего уровня

Для получения реферальной ссылки:
1. Нажмите на кнопку меню "Открыть UniFarm"
2. Перейдите в раздел "Рефералы"
3. Скопируйте вашу реферальную ссылку и поделитесь ею с друзьями`;
    
    await sendMessage(chatId, referralText, {
      parse_mode: 'Markdown'
    });
  } catch (error) {
    logger.error('[TelegramWebhook] Ошибка при обработке команды referral:', error);
  }
}