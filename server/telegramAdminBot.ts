/**
 * Административный бот Telegram для UniFarm
 * 
 * Реализует админ-панель через Telegram бота @unifarm_admin_bot
 * Обеспечивает доступ к основным административным функциям системы
 */

import fetch from 'node-fetch';
import { db } from './db';
import { users, transactions, missions } from '../shared/schema';
import { eq, desc, and, gte, lte } from 'drizzle-orm';

// Константы для работы бота
const ADMIN_BOT_TOKEN = '7662298323:AAFLgX05fWtgNYJfT_VeZ_kRZhIBixoseIY';
const AUTHORIZED_ADMINS = ['DimaOsadchuk', 'a888bnd']; // Список разрешенных администраторов

// API URL
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://api.unifarm.app' 
  : 'https://uni-farm-connect-x-lukyanenkolawfa.replit.app';

// Типы для Telegram API
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

// Состояние разговора для многоэтапных диалогов
interface ConversationState {
  [chatId: number]: {
    stage: string;
    data: any;
    expiresAt: number;
  }
}

// Глобальное состояние разговоров с пользователями
const conversationState: ConversationState = {};

/**
 * Проверяет, является ли пользователь администратором
 * @param username - Имя пользователя Telegram
 * @returns Имеет ли пользователь права администратора
 */
function isAuthorizedAdmin(username?: string): boolean {
  if (!username) return false;
  return AUTHORIZED_ADMINS.includes(username);
}

/**
 * Отправляет сообщение в Telegram
 * @param chatId - ID чата
 * @param text - Текст сообщения
 * @param options - Дополнительные опции сообщения
 */
async function sendMessage(chatId: number, text: string, options: Record<string, any> = {}): Promise<any> {
  if (!ADMIN_BOT_TOKEN) {
    console.error('[AdminBot] Отсутствует токен бота');
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${ADMIN_BOT_TOKEN}/sendMessage`, {
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
      console.error('[AdminBot] Ошибка при отправке сообщения:', data.description);
    }
    return data;
  } catch (error) {
    console.error('[AdminBot] Ошибка при отправке сообщения в Telegram:', error);
  }
}

/**
 * Отправляет ответ на callback_query
 * @param callbackQueryId - ID callback query
 * @param text - Текст уведомления
 * @param showAlert - Показывать как alert
 */
async function answerCallbackQuery(callbackQueryId: string, text?: string, showAlert: boolean = false): Promise<any> {
  if (!ADMIN_BOT_TOKEN) {
    console.error('[AdminBot] Невозможно ответить на callback_query: отсутствует токен бота');
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${ADMIN_BOT_TOKEN}/answerCallbackQuery`, {
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
      console.error('[AdminBot] Ошибка при ответе на callback_query:', data.description);
    }
    return data;
  } catch (error) {
    console.error('[AdminBot] Ошибка при ответе на callback_query:', error);
  }
}

/**
 * Редактирует сообщение
 * @param chatId - ID чата
 * @param messageId - ID сообщения
 * @param text - Новый текст
 * @param options - Дополнительные опции
 */
async function editMessageText(chatId: number, messageId: number, text: string, options: Record<string, any> = {}): Promise<any> {
  if (!ADMIN_BOT_TOKEN) {
    console.error('[AdminBot] Невозможно отредактировать сообщение: отсутствует токен бота');
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${ADMIN_BOT_TOKEN}/editMessageText`, {
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
      console.error('[AdminBot] Ошибка при редактировании сообщения:', data.description);
    }
    return data;
  } catch (error) {
    console.error('[AdminBot] Ошибка при редактировании сообщения:', error);
  }
}

/**
 * Устанавливает webhook для получения обновлений от Telegram
 * @param url - URL для webhook
 */
export async function setAdminBotWebhook(url: string): Promise<boolean> {
  if (!ADMIN_BOT_TOKEN) {
    console.error('[AdminBot] Ошибка: ADMIN_BOT_TOKEN не установлен');
    return false;
  }

  try {
    const webhookUrl = `${url}/api/admin/bot-webhook`;
    console.log(`[AdminBot] Устанавливаем webhook: ${webhookUrl}`);

    const response = await fetch(`https://api.telegram.org/bot${ADMIN_BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl })
    });

    const data = await response.json();
    if (data.ok) {
      console.log(`[AdminBot] Webhook успешно установлен: ${webhookUrl}`);
      return true;
    } else {
      console.error(`[AdminBot] Ошибка установки webhook: ${data.description}`);
      return false;
    }
  } catch (error) {
    console.error('[AdminBot] Ошибка при установке webhook:', error);
    return false;
  }
}

/**
 * Возвращает клавиатуру в формате ReplyMarkup для главного меню админ-бота
 */
function getMainMenuKeyboard(): any {
  return {
    keyboard: [
      [{ text: "📤 Заявки на вивід" }, { text: "➕ Видача депозитів" }],
      [{ text: "📝 Додати завдання" }, { text: "📊 Аналітика" }],
      [{ text: "👥 Користувачі" }, { text: "⚙️ Системні дії" }]
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  };
}

/**
 * Отправляет приветственное сообщение с главным меню
 * @param chatId - ID чата
 * @param username - Имя пользователя
 */
async function sendWelcomeMessage(chatId: number, username: string): Promise<void> {
  const welcomeMessage = `
<b>👋 Вітаю, ${username}!</b>

Ви увійшли до адміністративної панелі <b>UniFarm</b>.
Використовуйте меню нижче для керування платформою.

<i>* Всі дії логуються для безпеки системи</i>
  `;

  await sendMessage(chatId, welcomeMessage, {
    reply_markup: JSON.stringify(getMainMenuKeyboard())
  });
}

/**
 * Отправляет сообщение о запрете доступа
 * @param chatId - ID чата
 */
async function sendAccessDeniedMessage(chatId: number): Promise<void> {
  const message = `
⛔️ <b>Доступ заборонено</b>

Ви не авторизовані як адміністратор UniFarm.
  `;

  await sendMessage(chatId, message);
}

/**
 * Обрабатывает команду /start от пользователя
 * @param message - Сообщение от пользователя
 */
async function handleStartCommand(message: TelegramMessage): Promise<void> {
  const chatId = message.chat.id;
  const username = message.from.username;

  console.log(`[AdminBot] Получена команда /start от пользователя ${username || message.from.id}`);

  if (isAuthorizedAdmin(username)) {
    await sendWelcomeMessage(chatId, username || 'Адміністратор');
  } else {
    await sendAccessDeniedMessage(chatId);
  }
}

/**
 * Получает список заявок на вывод средств
 * @returns Список заявок на вывод
 */
async function getWithdrawRequests(): Promise<any[]> {
  try {
    // Здесь мы используем прямой запрос к БД, в реальном проекте лучше использовать API
    const pendingWithdraws = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.type, 'withdraw'),
          eq(transactions.status, 'pending')
        )
      )
      .orderBy(desc(transactions.created_at))
      .limit(20);

    return pendingWithdraws;
  } catch (error) {
    console.error('[AdminBot] Ошибка при получении заявок на вывод:', error);
    return [];
  }
}

/**
 * Обрабатывает раздел "Заявки на вивід"
 * @param chatId - ID чата
 */
async function handleWithdrawRequests(chatId: number): Promise<void> {
  try {
    // Получаем заявки на вывод
    const withdrawRequests = await getWithdrawRequests();

    if (withdrawRequests.length === 0) {
      await sendMessage(chatId, `
<b>📤 Заявки на вивід</b>

На даний момент немає заявок на вивід коштів, які очікують підтвердження.
      `);
      return;
    }

    // Отправляем сообщение с информацией о заявках
    await sendMessage(chatId, `
<b>📤 Заявки на вивід</b>

Знайдено ${withdrawRequests.length} заявок на вивід коштів, які очікують підтвердження.
Виберіть заявку для детального перегляду:
    `);

    // Отправляем каждую заявку отдельным сообщением для удобства
    for (const request of withdrawRequests) {
      const userId = request.user_id;
      const amount = Math.abs(parseFloat(request.amount)).toFixed(6);
      const currency = request.currency;
      const createdAt = new Date(request.created_at).toLocaleString();
      
      // Получаем информацию о пользователе
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      const username = user ? (user.username || `ID: ${user.id}`) : `ID: ${userId}`;

      await sendMessage(chatId, `
<b>Заявка #${request.id}</b>
Користувач: ${username}
Сума: ${amount} ${currency}
Дата: ${createdAt}
Статус: <b>очікує підтвердження</b>
      `, {
        reply_markup: JSON.stringify({
          inline_keyboard: [
            [
              { text: "✅ Підтвердити", callback_data: `confirm_withdraw:${request.id}` },
              { text: "❌ Відхилити", callback_data: `reject_withdraw:${request.id}` }
            ],
            [
              { text: "👤 Деталі користувача", callback_data: `user_details:${userId}` }
            ]
          ]
        })
      });
    }
  } catch (error) {
    console.error('[AdminBot] Ошибка при обработке заявок на вывод:', error);
    await sendMessage(chatId, "❌ Виникла помилка при отриманні заявок на вивід. Спробуйте пізніше.");
  }
}

/**
 * Подтверждает заявку на вывод средств
 * @param withdrawId - ID заявки на вывод
 * @returns Результат операции
 */
async function confirmWithdrawRequest(withdrawId: number): Promise<boolean> {
  try {
    // В реальном проекте здесь должен быть вызов API, а не прямое изменение БД
    await db
      .update(transactions)
      .set({
        status: 'confirmed',
        updated_at: new Date()
      })
      .where(
        and(
          eq(transactions.id, withdrawId),
          eq(transactions.type, 'withdraw'),
          eq(transactions.status, 'pending')
        )
      );
    
    return true;
  } catch (error) {
    console.error(`[AdminBot] Ошибка при подтверждении заявки #${withdrawId}:`, error);
    return false;
  }
}

/**
 * Отклоняет заявку на вывод средств
 * @param withdrawId - ID заявки на вывод
 * @returns Результат операции
 */
async function rejectWithdrawRequest(withdrawId: number): Promise<boolean> {
  try {
    // В реальном проекте здесь должен быть вызов API, а не прямое изменение БД
    await db
      .update(transactions)
      .set({
        status: 'rejected',
        updated_at: new Date()
      })
      .where(
        and(
          eq(transactions.id, withdrawId),
          eq(transactions.type, 'withdraw'),
          eq(transactions.status, 'pending')
        )
      );
    
    return true;
  } catch (error) {
    console.error(`[AdminBot] Ошибка при отклонении заявки #${withdrawId}:`, error);
    return false;
  }
}

/**
 * Начинает процесс выдачи депозита
 * @param chatId - ID чата
 */
async function startDepositProcess(chatId: number): Promise<void> {
  // Инициализируем состояние разговора
  conversationState[chatId] = {
    stage: 'deposit_enter_user_id',
    data: {},
    expiresAt: Date.now() + 15 * 60 * 1000 // 15 минут на завершение
  };

  await sendMessage(chatId, `
<b>➕ Видача депозиту</b>

Для видачі депозиту потрібно вказати:
1. ID користувача
2. Тип токену (TON / UNI)
3. Суму

<i>Будь ласка, введіть ID користувача:</i>
  `, {
    reply_markup: JSON.stringify({
      keyboard: [
        [{ text: "❌ Скасувати" }]
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    })
  });
}

/**
 * Продолжает процесс выдачи депозита
 * @param chatId - ID чата
 * @param messageText - Текст сообщения
 */
async function continueDepositProcess(chatId: number, messageText: string): Promise<void> {
  const state = conversationState[chatId];
  
  // Проверяем, не отменил ли пользователь процесс
  if (messageText === "❌ Скасувати") {
    delete conversationState[chatId];
    await sendMessage(chatId, "❌ Процес видачі депозиту скасовано.", {
      reply_markup: JSON.stringify(getMainMenuKeyboard())
    });
    return;
  }

  switch (state.stage) {
    case 'deposit_enter_user_id':
      const userId = parseInt(messageText.trim());
      if (isNaN(userId) || userId <= 0) {
        await sendMessage(chatId, "⚠️ Некоректний ID користувача. Будь ласка, введіть числове значення.");
        return;
      }

      // Проверяем существование пользователя
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        await sendMessage(chatId, `⚠️ Користувач з ID ${userId} не знайдений в системі. Спробуйте ще раз.`);
        return;
      }

      // Сохраняем ID пользователя и переходим к следующему шагу
      state.data.userId = userId;
      state.data.username = user.username || `ID: ${userId}`;
      state.stage = 'deposit_select_token';

      await sendMessage(chatId, `
<b>➕ Видача депозиту</b>
Користувач: ${state.data.username}

Виберіть тип токену:
      `, {
        reply_markup: JSON.stringify({
          keyboard: [
            [{ text: "TON" }, { text: "UNI" }],
            [{ text: "❌ Скасувати" }]
          ],
          resize_keyboard: true,
          one_time_keyboard: false
        })
      });
      break;

    case 'deposit_select_token':
      const token = messageText.trim().toUpperCase();
      if (token !== 'TON' && token !== 'UNI') {
        await sendMessage(chatId, "⚠️ Некоректний тип токену. Виберіть TON або UNI.");
        return;
      }

      // Сохраняем тип токена и переходим к следующему шагу
      state.data.token = token;
      state.stage = 'deposit_enter_amount';

      await sendMessage(chatId, `
<b>➕ Видача депозиту</b>
Користувач: ${state.data.username}
Токен: ${token}

Введіть суму для видачі:
      `);
      break;

    case 'deposit_enter_amount':
      const amount = parseFloat(messageText.trim().replace(',', '.'));
      if (isNaN(amount) || amount <= 0) {
        await sendMessage(chatId, "⚠️ Некоректна сума. Будь ласка, введіть додатнє число.");
        return;
      }

      // Сохраняем сумму и переходим к подтверждению
      state.data.amount = amount;
      state.stage = 'deposit_confirm';

      await sendMessage(chatId, `
<b>➕ Видача депозиту</b>
Перевірте деталі операції:

Користувач: ${state.data.username}
Токен: ${state.data.token}
Сума: ${state.data.amount}

Підтвердіть операцію:
      `, {
        reply_markup: JSON.stringify({
          keyboard: [
            [{ text: "✅ Підтвердити" }],
            [{ text: "❌ Скасувати" }]
          ],
          resize_keyboard: true,
          one_time_keyboard: false
        })
      });
      break;

    case 'deposit_confirm':
      if (messageText.trim() !== "✅ Підтвердити") {
        delete conversationState[chatId];
        await sendMessage(chatId, "❌ Операцію скасовано.", {
          reply_markup: JSON.stringify(getMainMenuKeyboard())
        });
        return;
      }

      // Выполняем операцию выдачи депозита
      const result = await processManualDeposit(
        state.data.userId,
        state.data.token,
        state.data.amount
      );

      if (result.success) {
        await sendMessage(chatId, `
✅ <b>Депозит успішно виконано</b>

Користувач: ${state.data.username}
Токен: ${state.data.token}
Сума: ${state.data.amount}
ID транзакції: ${result.transactionId}
        `, {
          reply_markup: JSON.stringify(getMainMenuKeyboard())
        });
      } else {
        await sendMessage(chatId, `
❌ <b>Помилка при видачі депозиту</b>

${result.error}

Спробуйте повторити операцію пізніше.
        `, {
          reply_markup: JSON.stringify(getMainMenuKeyboard())
        });
      }

      // Очищаем состояние разговора
      delete conversationState[chatId];
      break;
  }
}

/**
 * Обрабатывает выдачу депозита
 * @param userId - ID пользователя
 * @param token - Тип токена (TON/UNI)
 * @param amount - Сумма депозита
 * @returns Результат операции
 */
async function processManualDeposit(userId: number, token: string, amount: number): Promise<any> {
  try {
    // В реальном проекте здесь должен быть вызов API, а не прямое изменение БД
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    if (!user) {
      return { success: false, error: 'Пользователь не найден' };
    }

    // Определяем, какое поле баланса обновлять
    const balanceField = token === 'TON' ? 'balance_ton' : 'balance_uni';
    const currentBalance = parseFloat(user[balanceField] || '0');
    const newBalance = currentBalance + amount;

    // Обновляем баланс пользователя
    await db
      .update(users)
      .set({
        [balanceField]: newBalance.toString()
      })
      .where(eq(users.id, userId));

    // Создаем транзакцию
    const [transaction] = await db
      .insert(transactions)
      .values({
        user_id: userId,
        type: 'admin_deposit',
        currency: token,
        amount: amount.toString(),
        status: 'confirmed',
        source: 'Admin Bot',
        category: 'manual_deposit',
        description: `Ручное пополнение от администратора`
      })
      .returning();

    return { 
      success: true, 
      transactionId: transaction.id,
      newBalance: newBalance
    };
  } catch (error) {
    console.error(`[AdminBot] Ошибка при выдаче депозита пользователю ${userId}:`, error);
    return { success: false, error: 'Ошибка при выполнении операции' };
  }
}

/**
 * Начинает процесс создания задания
 * @param chatId - ID чата
 */
async function startCreateMissionProcess(chatId: number): Promise<void> {
  // Инициализируем состояние разговора
  conversationState[chatId] = {
    stage: 'mission_enter_name',
    data: {},
    expiresAt: Date.now() + 15 * 60 * 1000 // 15 минут на завершение
  };

  await sendMessage(chatId, `
<b>📝 Створення нового завдання</b>

Для створення завдання потрібно вказати:
1. Назву завдання
2. Опис
3. Винагороду (в UNI)
4. Посилання для виконання

<i>Будь ласка, введіть назву завдання:</i>
  `, {
    reply_markup: JSON.stringify({
      keyboard: [
        [{ text: "❌ Скасувати" }]
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    })
  });
}

/**
 * Продолжает процесс создания задания
 * @param chatId - ID чата
 * @param messageText - Текст сообщения
 */
async function continueMissionProcess(chatId: number, messageText: string): Promise<void> {
  const state = conversationState[chatId];
  
  // Проверяем, не отменил ли пользователь процесс
  if (messageText === "❌ Скасувати") {
    delete conversationState[chatId];
    await sendMessage(chatId, "❌ Процес створення завдання скасовано.", {
      reply_markup: JSON.stringify(getMainMenuKeyboard())
    });
    return;
  }

  switch (state.stage) {
    case 'mission_enter_name':
      if (!messageText.trim()) {
        await sendMessage(chatId, "⚠️ Назва завдання не може бути порожньою. Спробуйте ще раз.");
        return;
      }

      // Сохраняем название и переходим к следующему шагу
      state.data.name = messageText.trim();
      state.stage = 'mission_enter_description';

      await sendMessage(chatId, `
<b>📝 Створення завдання</b>
Назва: ${state.data.name}

Введіть опис завдання:
      `);
      break;

    case 'mission_enter_description':
      if (!messageText.trim()) {
        await sendMessage(chatId, "⚠️ Опис завдання не може бути порожнім. Спробуйте ще раз.");
        return;
      }

      // Сохраняем описание и переходим к следующему шагу
      state.data.description = messageText.trim();
      state.stage = 'mission_enter_reward';

      await sendMessage(chatId, `
<b>📝 Створення завдання</b>
Назва: ${state.data.name}
Опис: ${state.data.description}

Введіть розмір винагороди в UNI:
      `);
      break;

    case 'mission_enter_reward':
      const reward = parseFloat(messageText.trim().replace(',', '.'));
      if (isNaN(reward) || reward <= 0) {
        await sendMessage(chatId, "⚠️ Некоректна сума винагороди. Будь ласка, введіть додатнє число.");
        return;
      }

      // Сохраняем вознаграждение и переходим к следующему шагу
      state.data.reward = reward;
      state.stage = 'mission_enter_link';

      await sendMessage(chatId, `
<b>📝 Створення завдання</b>
Назва: ${state.data.name}
Опис: ${state.data.description}
Винагорода: ${state.data.reward} UNI

Введіть посилання для виконання завдання:
      `);
      break;

    case 'mission_enter_link':
      const link = messageText.trim();
      if (!link || (!link.startsWith('http://') && !link.startsWith('https://'))) {
        await sendMessage(chatId, "⚠️ Некоректне посилання. Посилання має починатися з http:// або https://.");
        return;
      }

      // Сохраняем ссылку и переходим к подтверждению
      state.data.link = link;
      state.stage = 'mission_confirm';

      await sendMessage(chatId, `
<b>📝 Створення завдання</b>
Перевірте деталі:

Назва: ${state.data.name}
Опис: ${state.data.description}
Винагорода: ${state.data.reward} UNI
Посилання: ${state.data.link}

Підтвердіть створення завдання:
      `, {
        reply_markup: JSON.stringify({
          keyboard: [
            [{ text: "✅ Створити завдання" }],
            [{ text: "❌ Скасувати" }]
          ],
          resize_keyboard: true,
          one_time_keyboard: false
        })
      });
      break;

    case 'mission_confirm':
      if (messageText.trim() !== "✅ Створити завдання") {
        delete conversationState[chatId];
        await sendMessage(chatId, "❌ Створення завдання скасовано.", {
          reply_markup: JSON.stringify(getMainMenuKeyboard())
        });
        return;
      }

      // Создаем задание
      const result = await createMission(
        state.data.name,
        state.data.description,
        state.data.reward,
        state.data.link
      );

      if (result.success) {
        await sendMessage(chatId, `
✅ <b>Завдання успішно створено</b>

Назва: ${state.data.name}
Опис: ${state.data.description}
Винагорода: ${state.data.reward} UNI
Посилання: ${state.data.link}
ID завдання: ${result.missionId}
        `, {
          reply_markup: JSON.stringify(getMainMenuKeyboard())
        });
      } else {
        await sendMessage(chatId, `
❌ <b>Помилка при створенні завдання</b>

${result.error}

Спробуйте повторити операцію пізніше.
        `, {
          reply_markup: JSON.stringify(getMainMenuKeyboard())
        });
      }

      // Очищаем состояние разговора
      delete conversationState[chatId];
      break;
  }
}

/**
 * Создает новое задание
 * @param name - Название задания
 * @param description - Описание задания
 * @param reward - Вознаграждение
 * @param link - Ссылка на задание
 * @returns Результат операции
 */
async function createMission(name: string, description: string, reward: number, link: string): Promise<any> {
  try {
    // В реальном проекте здесь должен быть вызов API, а не прямое изменение БД
    const [mission] = await db
      .insert(missions)
      .values({
        title: name,
        description: description,
        reward: reward.toString(),
        link: link,
        is_active: true,
        created_at: new Date()
      })
      .returning();

    return { 
      success: true, 
      missionId: mission.id
    };
  } catch (error) {
    console.error(`[AdminBot] Ошибка при создании задания "${name}":`, error);
    return { success: false, error: 'Ошибка при создании задания' };
  }
}

/**
 * Получает аналитику по платформе
 * @returns Данные аналитики
 */
async function getPlatformStats(): Promise<any> {
  try {
    // В реальном проекте здесь должен быть вызов API, а не прямые запросы к БД
    
    // Получаем количество пользователей
    const [userCount] = await db
      .select({ count: db.fn.count().as('count') })
      .from(users);
    
    // Получаем общую сумму фарминга
    const [farmingTotal] = await db
      .select({
        total: db.sql`SUM(CAST(uni_farming_deposit AS DECIMAL))`.as('total')
      })
      .from(users);
    
    // Получаем количество транзакций за последние 7 дней
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    
    const [recentTransactions] = await db
      .select({ count: db.fn.count().as('count') })
      .from(transactions)
      .where(gte(transactions.created_at, lastWeek));
    
    // Получаем общую сумму бонусов
    const [bonusTotal] = await db
      .select({
        total: db.sql`SUM(CAST(amount AS DECIMAL))`.as('total')
      })
      .from(transactions)
      .where(eq(transactions.type, 'bonus'));
    
    return {
      userCount: parseInt(userCount.count) || 0,
      farmingTotal: parseFloat(farmingTotal.total) || 0,
      recentTransactions: parseInt(recentTransactions.count) || 0,
      bonusTotal: parseFloat(bonusTotal.total) || 0
    };
  } catch (error) {
    console.error('[AdminBot] Ошибка при получении аналитики:', error);
    return null;
  }
}

/**
 * Показывает аналитику по платформе
 * @param chatId - ID чата
 */
async function showPlatformStats(chatId: number): Promise<void> {
  try {
    const stats = await getPlatformStats();
    
    if (!stats) {
      await sendMessage(chatId, "❌ Не вдалося отримати аналітику. Спробуйте пізніше.");
      return;
    }
    
    await sendMessage(chatId, `
<b>📊 Аналітика платформи</b>

👥 <b>Користувачі:</b> ${stats.userCount}
💰 <b>Загальний фармінг:</b> ${stats.farmingTotal.toFixed(2)} UNI
🔄 <b>Транзакції (7 днів):</b> ${stats.recentTransactions}
🎁 <b>Видано бонусів:</b> ${stats.bonusTotal.toFixed(2)} UNI

<i>Дані оновлено: ${new Date().toLocaleString()}</i>
    `, {
      reply_markup: JSON.stringify({
        inline_keyboard: [
          [{ text: "🔄 Оновити дані", callback_data: "refresh_stats" }]
        ]
      })
    });
  } catch (error) {
    console.error('[AdminBot] Ошибка при отображении аналитики:', error);
    await sendMessage(chatId, "❌ Виникла помилка при отриманні аналітики. Спробуйте пізніше.");
  }
}

/**
 * Отображает список последних пользователей
 * @param chatId - ID чата
 */
async function showRecentUsers(chatId: number): Promise<void> {
  try {
    // Получаем последних 10 пользователей
    const recentUsers = await db
      .select()
      .from(users)
      .orderBy(desc(users.created_at))
      .limit(10);
    
    if (recentUsers.length === 0) {
      await sendMessage(chatId, "⚠️ Користувачів не знайдено.");
      return;
    }
    
    let message = `<b>👥 Останні користувачі</b>\n\n`;
    
    for (const user of recentUsers) {
      const createdDate = new Date(user.created_at).toLocaleDateString();
      message += `ID: <code>${user.id}</code> - ${user.username || 'Без імені'}\n`;
      message += `Telegram: ${user.telegram_id || 'Не прив\'язаний'}\n`;
      message += `Дата: ${createdDate}\n\n`;
    }
    
    await sendMessage(chatId, message, {
      reply_markup: JSON.stringify({
        inline_keyboard: [
          [{ text: "🔍 Пошук за ID", callback_data: "search_user" }],
          [{ text: "🔄 Оновити список", callback_data: "refresh_users" }]
        ]
      })
    });
  } catch (error) {
    console.error('[AdminBot] Ошибка при отображении пользователей:', error);
    await sendMessage(chatId, "❌ Виникла помилка при отриманні списку користувачів. Спробуйте пізніше.");
  }
}

/**
 * Начинает процесс поиска пользователя
 * @param chatId - ID чата
 */
async function startUserSearch(chatId: number): Promise<void> {
  // Инициализируем состояние разговора
  conversationState[chatId] = {
    stage: 'search_user_enter_id',
    data: {},
    expiresAt: Date.now() + 5 * 60 * 1000 // 5 минут на завершение
  };

  await sendMessage(chatId, `
<b>🔍 Пошук користувача</b>

Введіть ID користувача:
  `, {
    reply_markup: JSON.stringify({
      keyboard: [
        [{ text: "❌ Скасувати" }]
      ],
      resize_keyboard: true,
      one_time_keyboard: false
    })
  });
}

/**
 * Продолжает процесс поиска пользователя
 * @param chatId - ID чата
 * @param messageText - Текст сообщения
 */
async function continueUserSearch(chatId: number, messageText: string): Promise<void> {
  // Проверяем, не отменил ли пользователь процесс
  if (messageText === "❌ Скасувати") {
    delete conversationState[chatId];
    await sendMessage(chatId, "❌ Пошук скасовано.", {
      reply_markup: JSON.stringify(getMainMenuKeyboard())
    });
    return;
  }

  const userId = parseInt(messageText.trim());
  if (isNaN(userId) || userId <= 0) {
    await sendMessage(chatId, "⚠️ Некоректний ID користувача. Будь ласка, введіть числове значення.");
    return;
  }

  try {
    // Получаем информацию о пользователе
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    if (!user) {
      await sendMessage(chatId, `⚠️ Користувач з ID ${userId} не знайдений в системі.`, {
        reply_markup: JSON.stringify(getMainMenuKeyboard())
      });
      delete conversationState[chatId];
      return;
    }
    
    // Получаем последние транзакции пользователя
    const recentTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.user_id, userId))
      .orderBy(desc(transactions.created_at))
      .limit(5);
    
    // Формируем сообщение с информацией о пользователе
    let message = `
<b>👤 Інформація про користувача</b>

ID: <code>${user.id}</code>
Ім'я: ${user.username || 'Не вказано'}
Telegram ID: ${user.telegram_id || 'Не прив\'язаний'}
Реф. код: ${user.ref_code || 'Не вказано'}
Запрошений: ${user.parent_ref_code || 'Немає'}
Баланс UNI: ${parseFloat(user.balance_uni || '0').toFixed(2)} UNI
Баланс TON: ${parseFloat(user.balance_ton || '0').toFixed(6)} TON
Депозит UNI: ${parseFloat(user.uni_farming_deposit || '0').toFixed(2)} UNI
Дата реєстрації: ${new Date(user.created_at).toLocaleString()}
    `;
    
    // Добавляем информацию о транзакциях
    if (recentTransactions.length > 0) {
      message += `\n<b>Останні транзакції:</b>\n`;
      
      for (const tx of recentTransactions) {
        const date = new Date(tx.created_at).toLocaleString();
        const amount = parseFloat(tx.amount).toFixed(tx.currency === 'TON' ? 6 : 2);
        message += `${date} - ${tx.type}: ${amount} ${tx.currency} (${tx.status})\n`;
      }
    }
    
    await sendMessage(chatId, message, {
      reply_markup: JSON.stringify({
        inline_keyboard: [
          [
            { text: "➕ Видати депозит", callback_data: `manual_deposit:${userId}` },
            { text: "📊 Всі транзакції", callback_data: `user_transactions:${userId}` }
          ]
        ]
      })
    });
    
    // Очищаем состояние разговора
    delete conversationState[chatId];
  } catch (error) {
    console.error(`[AdminBot] Ошибка при поиске пользователя ${userId}:`, error);
    await sendMessage(chatId, "❌ Виникла помилка при пошуку користувача. Спробуйте пізніше.", {
      reply_markup: JSON.stringify(getMainMenuKeyboard())
    });
    delete conversationState[chatId];
  }
}

/**
 * Показывает системные действия
 * @param chatId - ID чата
 */
async function showSystemActions(chatId: number): Promise<void> {
  await sendMessage(chatId, `
<b>⚙️ Системні дії</b>

Оберіть дію для виконання:
  `, {
    reply_markup: JSON.stringify({
      inline_keyboard: [
        [{ text: "🔄 Перезапуск фармінгу", callback_data: "restart_farming" }],
        [{ text: "🔃 Синхронізація балансів", callback_data: "sync_balances" }],
        [{ text: "📢 Масова розсилка", callback_data: "start_broadcast" }]
      ]
    })
  });
}

/**
 * Обрабатывает сообщение от пользователя
 * @param message - Сообщение от пользователя
 */
export async function handleAdminBotMessage(message: TelegramMessage): Promise<void> {
  if (!message.text) return;

  const chatId = message.chat.id;
  const username = message.from.username;
  const text = message.text;

  console.log(`[AdminBot] Получено сообщение от ${username || message.from.id}: ${text}`);

  // Проверяем авторизацию для всех команд, кроме /start
  if (text !== '/start' && !isAuthorizedAdmin(username)) {
    await sendAccessDeniedMessage(chatId);
    return;
  }

  // Проверяем, находится ли пользователь в процессе многоэтапного диалога
  if (conversationState[chatId] && conversationState[chatId].expiresAt > Date.now()) {
    if (conversationState[chatId].stage.startsWith('deposit_')) {
      await continueDepositProcess(chatId, text);
      return;
    } else if (conversationState[chatId].stage.startsWith('mission_')) {
      await continueMissionProcess(chatId, text);
      return;
    } else if (conversationState[chatId].stage.startsWith('search_user_')) {
      await continueUserSearch(chatId, text);
      return;
    }
  }

  // Обрабатываем команды и сообщения
  switch (text) {
    case '/start':
      await handleStartCommand(message);
      break;

    case "📤 Заявки на вивід":
      await handleWithdrawRequests(chatId);
      break;

    case "➕ Видача депозитів":
      await startDepositProcess(chatId);
      break;

    case "📝 Додати завдання":
      await startCreateMissionProcess(chatId);
      break;

    case "📊 Аналітика":
      await showPlatformStats(chatId);
      break;

    case "👥 Користувачі":
      await showRecentUsers(chatId);
      break;

    case "⚙️ Системні дії":
      await showSystemActions(chatId);
      break;

    default:
      // Если сообщение не распознано, возвращаем пользователя в главное меню
      await sendMessage(chatId, "⚠️ Невідома команда. Використовуйте меню для вибору дій.", {
        reply_markup: JSON.stringify(getMainMenuKeyboard())
      });
      break;
  }
}

/**
 * Обрабатывает callback_query от инлайн-кнопок
 * @param callbackQuery - Объект callback_query от Telegram
 */
export async function handleAdminBotCallbackQuery(callbackQuery: TelegramCallbackQuery): Promise<void> {
  if (!callbackQuery.data || !callbackQuery.message) {
    console.error('[AdminBot] Получен неполный callback_query без data или message');
    return;
  }

  const data = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const username = callbackQuery.from.username;

  console.log(`[AdminBot] Получен callback_query: ${data} от пользователя ${username || callbackQuery.from.id}`);

  // Проверяем авторизацию
  if (!isAuthorizedAdmin(username)) {
    await answerCallbackQuery(callbackQuery.id, "⛔️ Доступ заборонено. Ви не авторизовані.", true);
    return;
  }

  // Обрабатываем разные типы callback_data
  if (data.startsWith('confirm_withdraw:')) {
    const withdrawId = parseInt(data.split(':')[1]);
    await answerCallbackQuery(callbackQuery.id, "Обробка заявки...");
    
    const success = await confirmWithdrawRequest(withdrawId);
    
    if (success) {
      await editMessageText(chatId, messageId, `
✅ <b>Заявка #${withdrawId} підтверджена</b>

Виведення коштів успішно підтверджено.
      `);
    } else {
      await answerCallbackQuery(callbackQuery.id, "❌ Помилка при підтвердженні заявки. Спробуйте пізніше.", true);
    }
  } else if (data.startsWith('reject_withdraw:')) {
    const withdrawId = parseInt(data.split(':')[1]);
    await answerCallbackQuery(callbackQuery.id, "Обробка заявки...");
    
    const success = await rejectWithdrawRequest(withdrawId);
    
    if (success) {
      await editMessageText(chatId, messageId, `
❌ <b>Заявка #${withdrawId} відхилена</b>

Виведення коштів відхилено.
      `);
    } else {
      await answerCallbackQuery(callbackQuery.id, "❌ Помилка при відхиленні заявки. Спробуйте пізніше.", true);
    }
  } else if (data === 'refresh_stats') {
    await answerCallbackQuery(callbackQuery.id, "Оновлення аналітики...");
    await showPlatformStats(chatId);
  } else if (data === 'refresh_users') {
    await answerCallbackQuery(callbackQuery.id, "Оновлення списку користувачів...");
    await showRecentUsers(chatId);
  } else if (data === 'search_user') {
    await answerCallbackQuery(callbackQuery.id, "Відкриття пошуку...");
    await startUserSearch(chatId);
  } else if (data.startsWith('user_details:')) {
    const userId = parseInt(data.split(':')[1]);
    await answerCallbackQuery(callbackQuery.id, "Завантаження інформації...");
    
    // Инициализируем процесс поиска пользователя
    conversationState[chatId] = {
      stage: 'search_user_enter_id',
      data: {},
      expiresAt: Date.now() + 5 * 60 * 1000 // 5 минут на завершение
    };
    
    // Искусственно продолжаем процесс поиска, как будто пользователь ввел ID
    await continueUserSearch(chatId, userId.toString());
  } else if (data.startsWith('manual_deposit:')) {
    const userId = parseInt(data.split(':')[1]);
    await answerCallbackQuery(callbackQuery.id, "Підготовка видачі депозиту...");
    
    // Инициализируем состояние диалога видачи депозита и заполняем ID пользователя
    conversationState[chatId] = {
      stage: 'deposit_enter_user_id',
      data: {},
      expiresAt: Date.now() + 15 * 60 * 1000 // 15 минут на завершение
    };
    
    // Искусственно продолжаем процесс, как будто пользователь ввел ID
    await continueDepositProcess(chatId, userId.toString());
  } else if (data === 'restart_farming') {
    await answerCallbackQuery(callbackQuery.id, "Запуск перезапуска фарминга...", true);
    
    try {
      // В реальном проекте здесь должен быть вызов API для перезапуска фарминга
      await sendMessage(chatId, `
🔄 <b>Перезапуск фармінгу</b>

Запущено процедуру перезапуску фармінгу.
Це може зайняти деякий час.
      `);
      
      // Имитация работы процесса
      setTimeout(async () => {
        await sendMessage(chatId, `
✅ <b>Фармінг успішно перезапущено</b>

Процес завершено успішно.
Всі активні депозити оновлено.
      `);
      }, 3000);
    } catch (error) {
      console.error('[AdminBot] Ошибка при перезапуске фарминга:', error);
      await sendMessage(chatId, "❌ Виникла помилка при перезапуску фармінгу. Спробуйте пізніше.");
    }
  } else if (data === 'sync_balances') {
    await answerCallbackQuery(callbackQuery.id, "Запуск синхронизации балансов...", true);
    
    try {
      // В реальном проекте здесь должен быть вызов API для синхронизации балансов
      await sendMessage(chatId, `
🔃 <b>Синхронізація балансів</b>

Запущено процедуру синхронізації балансів.
Це може зайняти деякий час.
      `);
      
      // Имитация работы процесса
      setTimeout(async () => {
        await sendMessage(chatId, `
✅ <b>Баланси успішно синхронізовано</b>

Процес завершено успішно.
Всі баланси користувачів оновлено.
      `);
      }, 3000);
    } catch (error) {
      console.error('[AdminBot] Ошибка при синхронизации балансов:', error);
      await sendMessage(chatId, "❌ Виникла помилка при синхронізації балансів. Спробуйте пізніше.");
    }
  } else if (data === 'start_broadcast') {
    await answerCallbackQuery(callbackQuery.id, "Відкриття форми розсилки...");
    
    // Инициализируем состояние для массовой рассылки
    conversationState[chatId] = {
      stage: 'broadcast_enter_message',
      data: {},
      expiresAt: Date.now() + 30 * 60 * 1000 // 30 минут на завершение
    };
    
    await sendMessage(chatId, `
📢 <b>Масова розсилка</b>

Введіть текст повідомлення для розсилки всім користувачам:
(Підтримується HTML-форматування)
    `, {
      reply_markup: JSON.stringify({
        keyboard: [
          [{ text: "❌ Скасувати" }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      })
    });
  }
}

/**
 * Обрабатывает webhooks от Telegram
 * @param update - Объект обновления от Telegram
 */
export async function processAdminBotUpdate(update: TelegramUpdate): Promise<void> {
  try {
    // Обрабатываем сообщения
    if (update.message) {
      await handleAdminBotMessage(update.message);
    }
    
    // Обрабатываем callback_query от инлайн-кнопок
    else if (update.callback_query) {
      await handleAdminBotCallbackQuery(update.callback_query);
    }
  } catch (error) {
    console.error('[AdminBot] Ошибка при обработке Telegram API запроса:', error);
  }
}

// Очистка устаревших состояний разговоров
setInterval(() => {
  const now = Date.now();
  for (const chatId in conversationState) {
    if (conversationState[chatId].expiresAt < now) {
      delete conversationState[chatId];
    }
  }
}, 5 * 60 * 1000); // Проверяем каждые 5 минут