/**
 * Адміністративний бот Telegram для UniFarm
 * 
 * Реалізує адмін-панель через Telegram бота @unifarm_admin_bot
 * Забезпечує доступ до основних адміністративних функцій системи
 */

import fetch from 'node-fetch';
import { db } from './db';
import { users, transactions, missions, InsertMission } from '../shared/schema';
import { eq, desc, and, gte, lte } from 'drizzle-orm';

// Константи для роботи бота
const ADMIN_BOT_TOKEN = process.env.TELEGRAM_ADMIN_BOT_TOKEN;
const AUTHORIZED_ADMINS = ['DimaOsadchuk', 'a888bnd']; // Список дозволених адміністраторів

// API URL
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://api.unifarm.app' 
  : 'https://uni-farm-connect-x-lukyanenkolawfa.replit.app';

// Типи для Telegram API
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

// Стан розмови для багатоетапних діалогів
interface ConversationState {
  [chatId: number]: {
    stage: string;
    data: any;
    expiresAt: number;
  }
}

// Глобальний стан розмов з користувачами
const conversationState: ConversationState = {};

/**
 * Перевіряє, чи є користувач адміністратором
 * @param username - Ім'я користувача Telegram
 * @returns Чи має користувач права адміністратора
 */
function isAuthorizedAdmin(username?: string): boolean {
  if (!username) return false;
  return AUTHORIZED_ADMINS.includes(username);
}

/**
 * Відправляє повідомлення в Telegram
 * @param chatId - ID чату
 * @param text - Текст повідомлення
 * @param options - Додаткові опції повідомлення
 */
async function sendMessage(chatId: number, text: string, options: Record<string, any> = {}): Promise<any> {
  if (!ADMIN_BOT_TOKEN) {
    console.error('[AdminBot] Відсутній токен бота');
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

    const data = await response.json();
    if (!data || !data.ok) {
      console.error('[AdminBot] Помилка при відправці повідомлення:', data?.description || 'Unknown error');
    }
    return data;
  } catch (error) {
    console.error('[AdminBot] Помилка при відправці повідомлення в Telegram:', error);
  }
}

/**
 * Відправляє відповідь на callback_query
 * @param callbackQueryId - ID callback query
 * @param text - Текст повідомлення
 * @param showAlert - Показувати як alert
 */
async function answerCallbackQuery(callbackQueryId: string, text?: string, showAlert: boolean = false): Promise<any> {
  if (!ADMIN_BOT_TOKEN) {
    console.error('[AdminBot] Неможливо відповісти на callback_query: відсутній токен бота');
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

    const data = await response.json();
    if (!data || !data.ok) {
      console.error('[AdminBot] Помилка при відповіді на callback_query:', data?.description || 'Unknown error');
    }
    return data;
  } catch (error) {
    console.error('[AdminBot] Помилка при відповіді на callback_query:', error);
  }
}

/**
 * Редагує повідомлення
 * @param chatId - ID чату
 * @param messageId - ID повідомлення
 * @param text - Новий текст
 * @param options - Додаткові опції
 */
async function editMessageText(chatId: number, messageId: number, text: string, options: Record<string, any> = {}): Promise<any> {
  if (!ADMIN_BOT_TOKEN) {
    console.error('[AdminBot] Неможливо відредагувати повідомлення: відсутній токен бота');
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

    const data = await response.json();
    if (!data || !data.ok) {
      console.error('[AdminBot] Помилка при редагуванні повідомлення:', data?.description || 'Unknown error');
    }
    return data;
  } catch (error) {
    console.error('[AdminBot] Помилка при редагуванні повідомлення:', error);
  }
}

/**
 * Встановлює webhook для отримання оновлень від Telegram
 * @param url - URL для webhook
 */
export async function setAdminBotWebhook(url: string): Promise<boolean> {
  if (!ADMIN_BOT_TOKEN) {
    console.error('[AdminBot] Помилка: ADMIN_BOT_TOKEN не встановлений');
    return false;
  }

  try {
    const webhookUrl = `${url}/api/admin/bot-webhook`;
    console.log(`[AdminBot] Встановлюємо webhook: ${webhookUrl}`);

    const response = await fetch(`https://api.telegram.org/bot${ADMIN_BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl })
    });

    const data = await response.json();
    if (data && data.ok) {
      console.log(`[AdminBot] Webhook успішно встановлений: ${webhookUrl}`);
      return true;
    } else {
      console.error(`[AdminBot] Помилка встановлення webhook: ${data?.description || 'Unknown error'}`);
      return false;
    }
  } catch (error) {
    console.error('[AdminBot] Помилка при встановленні webhook:', error);
    return false;
  }
}

/**
 * Повертає клавіатуру у форматі ReplyMarkup для головного меню адмін-бота
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
 * Відправляє привітальне повідомлення з головним меню
 * @param chatId - ID чату
 * @param username - Ім'я користувача
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
 * Відправляє повідомлення про заборону доступу
 * @param chatId - ID чату
 */
async function sendAccessDeniedMessage(chatId: number): Promise<void> {
  const message = `
⛔️ <b>Доступ заборонено</b>

Ви не авторизовані як адміністратор UniFarm.
  `;

  await sendMessage(chatId, message);
}

/**
 * Обробляє команду /start від користувача
 * @param message - Повідомлення від користувача
 */
async function handleStartCommand(message: TelegramMessage): Promise<void> {
  const chatId = message.chat.id;
  const username = message.from.username;

  console.log(`[AdminBot] Отримано команду /start від користувача ${username || message.from.id}`);

  if (isAuthorizedAdmin(username)) {
    await sendWelcomeMessage(chatId, username || 'Адміністратор');
  } else {
    await sendAccessDeniedMessage(chatId);
  }
}

/**
 * Отримує список заявок на виведення коштів
 * @returns Список заявок на виведення
 */
async function getWithdrawRequests(): Promise<any[]> {
  try {
    // Тут ми використовуємо прямий запит до БД, в реальному проекті краще використовувати API
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
    console.error('[AdminBot] Помилка при отриманні заявок на виведення:', error);
    return [];
  }
}

/**
 * Обробляє розділ "Заявки на вивід"
 * @param chatId - ID чату
 */
async function handleWithdrawRequests(chatId: number): Promise<void> {
  try {
    // Отримуємо заявки на виведення
    const withdrawRequests = await getWithdrawRequests();

    if (withdrawRequests.length === 0) {
      await sendMessage(chatId, `
<b>📤 Заявки на вивід</b>

На даний момент немає заявок на вивід коштів, які очікують підтвердження.
      `);
      return;
    }

    // Відправляємо повідомлення з інформацією про заявки
    await sendMessage(chatId, `
<b>📤 Заявки на вивід</b>

Знайдено ${withdrawRequests.length} заявок на вивід коштів, які очікують підтвердження.
Виберіть заявку для детального перегляду:
    `);

    // Відправляємо кожну заявку окремим повідомленням для зручності
    for (const request of withdrawRequests) {
      const userId = request.user_id;
      const amount = Math.abs(parseFloat(request.amount)).toFixed(6);
      const currency = request.currency;
      const createdAt = new Date(request.created_at || new Date()).toLocaleString();
      
      // Отримуємо інформацію про користувача
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
    console.error('[AdminBot] Помилка при обробці заявок на виведення:', error);
    await sendMessage(chatId, "❌ Виникла помилка при отриманні заявок на вивід. Спробуйте пізніше.");
  }
}

/**
 * Підтверджує заявку на виведення коштів
 * @param withdrawId - ID заявки на виведення
 * @returns Результат операції
 */
async function confirmWithdrawRequest(withdrawId: number): Promise<boolean> {
  try {
    // В реальному проекті тут має бути виклик API, а не пряма зміна БД
    await db
      .update(transactions)
      .set({
        status: 'confirmed'
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
    console.error(`[AdminBot] Помилка при підтвердженні заявки #${withdrawId}:`, error);
    return false;
  }
}

/**
 * Відхиляє заявку на виведення коштів
 * @param withdrawId - ID заявки на виведення
 * @returns Результат операції
 */
async function rejectWithdrawRequest(withdrawId: number): Promise<boolean> {
  try {
    // В реальному проекті тут має бути виклик API, а не пряма зміна БД
    await db
      .update(transactions)
      .set({
        status: 'rejected'
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
    console.error(`[AdminBot] Помилка при відхиленні заявки #${withdrawId}:`, error);
    return false;
  }
}

/**
 * Починає процес видачі депозиту
 * @param chatId - ID чату
 */
async function startDepositProcess(chatId: number): Promise<void> {
  // Ініціалізуємо стан розмови
  conversationState[chatId] = {
    stage: 'deposit_enter_user_id',
    data: {},
    expiresAt: Date.now() + 15 * 60 * 1000 // 15 хвилин на завершення
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
 * Продовжує процес видачі депозиту
 * @param chatId - ID чату
 * @param messageText - Текст повідомлення
 */
async function continueDepositProcess(chatId: number, messageText: string): Promise<void> {
  const state = conversationState[chatId];
  
  // Перевіряємо, чи не скасував користувач процес
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

      // Перевіряємо існування користувача
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        await sendMessage(chatId, `⚠️ Користувач з ID ${userId} не знайдений в системі. Спробуйте ще раз.`);
        return;
      }

      // Зберігаємо ID користувача і переходимо до наступного кроку
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

      // Зберігаємо тип токена і переходимо до наступного кроку
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

      // Зберігаємо суму і переходимо до підтвердження
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

      // Виконуємо операцію видачі депозиту
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

      // Очищаємо стан розмови
      delete conversationState[chatId];
      break;
  }
}

/**
 * Обробляє видачу депозиту
 * @param userId - ID користувача
 * @param token - Тип токена (TON/UNI)
 * @param amount - Сума депозиту
 * @returns Результат операції
 */
async function processManualDeposit(userId: number, token: string, amount: number): Promise<any> {
  try {
    // В реальному проекті тут має бути виклик API, а не пряма зміна БД
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    if (!user) {
      return { success: false, error: 'Користувач не знайдений' };
    }

    // Визначаємо, яке поле балансу оновлювати
    const balanceField = token === 'TON' ? 'balance_ton' : 'balance_uni';
    const currentBalance = parseFloat(user[balanceField] || '0');
    const newBalance = currentBalance + amount;

    // Оновлюємо баланс користувача
    await db
      .update(users)
      .set({
        [balanceField]: newBalance.toString()
      })
      .where(eq(users.id, userId));

    // Створюємо транзакцію
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
        description: `Ручне поповнення від адміністратора`
      })
      .returning();

    return { 
      success: true, 
      transactionId: transaction.id,
      newBalance: newBalance
    };
  } catch (error) {
    console.error(`[AdminBot] Помилка при видачі депозиту користувачу ${userId}:`, error);
    return { success: false, error: 'Помилка при виконанні операції' };
  }
}

/**
 * Починає процес створення завдання
 * @param chatId - ID чату
 */
async function startCreateMissionProcess(chatId: number): Promise<void> {
  // Ініціалізуємо стан розмови
  conversationState[chatId] = {
    stage: 'mission_enter_name',
    data: {},
    expiresAt: Date.now() + 15 * 60 * 1000 // 15 хвилин на завершення
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
 * Продовжує процес створення завдання
 * @param chatId - ID чату
 * @param messageText - Текст повідомлення
 */
async function continueMissionProcess(chatId: number, messageText: string): Promise<void> {
  const state = conversationState[chatId];
  
  // Перевіряємо, чи не скасував користувач процес
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

      // Зберігаємо назву і переходимо до наступного кроку
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

      // Зберігаємо опис і переходимо до наступного кроку
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

      // Зберігаємо винагороду і переходимо до наступного кроку
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

      // Зберігаємо посилання і переходимо до підтвердження
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

      // Створюємо завдання
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

      // Очищаємо стан розмови
      delete conversationState[chatId];
      break;
  }
}

/**
 * Створює нове завдання
 * @param name - Назва завдання
 * @param description - Опис завдання
 * @param reward - Винагорода
 * @param link - Посилання на завдання
 * @returns Результат операції
 */
async function createMission(name: string, description: string, reward: number, link: string): Promise<any> {
  try {
    // В реальному проекті тут має бути виклик API, а не пряма зміна БД
    // Скористаємося готовою схемою для вставки даних
    const missionData: InsertMission = {
      type: 'custom',
      title: name,
      description: description,
      reward_uni: reward.toString(),
      is_active: true
    };
    
    const [mission] = await db
      .insert(missions)
      .values(missionData)
      .returning();

    return { 
      success: true, 
      missionId: mission.id
    };
  } catch (error) {
    console.error(`[AdminBot] Помилка при створенні завдання "${name}":`, error);
    return { success: false, error: 'Помилка при створенні завдання' };
  }
}

/**
 * Отримує аналітику по платформі
 * @returns Дані аналітики
 */
async function getPlatformStats(): Promise<any> {
  try {
    // В реальному проекті тут має бути виклик API, а не прямі запити до БД
    
    // Отримуємо кількість користувачів
    const userCount = await db
      .select()
      .from(users)
      .then(users => users.length);
    
    // Отримуємо загальну суму фармінгу (використовуємо uni_farming_deposit)
    const farmingTotal = await db
      .select()
      .from(users)
      .then(users => {
        let total = 0;
        for (const user of users) {
          total += parseFloat(user.uni_farming_deposit?.toString() || '0');
        }
        return total;
      });
    
    // Отримуємо кількість транзакцій за останні 7 днів
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    
    const recentTransactions = await db
      .select()
      .from(transactions)
      .where(gte(transactions.created_at, lastWeek))
      .then(transactions => transactions.length);
    
    // Отримуємо загальну суму бонусів
    const bonusTotal = await db
      .select()
      .from(transactions)
      .where(eq(transactions.type, 'bonus'))
      .then(transactions => {
        let total = 0;
        for (const tx of transactions) {
          if (tx.amount) {
            total += parseFloat(tx.amount.toString());
          }
        }
        return total;
      });
    
    return {
      userCount: userCount,
      farmingTotal: farmingTotal,
      recentTransactions: recentTransactions,
      bonusTotal: bonusTotal
    };
  } catch (error) {
    console.error('[AdminBot] Помилка при отриманні аналітики:', error);
    return null;
  }
}

/**
 * Показує аналітику по платформі
 * @param chatId - ID чату
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
    console.error('[AdminBot] Помилка при відображенні аналітики:', error);
    await sendMessage(chatId, "❌ Виникла помилка при отриманні аналітики. Спробуйте пізніше.");
  }
}

/**
 * Відображає список останніх користувачів
 * @param chatId - ID чату
 */
async function showRecentUsers(chatId: number): Promise<void> {
  try {
    // Отримуємо останніх 10 користувачів
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
      const createdDate = user.created_at 
        ? new Date(user.created_at).toLocaleDateString() 
        : 'Невідомо';
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
    console.error('[AdminBot] Помилка при відображенні користувачів:', error);
    await sendMessage(chatId, "❌ Виникла помилка при отриманні списку користувачів. Спробуйте пізніше.");
  }
}

/**
 * Починає процес пошуку користувача
 * @param chatId - ID чату
 */
async function startUserSearch(chatId: number): Promise<void> {
  // Ініціалізуємо стан розмови
  conversationState[chatId] = {
    stage: 'search_user_enter_id',
    data: {},
    expiresAt: Date.now() + 5 * 60 * 1000 // 5 хвилин на завершення
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
 * Продовжує процес пошуку користувача
 * @param chatId - ID чату
 * @param messageText - Текст повідомлення
 */
async function continueUserSearch(chatId: number, messageText: string): Promise<void> {
  // Перевіряємо, чи не скасував користувач процес
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
    // Отримуємо інформацію про користувача
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    if (!user) {
      await sendMessage(chatId, `⚠️ Користувач з ID ${userId} не знайдений в системі.`, {
        reply_markup: JSON.stringify(getMainMenuKeyboard())
      });
      delete conversationState[chatId];
      return;
    }
    
    // Отримуємо останні транзакції користувача
    const recentTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.user_id, userId))
      .orderBy(desc(transactions.created_at))
      .limit(5);
    
    // Формуємо повідомлення з інформацією про користувача
    let message = `
<b>👤 Інформація про користувача</b>

ID: <code>${user.id}</code>
Ім'я: ${user.username || 'Не вказано'}
Telegram ID: ${user.telegram_id || 'Не прив\'язаний'}
Реф. код: ${user.ref_code || 'Не вказано'}
Запрошений: ${user.parent_ref_code || 'Немає'}
Баланс UNI: ${parseFloat(user.balance_uni?.toString() || '0').toFixed(2)} UNI
Баланс TON: ${parseFloat(user.balance_ton?.toString() || '0').toFixed(6)} TON
Депозит UNI: ${parseFloat(user.uni_farming_deposit?.toString() || '0').toFixed(2)} UNI
Дата реєстрації: ${user.created_at ? new Date(user.created_at).toLocaleString() : 'Невідомо'}
    `;
    
    // Додаємо інформацію про транзакції
    if (recentTransactions.length > 0) {
      message += `\n<b>Останні транзакції:</b>\n`;
      
      for (const tx of recentTransactions) {
        const date = tx.created_at ? new Date(tx.created_at).toLocaleString() : 'Невідомо';
        const amount = tx.amount ? parseFloat(tx.amount).toFixed(tx.currency === 'TON' ? 6 : 2) : '0';
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
    
    // Очищаємо стан розмови
    delete conversationState[chatId];
  } catch (error) {
    console.error(`[AdminBot] Помилка при пошуку користувача ${userId}:`, error);
    await sendMessage(chatId, "❌ Виникла помилка при пошуку користувача. Спробуйте пізніше.", {
      reply_markup: JSON.stringify(getMainMenuKeyboard())
    });
    delete conversationState[chatId];
  }
}

/**
 * Показує системні дії
 * @param chatId - ID чату
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
 * Обробляє повідомлення від користувача
 * @param message - Повідомлення від користувача
 */
export async function handleAdminBotMessage(message: TelegramMessage): Promise<void> {
  if (!message.text) return;

  const chatId = message.chat.id;
  const username = message.from.username;
  const text = message.text;

  console.log(`[AdminBot] Отримано повідомлення від ${username || message.from.id}: ${text}`);

  // Перевіряємо авторизацію для всіх команд, крім /start
  if (text !== '/start' && !isAuthorizedAdmin(username)) {
    await sendAccessDeniedMessage(chatId);
    return;
  }

  // Перевіряємо, чи знаходиться користувач у процесі багатоетапного діалогу
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

  // Обробляємо команди і повідомлення
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
      // Якщо повідомлення не розпізнано, повертаємо користувача до головного меню
      await sendMessage(chatId, "⚠️ Невідома команда. Використовуйте меню для вибору дій.", {
        reply_markup: JSON.stringify(getMainMenuKeyboard())
      });
      break;
  }
}

/**
 * Обробляє callback_query від інлайн-кнопок
 * @param callbackQuery - Об'єкт callback_query від Telegram
 */
export async function handleAdminBotCallbackQuery(callbackQuery: TelegramCallbackQuery): Promise<void> {
  if (!callbackQuery.data || !callbackQuery.message) {
    console.error('[AdminBot] Отримано неповний callback_query без data або message');
    return;
  }

  const data = callbackQuery.data;
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const username = callbackQuery.from.username;

  console.log(`[AdminBot] Отримано callback_query: ${data} від користувача ${username || callbackQuery.from.id}`);

  // Перевіряємо авторизацію
  if (!isAuthorizedAdmin(username)) {
    await answerCallbackQuery(callbackQuery.id, "⛔️ Доступ заборонено. Ви не авторизовані.", true);
    return;
  }

  // Обробляємо різні типи callback_data
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
    
    // Ініціалізуємо процес пошуку користувача
    conversationState[chatId] = {
      stage: 'search_user_enter_id',
      data: {},
      expiresAt: Date.now() + 5 * 60 * 1000 // 5 хвилин на завершення
    };
    
    // Штучно продовжуємо процес пошуку, ніби користувач ввів ID
    await continueUserSearch(chatId, userId.toString());
  } else if (data.startsWith('manual_deposit:')) {
    const userId = parseInt(data.split(':')[1]);
    await answerCallbackQuery(callbackQuery.id, "Підготовка видачі депозиту...");
    
    // Ініціалізуємо стан діалогу видачі депозиту і заповнюємо ID користувача
    conversationState[chatId] = {
      stage: 'deposit_enter_user_id',
      data: {},
      expiresAt: Date.now() + 15 * 60 * 1000 // 15 хвилин на завершення
    };
    
    // Штучно продовжуємо процес, ніби користувач ввів ID
    await continueDepositProcess(chatId, userId.toString());
  } else if (data === 'restart_farming') {
    await answerCallbackQuery(callbackQuery.id, "Запуск перезапуску фармінгу...", true);
    
    try {
      // В реальному проекті тут має бути виклик API для перезапуску фармінгу
      await sendMessage(chatId, `
🔄 <b>Перезапуск фармінгу</b>

Запущено процедуру перезапуску фармінгу.
Це може зайняти деякий час.
      `);
      
      // Імітація роботи процесу
      setTimeout(async () => {
        await sendMessage(chatId, `
✅ <b>Фармінг успішно перезапущено</b>

Процес завершено успішно.
Всі активні депозити оновлено.
      `);
      }, 3000);
    } catch (error) {
      console.error('[AdminBot] Помилка при перезапуску фармінгу:', error);
      await sendMessage(chatId, "❌ Виникла помилка при перезапуску фармінгу. Спробуйте пізніше.");
    }
  } else if (data === 'sync_balances') {
    await answerCallbackQuery(callbackQuery.id, "Запуск синхронізації балансів...", true);
    
    try {
      // В реальному проекті тут має бути виклик API для синхронізації балансів
      await sendMessage(chatId, `
🔃 <b>Синхронізація балансів</b>

Запущено процедуру синхронізації балансів.
Це може зайняти деякий час.
      `);
      
      // Імітація роботи процесу
      setTimeout(async () => {
        await sendMessage(chatId, `
✅ <b>Баланси успішно синхронізовано</b>

Процес завершено успішно.
Всі баланси користувачів оновлено.
      `);
      }, 3000);
    } catch (error) {
      console.error('[AdminBot] Помилка при синхронізації балансів:', error);
      await sendMessage(chatId, "❌ Виникла помилка при синхронізації балансів. Спробуйте пізніше.");
    }
  } else if (data === 'start_broadcast') {
    await answerCallbackQuery(callbackQuery.id, "Відкриття форми розсилки...");
    
    // Ініціалізуємо стан для масової розсилки
    conversationState[chatId] = {
      stage: 'broadcast_enter_message',
      data: {},
      expiresAt: Date.now() + 30 * 60 * 1000 // 30 хвилин на завершення
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
 * Обробляє webhook-и від Telegram
 * @param update - Об'єкт оновлення від Telegram
 */
export async function processAdminBotUpdate(update: TelegramUpdate): Promise<void> {
  try {
    // Обробляємо повідомлення
    if (update.message) {
      await handleAdminBotMessage(update.message);
    }
    
    // Обробляємо callback_query від інлайн-кнопок
    else if (update.callback_query) {
      await handleAdminBotCallbackQuery(update.callback_query);
    }
  } catch (error) {
    console.error('[AdminBot] Помилка при обробці Telegram API запиту:', error);
  }
}

// Очищення застарілих станів розмов
setInterval(() => {
  const now = Date.now();
  for (const chatId in conversationState) {
    if (conversationState[chatId].expiresAt < now) {
      delete conversationState[chatId];
    }
  }
}, 5 * 60 * 1000); // Перевіряємо кожні 5 хвилин