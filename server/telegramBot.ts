/**
 * Базовый обработчик команд для Telegram-бота
 * Позволяет реализовать функции диагностики и отладки
 */

import fetch from 'node-fetch';
import { db } from './db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { storage } from './storage';

// Проверяем наличие токена
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('🚫 Отсутствует токен бота TELEGRAM_BOT_TOKEN в переменных окружения');
}

// Типы для Telegram Update
interface TelegramUser {
  id: number;
  first_name?: string;
  username?: string;
}

interface TelegramChat {
  id: number;
  type: string;
}

interface TelegramMessage {
  message_id: number;
  from: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
}

interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  chat_instance: string;
  data?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

/**
 * Отправляет сообщение пользователю
 * @param chatId - ID чата/пользователя
 * @param text - Текст сообщения
 * @param options - Дополнительные опции сообщения
 */
async function sendMessage(chatId: number, text: string, options: Record<string, any> = {}): Promise<any> {
  if (!BOT_TOKEN) {
    console.error('Невозможно отправить сообщение: отсутствует токен бота');
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        ...options
      })
    });

    const data: any = await response.json();
    if (!data.ok) {
      console.error('Ошибка при отправке сообщения:', data.description);
    }
    return data;
  } catch (error) {
    console.error('Ошибка при отправке сообщения в Telegram:', error);
  }
}

/**
 * Обрабатывает команду /ping
 * Отправляет ответное сообщение для проверки работоспособности бота
 */
async function handlePingCommand(chatId: number): Promise<any> {
  const startTime = Date.now();
  const responseTime = new Date().toISOString();
  
  // Получаем webhookInfo для проверки статуса соединения
  const webhookStatus = await getWebhookInfo();
  const webhookUrl = webhookStatus?.data?.url || 'Не настроен';
  const processingTime = Date.now() - startTime;
  
  const message = `
<b>🟢 Pong! Бот работает</b>

⏱ Время ответа: ${processingTime}ms
⏰ Дата/время: ${responseTime}
🔌 Webhook: ${webhookUrl}

<i>Если вы видите это сообщение, значит бот успешно получает и обрабатывает команды.</i>
  `;
  
  return sendMessage(chatId, message);
}

/**
 * Обрабатывает команду /info
 * Отправляет информацию о текущем пользователе
 */
async function handleInfoCommand(chatId: number, { userId, username, firstName }: { userId: number, username?: string, firstName?: string }): Promise<any> {
  const message = `
<b>📊 Информация о пользователе</b>

ID: <code>${userId}</code>
Имя: ${firstName || 'Не указано'}
Username: ${username ? `@${username}` : 'Не указан'}
Chat ID: <code>${chatId}</code>

Время запроса: ${new Date().toLocaleString()}
  `;
  return sendMessage(chatId, message);
}

/**
 * Обрабатывает команду /refcode
 * Получает и отображает реферальный код пользователя
 */
async function handleRefCodeCommand(chatId: number, userId: number): Promise<any> {
  // Здесь мы делаем запрос к нашей БД, чтобы получить ref_code
  try {
    // Пытаемся найти пользователя по Telegram ID
    const [user] = await db.select()
      .from(users)
      .where(eq(users.telegram_id, userId));

    if (user && user.ref_code) {
      return sendMessage(chatId, `
<b>🔗 Ваш реферальный код</b>

Код: <code>${user.ref_code}</code>
Ссылка: <code>https://t.me/UniFarming_Bot/UniFarm?ref_code=${user.ref_code}</code>

Telegram ID: <code>${userId}</code>
User ID в системе: <code>${user.id}</code>
      `);
    } else {
      return sendMessage(chatId, `
⚠️ <b>Реферальный код не найден</b>

Возможные причины:
- Вы не зарегистрированы в системе
- Telegram ID (${userId}) не привязан к аккаунту
- Произошла ошибка при генерации кода

Попробуйте открыть Mini App и завершить регистрацию.
      `);
    }
  } catch (error: any) {
    console.error('Ошибка при получении ref_code:', error);
    return sendMessage(chatId, `❌ Ошибка при получении реферального кода: ${error.message}`);
  }
}

/**
 * Обрабатывает команду /app
 * Отправляет ссылку для открытия Telegram Mini App
 */
async function handleAppCommand(chatId: number): Promise<any> {
  console.log(`[Telegram Bot] Отправка ссылки на приложение UniFarm в чат ${chatId}`);
  
  // URL для открытия Mini App
  const appUrl = "https://t.me/UniFarming_Bot/UniFarm";
  
  const messageText = `
🚀 <b>Приложение UniFarm</b>

Нажмите кнопку ниже, чтобы открыть приложение UniFarm и начать зарабатывать на криптофарминге прямо сейчас!

<i>Вы также можете открыть приложение, нажав на кнопку в меню бота.</i>
  `;
  
  return sendMessage(chatId, messageText, {
    parse_mode: 'HTML',
    reply_markup: JSON.stringify({
      inline_keyboard: [
        [{ 
          text: "📱 Открыть UniFarm", 
          web_app: { url: appUrl } 
        }]
      ]
    }),
    disable_web_page_preview: true
  });
}

/**
 * Обрабатывает команду /start
 * Приветствует пользователя и отображает клавиатуру с командами
 */
async function handleStartCommand(chatId: number, { userId, username, firstName }: { userId: number, username?: string, firstName?: string }): Promise<any> {
  // Проверяем, есть ли параметр ref_code в команде (для обработки реферальных ссылок)
  const welcomeMessage = `
👋 <b>Добро пожаловать${firstName ? ', ' + firstName : ''}!</b>

Я бот <b>UniFarm</b> - твой проводник в мире криптофарминга и инвестиций.

🌟 <b>С нами вы можете:</b>
• Инвестировать в фарминг без технических знаний
• Получать стабильный доход в криптовалюте
• Участвовать в партнёрской программе с 20 уровнями
• Получать бонусы и выполнять миссии

📱 Нажмите кнопку "<b>Открыть UniFarm</b>" ниже, чтобы начать.
  `;

  // Создаем инлайн-кнопки для приветствия
  const inlineKeyboard = {
    inline_keyboard: [
      [
        { 
          text: "📱 Открыть UniFarm", 
          web_app: { url: "https://t.me/UniFarming_Bot/UniFarm" }
        }
      ],
      [
        { 
          text: "🔍 Что такое UniFarm?", 
          callback_data: "about_unifarm" 
        },
        { 
          text: "💰 Как заработать", 
          callback_data: "how_to_earn" 
        }
      ],
      [
        { 
          text: "🔗 Моя реферальная ссылка", 
          callback_data: "get_ref_link" 
        }
      ]
    ]
  };

  // Создаем обычную клавиатуру с командами (будет показана после первого сообщения)
  const replyMarkup = {
    keyboard: [
      [
        { text: "📱 Открыть UniFarm", web_app: { url: "https://t.me/UniFarming_Bot/UniFarm" } }
      ],
      [
        { text: "🔄 Проверить связь" },
        { text: "ℹ️ Моя информация" }
      ],
      [
        { text: "🔗 Мой реф. код" },
        { text: "❓ Помощь" }
      ]
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  };

  // Отправляем первое сообщение с инлайн-кнопками
  await sendMessage(chatId, welcomeMessage, { 
    parse_mode: 'HTML',
    reply_markup: JSON.stringify(inlineKeyboard),
    disable_web_page_preview: true
  });

  // Отправляем второе сообщение с подсказкой и обычной клавиатурой
  return sendMessage(chatId, `
<b>💡 Подсказка:</b> Используйте меню внизу экрана для быстрого доступа к основным функциям.

<i>Бот находится в режиме активной разработки. Новые функции появляются регулярно!</i>
  `, {
    parse_mode: 'HTML',
    reply_markup: JSON.stringify(replyMarkup)
  });
}

/**
 * Отправляет ответ на callback_query
 * @param callbackQueryId - ID callback query для ответа
 * @param text - Текст уведомления (опционально)
 * @param showAlert - Показывать как alert или как всплывающее уведомление
 */
async function answerCallbackQuery(callbackQueryId: string, text?: string, showAlert: boolean = false): Promise<any> {
  if (!BOT_TOKEN) {
    console.error('Невозможно ответить на callback_query: отсутствует токен бота');
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
        show_alert: showAlert
      })
    });

    const data: any = await response.json();
    if (!data.ok) {
      console.error('Ошибка при ответе на callback_query:', data.description);
    }
    return data;
  } catch (error) {
    console.error('Ошибка при ответе на callback_query:', error);
  }
}

/**
 * Редактирует сообщение
 * @param chatId - ID чата/пользователя
 * @param messageId - ID сообщения для редактирования
 * @param text - Новый текст сообщения
 * @param options - Дополнительные опции
 */
async function editMessageText(chatId: number, messageId: number, text: string, options: Record<string, any> = {}): Promise<any> {
  if (!BOT_TOKEN) {
    console.error('Невозможно отредактировать сообщение: отсутствует токен бота');
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'HTML',
        ...options
      })
    });

    const data: any = await response.json();
    if (!data.ok) {
      console.error('Ошибка при редактировании сообщения:', data.description);
    }
    return data;
  } catch (error) {
    console.error('Ошибка при редактировании сообщения:', error);
  }
}

/**
 * Обрабатывает callback_query от инлайн-кнопок
 * @param callbackQuery - Объект callback_query от Telegram
 */
async function handleCallbackQuery(callbackQuery: TelegramCallbackQuery): Promise<any> {
  // Проверка валидности данных
  if (!callbackQuery.data || !callbackQuery.message) {
    console.error('[Telegram Bot] Получен неполный callback_query без data или message');
    return;
  }

  const data = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const userId = callbackQuery.from.id;
  const username = callbackQuery.from.username;
  
  console.log(`[Telegram Bot] Получен callback_query: ${data} от пользователя ${username || userId}`);
  
  // Обрабатываем разные типы callback_data
  switch (data) {
    case 'about_unifarm':
      // Показываем информацию о проекте UniFarm
      await answerCallbackQuery(callbackQuery.id, 'Загрузка информации о UniFarm...');
      
      await editMessageText(chatId, messageId, `
<b>🌟 О проекте UniFarm</b>

UniFarm - это инновационная платформа для криптофарминга, которая позволяет получать пассивный доход в криптовалюте без специальных технических знаний.

<b>Основные преимущества:</b>
• Простой и понятный интерфейс
• Низкий порог входа
• Прозрачная система начисления вознаграждений
• Партнёрская программа с 20 уровнями
• Быстрое получение вознаграждений
• Поддержка TON и других популярных криптовалют

<i>Начните прямо сейчас, нажав на кнопку "Открыть UniFarm"</i>
      `, {
        reply_markup: JSON.stringify({
          inline_keyboard: [
            [{ text: "📱 Открыть UniFarm", web_app: { url: "https://t.me/UniFarming_Bot/UniFarm" } }],
            [{ text: "⬅️ Назад", callback_data: "back_to_menu" }]
          ]
        })
      });
      break;
      
    case 'how_to_earn':
      // Показываем способы заработка
      await answerCallbackQuery(callbackQuery.id, 'Загрузка информации о заработке...');
      
      await editMessageText(chatId, messageId, `
<b>💰 Как заработать с UniFarm</b>

У нас есть несколько способов получения дохода:

1️⃣ <b>Фарминг UNI</b>
• Вложите средства в фарминг-депозит
• Получайте ежедневные начисления
• Увеличивайте доход с помощью бустов

2️⃣ <b>Партнёрская программа</b>
• Пригласите друзей по своей реферальной ссылке
• Получайте до 100% от их дохода (на 1 уровне)
• 20 уровней вознаграждений (до 2-20% на уровнях 2-20)

3️⃣ <b>Ежедневные бонусы</b>
• Заходите в приложение каждый день
• Получайте бесплатные UNI-токены
• Участвуйте в миссиях для дополнительных бонусов

<i>Откройте приложение, чтобы начать зарабатывать прямо сейчас!</i>
      `, {
        reply_markup: JSON.stringify({
          inline_keyboard: [
            [{ text: "📱 Открыть UniFarm", web_app: { url: "https://t.me/UniFarming_Bot/UniFarm" } }],
            [{ text: "⬅️ Назад", callback_data: "back_to_menu" }]
          ]
        })
      });
      break;
      
    case 'get_ref_link':
      // Получение реферальной ссылки (используем существующий метод)
      await answerCallbackQuery(callbackQuery.id, 'Получение вашей реферальной ссылки...');
      
      try {
        // Пытаемся найти пользователя по Telegram ID
        const [user] = await db.select()
          .from(users)
          .where(eq(users.telegram_id, userId));
    
        if (user && user.ref_code) {
          await editMessageText(chatId, messageId, `
<b>🔗 Ваша реферальная ссылка</b>

Пригласите друзей и получайте вознаграждение от их фарминга.

Код: <code>${user.ref_code}</code>
Ссылка для приглашения друзей:
<code>https://t.me/UniFarming_Bot/UniFarm?ref_code=${user.ref_code}</code>

<i>Отправьте эту ссылку друзьям, чтобы они присоединились к UniFarm по вашему приглашению.</i>
          `, {
            reply_markup: JSON.stringify({
              inline_keyboard: [
                [{ text: "📱 Открыть UniFarm", web_app: { url: "https://t.me/UniFarming_Bot/UniFarm" } }],
                [{ text: "⬅️ Назад", callback_data: "back_to_menu" }]
              ]
            })
          });
        } else {
          await editMessageText(chatId, messageId, `
⚠️ <b>Реферальный код не найден</b>

Возможные причины:
• Вы не зарегистрированы в системе
• Ваш Telegram ID (${userId}) не привязан к аккаунту
• Произошла ошибка при генерации кода

Откройте приложение и завершите регистрацию, чтобы получить реферальный код.
          `, {
            reply_markup: JSON.stringify({
              inline_keyboard: [
                [{ text: "📱 Открыть UniFarm", web_app: { url: "https://t.me/UniFarming_Bot/UniFarm" } }],
                [{ text: "⬅️ Назад", callback_data: "back_to_menu" }]
              ]
            })
          });
        }
      } catch (error: any) {
        console.error('Ошибка при получении ref_code:', error);
        await editMessageText(chatId, messageId, `
❌ <b>Ошибка при получении реферального кода</b>

Произошла техническая ошибка. Попробуйте позже или обратитесь в поддержку.
        `, {
          reply_markup: JSON.stringify({
            inline_keyboard: [
              [{ text: "⬅️ Назад", callback_data: "back_to_menu" }]
            ]
          })
        });
      }
      break;
      
    case 'back_to_menu':
      // Возврат к основному меню
      await answerCallbackQuery(callbackQuery.id, 'Возврат в главное меню...');
      
      await editMessageText(chatId, messageId, `
👋 <b>Добро пожаловать!</b>

Я бот <b>UniFarm</b> - твой проводник в мире криптофарминга и инвестиций.

🌟 <b>С нами вы можете:</b>
• Инвестировать в фарминг без технических знаний
• Получать стабильный доход в криптовалюте
• Участвовать в партнёрской программе с 20 уровнями
• Получать бонусы и выполнять миссии

📱 Нажмите кнопку "<b>Открыть UniFarm</b>" ниже, чтобы начать.
      `, {
        reply_markup: JSON.stringify({
          inline_keyboard: [
            [{ text: "📱 Открыть UniFarm", web_app: { url: "https://t.me/UniFarming_Bot/UniFarm" } }],
            [
              { text: "🔍 Что такое UniFarm?", callback_data: "about_unifarm" },
              { text: "💰 Как заработать", callback_data: "how_to_earn" }
            ],
            [{ text: "🔗 Моя реферальная ссылка", callback_data: "get_ref_link" }]
          ]
        })
      });
      break;
      
    default:
      // Неизвестная команда
      await answerCallbackQuery(callbackQuery.id, 'Команда не распознана', true);
      console.log(`[Telegram Bot] Неизвестный callback_data: ${data}`);
      break;
  }
}

/**
 * Обрабатывает HTTP-запрос от webhook Telegram
 * @param update - Объект обновления от Telegram
 */
async function handleTelegramUpdate(update: TelegramUpdate): Promise<any> {
  // Проверка на валидные данные
  if (!update) {
    console.error('[Telegram Bot] Получено пустое или невалидное обновление');
    return;
  }

  // Обработка различных типов обновлений
  if (update.message) {
    // Обработка обычных сообщений
    return handleMessageUpdate(update);
  } else if (update.callback_query) {
    // Обработка callback_query от инлайн-кнопок
    return handleCallbackQuery(update.callback_query);
  } else {
    // Логирование неподдерживаемых типов обновлений
    console.log('[Telegram Bot] Получен неподдерживаемый тип обновления:', 
      Object.keys(update).filter(key => key !== 'update_id').join(', '));
    return;
  }
}

/**
 * Обрабатывает обновление с сообщением
 * @param update - Объект обновления от Telegram, содержащий сообщение
 */
async function handleMessageUpdate(update: TelegramUpdate): Promise<any> {
  const { message } = update;
  
  if (!message) {
    console.error('[Telegram Bot] Сообщение отсутствует в обновлении');
    return;
  }
  
  const chatId = message.chat.id;
  const userId = message.from.id;
  const username = message.from.username;
  const firstName = message.from.first_name;
  
  // Формируем информацию о пользователе для логов
  const userInfo = username ? `@${username} (ID: ${userId})` : `User ID: ${userId}`;
  
  // Проверяем наличие текста сообщения
  if (!message.text) {
    console.log(`[Telegram Bot] Получено сообщение без текста от ${userInfo}`);
    return sendMessage(chatId, 'Я могу обрабатывать только текстовые сообщения. Используйте /start, чтобы увидеть доступные команды.');
  }
  
  const messageText = message.text.trim();
  
  // Красивый лог в консоль
  console.log(`\n[Telegram Bot] [${new Date().toISOString()}] Сообщение от ${userInfo}:`);
  console.log(`   Текст: "${messageText}"`);
  console.log(`   Чат: ${message.chat.type} (ID: ${chatId})`);
  
  // Обрабатываем команды
  if (messageText === '/start') {
    console.log(`[Telegram Bot] Обработка команды /start`);
    return handleStartCommand(chatId, { userId, username, firstName });
  } else if (messageText === '/ping' || messageText === '🔄 Проверить связь (/ping)') {
    console.log(`[Telegram Bot] Обработка команды /ping`);
    return handlePingCommand(chatId);
  } else if (messageText === '/info' || messageText === 'ℹ️ Моя информация (/info)') {
    console.log(`[Telegram Bot] Обработка команды /info`);
    return handleInfoCommand(chatId, { userId, username, firstName });
  } else if (messageText === '/refcode' || messageText === '🔗 Мой реф. код (/refcode)') {
    console.log(`[Telegram Bot] Обработка команды /refcode`);
    return handleRefCodeCommand(chatId, userId);
  } else if (messageText === '/app' || messageText === '📱 Открыть приложение (/app)') {
    console.log(`[Telegram Bot] Обработка команды /app`);
    return handleAppCommand(chatId);
  } else {
    // Для сообщений, которые не являются известными командами
    console.log(`[Telegram Bot] Получена неизвестная команда: ${messageText}`);
    
    // Проверяем, может это частичное совпадение с известными командами
    if (messageText.startsWith('/start')) {
      return handleStartCommand(chatId, { userId, username, firstName });
    } else if (messageText.includes('ping') || messageText.includes('пинг')) {
      return handlePingCommand(chatId);
    } else if (messageText.includes('info') || messageText.includes('инфо')) {
      return handleInfoCommand(chatId, { userId, username, firstName });
    } else if (messageText.includes('ref') || messageText.includes('код') || messageText.includes('реф')) {
      return handleRefCodeCommand(chatId, userId);
    } else if (messageText.includes('app') || messageText.includes('прил') || messageText.includes('открыть')) {
      return handleAppCommand(chatId);
    }
    
    // Если ничего не подошло, отправляем подсказку
    return sendMessage(chatId, `Я не понимаю эту команду. Попробуйте /start для отображения доступных действий.`);
  }
}

/**
 * Настраивает webhook для Telegram бота
 * @param webhookUrl - URL для вебхука (например, https://your-domain.com/api/telegram/webhook)
 * @returns Результат настройки вебхука
 */
async function setWebhook(webhookUrl: string): Promise<any> {
  if (!BOT_TOKEN) {
    console.error('Невозможно настроить вебхук: отсутствует токен бота');
    return { success: false, error: 'Отсутствует токен бота' };
  }

  console.log(`[Telegram Bot] Настройка вебхука на URL: ${webhookUrl}`);

  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        drop_pending_updates: true, // Опционально: игнорировать накопившиеся обновления
        allowed_updates: ["message"] // Опционально: фильтр типов обновлений
      })
    });

    const data: any = await response.json();
    
    if (data.ok) {
      console.log('[Telegram Bot] Вебхук успешно настроен');
      return { success: true, data };
    } else {
      console.error('[Telegram Bot] Ошибка настройки вебхука:', data.description);
      return { success: false, error: data.description };
    }
  } catch (error: any) {
    console.error('[Telegram Bot] Ошибка при настройке вебхука:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Удаляет настройки webhook для бота
 * @returns Результат удаления вебхука
 */
async function deleteWebhook(): Promise<any> {
  if (!BOT_TOKEN) {
    console.error('Невозможно удалить вебхук: отсутствует токен бота');
    return { success: false, error: 'Отсутствует токен бота' };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        drop_pending_updates: true // Опционально: игнорировать накопившиеся обновления
      })
    });

    const data: any = await response.json();
    
    if (data.ok) {
      console.log('[Telegram Bot] Вебхук успешно удален');
      return { success: true, data };
    } else {
      console.error('[Telegram Bot] Ошибка удаления вебхука:', data.description);
      return { success: false, error: data.description };
    }
  } catch (error: any) {
    console.error('[Telegram Bot] Ошибка при удалении вебхука:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Получает информацию о текущем webhook
 * @returns Информация о вебхуке
 */
async function getWebhookInfo(): Promise<any> {
  if (!BOT_TOKEN) {
    console.error('Невозможно получить информацию о вебхуке: отсутствует токен бота');
    return { success: false, error: 'Отсутствует токен бота' };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`, {
      method: 'GET'
    });

    const data: any = await response.json();
    
    if (data.ok) {
      console.log('[Telegram Bot] Получена информация о вебхуке:', data.result);
      return { success: true, data: data.result };
    } else {
      console.error('[Telegram Bot] Ошибка получения информации о вебхуке:', data.description);
      return { success: false, error: data.description };
    }
  } catch (error: any) {
    console.error('[Telegram Bot] Ошибка при получении информации о вебхуке:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Отправляет уведомление о состоянии приложения в указанный чат
 * @param chatId - ID чата для отправки уведомления
 * @param status - Статус приложения ("started", "deployed", "updated", "error")
 * @param details - Дополнительная информация о статусе
 */
async function sendAppStatusNotification(
  chatId: number, 
  status: "started" | "deployed" | "updated" | "error",
  details?: string
): Promise<any> {
  let emoji: string;
  let title: string;
  
  switch (status) {
    case "started":
      emoji = "🚀";
      title = "Приложение запущено";
      break;
    case "deployed":
      emoji = "✅";
      title = "Приложение успешно развёрнуто";
      break;
    case "updated":
      emoji = "🔄";
      title = "Приложение обновлено";
      break;
    case "error":
      emoji = "❌";
      title = "Ошибка в приложении";
      break;
  }
  
  const message = `
${emoji} <b>${title}</b>

⏱ Дата/время: ${new Date().toISOString()}
🌐 URL: ${process.env.APP_URL || "Не указан"}

${details ? `<i>${details}</i>` : ""}
`;

  return sendMessage(chatId, message);
}

/**
 * Устанавливает команды для бота
 * @returns Результат установки команд
 */
async function setMyCommands(): Promise<any> {
  if (!BOT_TOKEN) {
    console.error('Невозможно установить команды: отсутствует токен бота');
    return { success: false, error: 'Отсутствует токен бота' };
  }
  
  try {
    // Определяем список команд для меню бота
    const commands = [
      { command: 'start', description: 'Запуск бота и приветствие' },
      { command: 'ping', description: 'Проверить работу бота' },
      { command: 'info', description: 'Показать мою информацию' },
      { command: 'refcode', description: 'Получить мой реферальный код' },
      { command: 'app', description: 'Открыть приложение UniFarm' }
    ];
    
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands })
    });
    
    const data: any = await response.json();
    
    if (data.ok) {
      console.log('[Telegram Bot] Команды успешно установлены');
      return { success: true, data };
    } else {
      console.error('[Telegram Bot] Ошибка установки команд:', data.description);
      return { success: false, error: data.description };
    }
  } catch (error: any) {
    console.error('[Telegram Bot] Ошибка при установке команд:', error);
    return { success: false, error: error.message };
  }
}

// Экспортируем функции для использования в routes.ts
export {
  sendMessage,
  handleTelegramUpdate,
  handleMessageUpdate,
  setWebhook,
  deleteWebhook,
  getWebhookInfo,
  sendAppStatusNotification,
  setMyCommands
};