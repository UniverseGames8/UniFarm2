/**
 * 🤖 Умный Telegram бот UniFarm с разделением доступа
 * 
 * Показывает разные интерфейсы для:
 * - Обычных пользователей: только приложение
 * - Администраторов: приложение + админ-панель
 */

import fetch from 'node-fetch';
import logger from '../utils/logger';

// Константы
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const AUTHORIZED_ADMINS = ['a888bnd', 'DimaOsadchuk'];
const MINI_APP_URL = process.env.MINI_APP_URL || process.env.APP_URL || 'https://uni-farm-connect-x-lukyanenkolawfa.replit.app';
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://uni-farm-connect-x-lukyanenkolawfa.replit.app'
  : 'https://uni-farm-connect-x-lukyanenkolawfa.replit.app';
const ADMIN_SECRET = 'unifarm_admin_secret_2025';

// Типы Telegram
interface TelegramUser {
  id: number;
  first_name?: string;
  username?: string;
}

interface TelegramMessage {
  message_id: number;
  from: TelegramUser;
  chat: { id: number };
  text?: string;
}

interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

interface TelegramUpdate {
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

/**
 * 🔐 Проверка, является ли пользователь администратором
 */
function isAdmin(username?: string): boolean {
  return username ? AUTHORIZED_ADMINS.includes(username) : false;
}

/**
 * 📨 Отправка сообщения
 */
async function sendMessage(chatId: number, text: string, options: any = {}): Promise<void> {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      ...options
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      logger.error(`[SmartBot] Ошибка отправки сообщения: ${response.statusText}`);
    }
  } catch (error) {
    logger.error('[SmartBot] Ошибка при отправке сообщения:', error);
  }
}

/**
 * ✏️ Редактирование сообщения
 */
async function editMessage(chatId: number, messageId: number, text: string, options: any = {}): Promise<void> {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`;
    
    const payload = {
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: 'HTML',
      ...options
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      logger.error(`[SmartBot] Ошибка редактирования сообщения: ${response.statusText}`);
    }
  } catch (error) {
    logger.error('[SmartBot] Ошибка при редактировании сообщения:', error);
  }
}

/**
 * 👥 Клавиатура для обычных пользователей
 */
function getUserKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text: "📱 Открыть UniFarm",
          web_app: { url: MINI_APP_URL }
        }
      ],
      [
        { text: "ℹ️ Помощь", callback_data: "help" },
        { text: "🔗 Реферальный код", callback_data: "ref_code" }
      ]
    ]
  };
}

/**
 * 🛠️ Клавиатура для администраторов
 */
function getAdminKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text: "📱 Открыть UniFarm",
          web_app: { url: MINI_APP_URL }
        },
        { text: "🛠️ Админ-панель", callback_data: "admin_panel" }
      ],
      [
        { text: "ℹ️ Помощь", callback_data: "help" },
        { text: "🔗 Реферальный код", callback_data: "ref_code" }
      ]
    ]
  };
}

/**
 * 🎛️ Главное меню админ-панели
 */
function getAdminPanelKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "🗄️ База данных", callback_data: "admin_database" },
        { text: "👥 Пользователи", callback_data: "admin_users" }
      ],
      [
        { text: "💰 Финансы", callback_data: "admin_finance" },
        { text: "📊 Аналитика", callback_data: "admin_analytics" }
      ],
      [
        { text: "🔗 Реферальная система", callback_data: "admin_referral" },
        { text: "⚙️ Система", callback_data: "admin_system" }
      ],
      [
        { text: "🔄 Обновить статус", callback_data: "admin_refresh" },
        { text: "⬅️ Назад", callback_data: "back_main" }
      ]
    ]
  };
}

/**
 * 🗄️ Меню базы данных
 */
function getDatabaseKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "🔌 Переподключить БД", callback_data: "db_reconnect" },
        { text: "📋 События БД", callback_data: "db_events" }
      ],
      [
        { text: "📊 Статус соединения", callback_data: "db_status" },
        { text: "🧪 Тест подключения", callback_data: "db_test" }
      ],
      [
        { text: "⬅️ Назад к админ-панели", callback_data: "admin_panel" }
      ]
    ]
  };
}

/**
 * 🏠 Отправка главного меню
 */
async function sendMainMenu(chatId: number, username?: string, messageId?: number): Promise<void> {
  const isUserAdmin = isAdmin(username);
  
  const welcomeText = isUserAdmin 
    ? `🎛️ <b>Добро пожаловать в UniFarm, ${username}!</b>

Вы вошли как <b>администратор</b>.
Выберите нужное действие:

📱 <i>Приложение</i> - основная платформа
🛠️ <i>Админ-панель</i> - управление системой`
    : `👋 <b>Добро пожаловать в UniFarm!</b>

🌱 Начните фармить UNI токены прямо сейчас!
💰 Приглашайте друзей и получайте бонусы
🎯 Выполняйте задания для дополнительных наград`;

  const keyboard = isUserAdmin ? getAdminKeyboard() : getUserKeyboard();

  if (messageId) {
    await editMessage(chatId, messageId, welcomeText, {
      reply_markup: JSON.stringify(keyboard)
    });
  } else {
    await sendMessage(chatId, welcomeText, {
      reply_markup: JSON.stringify(keyboard)
    });
  }
}

/**
 * 🛠️ Отправка админ-панели
 */
async function sendAdminPanel(chatId: number, messageId?: number): Promise<void> {
  const adminText = `
🎛️ <b>Админ-панель UniFarm</b>

Добро пожаловать в центр управления платформой!
Выберите нужный раздел:

<i>💡 Все действия логируются для безопасности</i>
  `;

  if (messageId) {
    await editMessage(chatId, messageId, adminText, {
      reply_markup: JSON.stringify(getAdminPanelKeyboard())
    });
  } else {
    await sendMessage(chatId, adminText, {
      reply_markup: JSON.stringify(getAdminPanelKeyboard())
    });
  }
}

/**
 * 🎯 Универсальная обработка всех админских действий
 */
async function handleAdminAction(chatId: number, action: string, username: string, messageId?: number): Promise<void> {
  if (action.startsWith('admin_database') || action.startsWith('db_')) {
    await handleDatabaseAction(chatId, action, username, messageId);
    return;
  }

  switch (action) {
    case 'admin_users':
      const usersMenuText = `
👥 <b>Управление пользователями</b>

Выберите операцию:
      `;
      
      if (messageId) {
        await editMessage(chatId, messageId, usersMenuText, {
          reply_markup: JSON.stringify(getUserKeyboard())
        });
      }
      break;

    case 'users_stats':
      await sendMessage(chatId, "📊 Получение статистики пользователей...");
      
      try {
        const response = await fetch(`${API_BASE_URL}/api/admin/users/stats`);
        const result = await response.json();
        
        if (result.success) {
          const stats = result.data;
          const statsText = `
📊 <b>Статистика пользователей</b>

👥 Всего пользователей: ${stats.total}
🟢 Активных: ${stats.active}
🆕 Новых сегодня: ${stats.newToday}
📅 Последняя регистрация: ${stats.lastRegistered ? new Date(stats.lastRegistered).toLocaleString('ru-RU') : 'Нет данных'}
          `;
          await sendMessage(chatId, statsText);
        } else {
          await sendMessage(chatId, `❌ Ошибка: ${result.error}`);
        }
      } catch (error) {
        await sendMessage(chatId, `❌ Ошибка получения статистики: ${error}`);
      }
      break;

    case 'admin_finance':
      const financeMenuText = `
💰 <b>Финансовые операции</b>

Выберите операцию:
      `;
      
      if (messageId) {
        await editMessage(chatId, messageId, financeMenuText, {
          reply_markup: JSON.stringify(getAdminPanelKeyboard())
        });
      }
      break;

    case 'finance_withdrawals':
      await sendMessage(chatId, "💰 Получение заявок на вывод...");
      
      try {
        const response = await fetch(`${API_BASE_URL}/api/admin/finance/withdrawals`);
        const result = await response.json();
        
        if (result.success) {
          const withdrawals = result.data.slice(0, 5);
          let withdrawText = "💰 <b>Заявки на вывод:</b>\n\n";
          
          if (withdrawals.length === 0) {
            withdrawText += "✅ Новых заявок нет";
          } else {
            withdrawals.forEach((w: any, index: number) => {
              withdrawText += `${index + 1}. 👤 ID: ${w.userId}\n`;
              withdrawText += `   💰 Сумма: ${w.amount} ${w.currency}\n`;
              withdrawText += `   📅 Дата: ${new Date(w.created_at).toLocaleString('ru-RU')}\n\n`;
            });
          }
          
          await sendMessage(chatId, withdrawText);
        } else {
          await sendMessage(chatId, `❌ Ошибка: ${result.error}`);
        }
      } catch (error) {
        await sendMessage(chatId, `❌ Ошибка получения заявок: ${error}`);
      }
      break;

    case 'admin_analytics':
      await sendMessage(chatId, "📊 Загрузка аналитики...");
      
      try {
        const response = await fetch(`${API_BASE_URL}/api/admin/analytics/overview`);
        const result = await response.json();
        
        if (result.success) {
          const data = result.data;
          const analyticsText = `
📊 <b>Аналитика системы</b>

👥 Всего пользователей: ${data.totalUsers}
💰 UNI в системе: ${data.totalUniInSystem}
📈 Всего депозитов: ${data.totalDeposits}
📉 Всего выводов: ${data.totalWithdraws}
⏳ Ожидающих вывод: ${data.pendingWithdrawals}
          `;
          await sendMessage(chatId, analyticsText);
        } else {
          await sendMessage(chatId, `❌ Ошибка: ${result.error}`);
        }
      } catch (error) {
        await sendMessage(chatId, `❌ Ошибка получения аналитики: ${error}`);
      }
      break;

    case 'admin_referral':
      await sendMessage(chatId, "🔗 Загрузка статистики рефералов...");
      
      try {
        const response = await fetch(`${API_BASE_URL}/api/admin/referral/stats`);
        const result = await response.json();
        
        if (result.success) {
          const stats = result.data;
          let referralText = `
🔗 <b>Реферальная система</b>

📊 Всего рефералов: ${stats.totalReferrals}
🎯 Активных кодов: ${stats.totalReferralCodes}

🏆 <b>Топ реферреры:</b>
`;
          
          if (stats.topReferrers?.length > 0) {
            stats.topReferrers.forEach((ref: any, index: number) => {
              referralText += `${index + 1}. @${ref.username || 'Неизвестно'} - ${ref.referrals} реф.\n`;
            });
          } else {
            referralText += "Нет активных рефереров";
          }
          
          await sendMessage(chatId, referralText);
        } else {
          await sendMessage(chatId, `❌ Ошибка: ${result.error}`);
        }
      } catch (error) {
        await sendMessage(chatId, `❌ Ошибка получения статистики: ${error}`);
      }
      break;

    case 'admin_system':
      await sendMessage(chatId, "⚙️ Загрузка системных логов...");
      
      try {
        const response = await fetch(`${API_BASE_URL}/api/admin/system/logs`);
        const result = await response.json();
        
        if (result.success) {
          const logs = result.data.lastEvents || [];
          let logsText = "⚙️ <b>Системные события:</b>\n\n";
          
          if (logs.length === 0) {
            logsText += "ℹ️ Событий не найдено";
          } else {
            logs.forEach((log: any, index: number) => {
              logsText += `${index + 1}. ${log.event}\n`;
              logsText += `   ⏰ ${new Date(log.time).toLocaleString('ru-RU')}\n\n`;
            });
          }
          
          await sendMessage(chatId, logsText);
        } else {
          await sendMessage(chatId, `❌ Ошибка: ${result.error}`);
        }
      } catch (error) {
        await sendMessage(chatId, `❌ Ошибка получения логов: ${error}`);
      }
      break;

    default:
      await sendMessage(chatId, "❌ Неизвестная админская функция");
  }
}

/**
 * 🗄️ Обработка команд базы данных
 */
async function handleDatabaseAction(chatId: number, action: string, username: string, messageId?: number): Promise<void> {
  switch (action) {
    case 'admin_database':
      const dbMenuText = `
🗄️ <b>Управление базой данных</b>

Выберите операцию для работы с базой данных:
      `;
      
      if (messageId) {
        await editMessage(chatId, messageId, dbMenuText, {
          reply_markup: JSON.stringify(getDatabaseKeyboard())
        });
      }
      break;

    case 'db_reconnect':
      await sendMessage(chatId, "🔄 Переподключение к базе данных...");
      
      try {
        const response = await fetch(`${API_BASE_URL}/api/admin/db/reconnect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        const result = await response.json();
        
        if (result.success) {
          await sendMessage(chatId, `✅ ${result.message}`);
        } else {
          await sendMessage(chatId, `❌ Ошибка: ${result.error}`);
        }
      } catch (error) {
        await sendMessage(chatId, `❌ Ошибка переподключения: ${error}`);
      }
      break;

    case 'db_status':
      await sendMessage(chatId, "📊 Проверка состояния базы данных...");
      
      try {
        const response = await fetch(`${API_BASE_URL}/api/admin/db-status`);
        const result = await response.json();
        
        if (result.success) {
          const status = result.data;
          const statusText = `
🗄️ <b>Состояние базы данных</b>

📊 Статус: ${status.connected ? '✅ Подключена' : '❌ Отключена'}
🏃 Тип: ${status.type || 'PostgreSQL'}
📡 Хост: ${status.host || 'Скрыт'}
⏰ Время ответа: ${status.responseTime || 'N/A'}ms
          `;
          await sendMessage(chatId, statusText);
        } else {
          await sendMessage(chatId, `❌ Ошибка проверки: ${result.error}`);
        }
      } catch (error) {
        await sendMessage(chatId, `❌ Ошибка получения статуса: ${error}`);
      }
      break;

    case 'db_events':
      await sendMessage(chatId, "📋 Последние события базы данных...");
      
      try {
        const response = await fetch(`${API_BASE_URL}/api/admin/system/logs`);
        const result = await response.json();
        
        if (result.success) {
          const events = result.data.lastEvents || [];
          let eventsText = "📋 <b>Последние события:</b>\n\n";
          
          if (events.length === 0) {
            eventsText += "ℹ️ Событий не найдено";
          } else {
            events.forEach((event: any, index: number) => {
              eventsText += `${index + 1}. ${event.event}\n`;
              eventsText += `   ⏰ ${new Date(event.time).toLocaleString('ru-RU')}\n\n`;
            });
          }
          
          await sendMessage(chatId, eventsText);
        } else {
          await sendMessage(chatId, `❌ Ошибка получения событий: ${result.error}`);
        }
      } catch (error) {
        await sendMessage(chatId, `❌ Ошибка получения логов: ${error}`);
      }
      break;

    case 'db_events_detailed':
      try {
        const response = await fetch(`${API_BASE_URL}/api/db/events?admin_username=${username}&admin_key=${ADMIN_SECRET}`);
        const result = await response.json() as any;
        
        if (result.success && result.data.events) {
          const events = result.data.events.slice(0, 5);
          let eventsText = "📋 <b>Последние события БД:</b>\n\n";
          
          events.forEach((event: any, index: number) => {
            eventsText += `${index + 1}. <code>${event.timestamp}</code>\n`;
            eventsText += `   ${event.type}: ${event.message}\n\n`;
          });
          
          await sendMessage(chatId, eventsText);
        } else {
          await sendMessage(chatId, "❌ Не удалось получить события БД");
        }
      } catch (error) {
        await sendMessage(chatId, `❌ Ошибка получения событий: ${error}`);
      }
      break;

    case 'db_status_detailed':
      try {
        const response = await fetch(`${API_BASE_URL}/api/admin/db-status`);
        const result = await response.json() as any;
        
        if (result.success) {
          const status = result.data;
          const statusText = `
📊 <b>Статус подключения к БД</b>

🔗 <b>Подключение:</b> ${status.connected ? '✅ Активно' : '❌ Отключено'}
🏢 <b>База данных:</b> <code>${status.database}</code>
🌐 <b>Хост:</b> <code>${status.host}</code>
👤 <b>Пользователь:</b> <code>${status.user}</code>

⏰ <b>Проверено:</b> ${new Date().toLocaleString('ru-RU')}
          `;
          
          await sendMessage(chatId, statusText);
        } else {
          await sendMessage(chatId, "❌ Не удалось получить статус БД");
        }
      } catch (error) {
        await sendMessage(chatId, `❌ Ошибка получения статуса: ${error}`);
      }
      break;

    default:
      await sendMessage(chatId, "❌ Неизвестная команда БД");
  }
}

/**
 * 🚀 Главная функция обработки обновлений
 */
export async function handleSmartBotUpdate(update: TelegramUpdate): Promise<void> {
  try {
    if (update.message) {
      const message = update.message;
      const chatId = message.chat.id;
      const username = message.from.username;
      const text = message.text;

      logger.info(`[SmartBot] Сообщение от ${username || message.from.id}: ${text}`);

      // Обрабатываем команды
      if (text === '/start') {
        await sendMainMenu(chatId, username);
      } else if (text === '/adminka') {
        if (isAdmin(username)) {
          await sendAdminPanel(chatId);
        } else {
          await sendMessage(chatId, "⛔️ У вас нет доступа к админ-панели.");
        }
      } else if (text === '/help') {
        const helpText = `
ℹ️ <b>Помощь по UniFarm</b>

🌱 <b>Что такое UniFarm?</b>
UniFarm - это платформа для фарминга UNI токенов

🎯 <b>Основные функции:</b>
• Фарминг токенов
• Реферальная программа  
• Выполнение заданий
• Вывод средств

📱 Используйте кнопку "Открыть UniFarm" для доступа к приложению
        `;
        await sendMessage(chatId, helpText);
      } else {
        await sendMessage(chatId, "👋 Используйте /start для открытия главного меню");
      }
    }

    if (update.callback_query) {
      const query = update.callback_query;
      const chatId = query.message?.chat.id;
      const messageId = query.message?.message_id;
      const username = query.from.username;
      const data = query.data;

      if (!chatId || !messageId || !data) return;

      logger.info(`[SmartBot] Callback от ${username || query.from.id}: ${data}`);

      // Обрабатываем callback'и
      if (data === 'back_main') {
        await sendMainMenu(chatId, username, messageId);
      } else if (data === 'admin_panel') {
        if (isAdmin(username)) {
          await sendAdminPanel(chatId, messageId);
        } else {
          await sendMessage(chatId, "⛔️ У вас нет доступа к админ-панели.");
        }
      } else if (data.startsWith('admin_database') || data.startsWith('db_')) {
        if (isAdmin(username) && username) {
          await handleDatabaseAction(chatId, data, username, messageId);
        } else {
          await sendMessage(chatId, "⛔️ У вас нет доступа к этой функции.");
        }
      } else if (data === 'help') {
        const helpText = `
ℹ️ <b>Помощь по UniFarm</b>

🌱 UniFarm - платформа для фарминга UNI токенов
📱 Используйте кнопку "Открыть UniFarm" для доступа
🔗 Приглашайте друзей по реферальной ссылке
        `;
        await sendMessage(chatId, helpText);
      } else if (data === 'ref_code') {
        await sendMessage(chatId, "🔗 Получение реферального кода...\nЭта функция будет добавлена в ближайшее время!");
      } else if (data.startsWith('admin_') && isAdmin(username)) {
        // Обработка всех админских кнопок
        await handleAdminAction(chatId, data, username || '', messageId);
      } else {
        await sendMessage(chatId, "🚧 Функция в разработке");
      }

      // Отвечаем на callback query
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: query.id })
      });
    }
  } catch (error) {
    logger.error('[SmartBot] Ошибка обработки обновления:', error);
  }
}