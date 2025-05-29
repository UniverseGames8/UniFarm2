/**
 * 🤖 Современная административная панель UniFarm через Telegram бота
 * 
 * Удобный интерфейс с кнопками для всех административных функций:
 * - База данных и подключения
 * - Управление пользователями 
 * - Финансовые операции
 * - Системная аналитика
 * - Реферальная система
 */

import fetch from 'node-fetch';

// Константы для работы бота
const ADMIN_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const AUTHORIZED_ADMINS = ['DimaOsadchuk', 'a888bnd'];

// API URL для внутренних запросов
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://uni-farm-connect-x-lukyanenkolawfa.replit.app'
  : 'https://uni-farm-connect-x-lukyanenkolawfa.replit.app';

// Админский секретный ключ
const ADMIN_SECRET = 'unifarm_admin_secret_2025';

// Типы для Telegram API
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

interface TelegramUpdate {
  message?: TelegramMessage;
  callback_query?: {
    id: string;
    from: TelegramUser;
    message?: TelegramMessage;
    data?: string;
  };
}

/**
 * 🎯 ГЛАВНОЕ МЕНЮ АДМИН ПАНЕЛИ
 */
function getMainMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "🗄️ База данных", callback_data: "menu_database" },
        { text: "👥 Пользователи", callback_data: "menu_users" }
      ],
      [
        { text: "💰 Финансы", callback_data: "menu_finance" },
        { text: "📊 Аналитика", callback_data: "menu_analytics" }
      ],
      [
        { text: "🔗 Реферальная система", callback_data: "menu_referral" },
        { text: "⚙️ Система", callback_data: "menu_system" }
      ],
      [
        { text: "🔄 Обновить статус", callback_data: "refresh_status" }
      ]
    ]
  };
}

/**
 * 🗄️ МЕНЮ УПРАВЛЕНИЯ БАЗОЙ ДАННЫХ
 */
function getDatabaseMenuKeyboard() {
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
        { text: "📈 Статистика таблиц", callback_data: "db_tables_stats" },
        { text: "🔧 Проверка целостности", callback_data: "db_integrity" }
      ],
      [
        { text: "⬅️ Назад", callback_data: "back_main" }
      ]
    ]
  };
}

/**
 * 👥 МЕНЮ УПРАВЛЕНИЯ ПОЛЬЗОВАТЕЛЯМИ
 */
function getUsersMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "👤 Поиск пользователя", callback_data: "user_search" },
        { text: "📊 Статистика пользователей", callback_data: "user_stats" }
      ],
      [
        { text: "🆕 Новые регистрации", callback_data: "user_new" },
        { text: "🔥 Активные пользователи", callback_data: "user_active" }
      ],
      [
        { text: "💰 Топ по балансу", callback_data: "user_top_balance" },
        { text: "🎯 Топ по рефералам", callback_data: "user_top_referrals" }
      ],
      [
        { text: "⬅️ Назад", callback_data: "back_main" }
      ]
    ]
  };
}

/**
 * 💰 МЕНЮ ФИНАНСОВЫХ ОПЕРАЦИЙ
 */
function getFinanceMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "📤 Заявки на вывод", callback_data: "finance_withdrawals" },
        { text: "📥 Депозиты", callback_data: "finance_deposits" }
      ],
      [
        { text: "💎 Добавить UNI", callback_data: "finance_add_uni" },
        { text: "📊 Общий баланс", callback_data: "finance_total_balance" }
      ],
      [
        { text: "🔄 Транзакции", callback_data: "finance_transactions" },
        { text: "📈 Статистика доходов", callback_data: "finance_revenue" }
      ],
      [
        { text: "⬅️ Назад", callback_data: "back_main" }
      ]
    ]
  };
}

/**
 * 📊 МЕНЮ АНАЛИТИКИ
 */
function getAnalyticsMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "📈 Общая статистика", callback_data: "analytics_general" },
        { text: "👥 Активность пользователей", callback_data: "analytics_user_activity" }
      ],
      [
        { text: "💰 Финансовые показатели", callback_data: "analytics_financial" },
        { text: "🔗 Реферальная активность", callback_data: "analytics_referral" }
      ],
      [
        { text: "📊 Еженедельный отчет", callback_data: "analytics_weekly" },
        { text: "📅 Месячный отчет", callback_data: "analytics_monthly" }
      ],
      [
        { text: "⬅️ Назад", callback_data: "back_main" }
      ]
    ]
  };
}

/**
 * 🔗 МЕНЮ РЕФЕРАЛЬНОЙ СИСТЕМЫ
 */
function getReferralMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "📊 Статистика рефералов", callback_data: "ref_stats" },
        { text: "🌳 Реферальное дерево", callback_data: "ref_tree" }
      ],
      [
        { text: "🏆 Топ рефереров", callback_data: "ref_top" },
        { text: "💰 Реферальные награды", callback_data: "ref_rewards" }
      ],
      [
        { text: "🔧 Генерация кода", callback_data: "ref_generate" },
        { text: "🔍 Поиск по коду", callback_data: "ref_search" }
      ],
      [
        { text: "⬅️ Назад", callback_data: "back_main" }
      ]
    ]
  };
}

/**
 * ⚙️ МЕНЮ СИСТЕМНЫХ ОПЕРАЦИЙ
 */
function getSystemMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "🔄 Перезапуск сервера", callback_data: "system_restart" },
        { text: "📋 Логи системы", callback_data: "system_logs" }
      ],
      [
        { text: "🧪 Тест API", callback_data: "system_test_api" },
        { text: "🤖 Статус бота", callback_data: "system_bot_status" }
      ],
      [
        { text: "📊 Мониторинг", callback_data: "system_monitoring" },
        { text: "🛡️ Безопасность", callback_data: "system_security" }
      ],
      [
        { text: "⬅️ Назад", callback_data: "back_main" }
      ]
    ]
  };
}

/**
 * 📨 Отправка сообщения через Telegram API
 */
async function sendMessage(chatId: number, text: string, options: any = {}): Promise<void> {
  try {
    const url = `https://api.telegram.org/bot${ADMIN_BOT_TOKEN}/sendMessage`;
    
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
      console.error(`[AdminBot] Ошибка отправки сообщения: ${response.statusText}`);
    }
  } catch (error) {
    console.error('[AdminBot] Ошибка при отправке сообщения:', error);
  }
}

/**
 * ✏️ Редактирование сообщения
 */
async function editMessage(chatId: number, messageId: number, text: string, options: any = {}): Promise<void> {
  try {
    const url = `https://api.telegram.org/bot${ADMIN_BOT_TOKEN}/editMessageText`;
    
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
      console.error(`[AdminBot] Ошибка редактирования сообщения: ${response.statusText}`);
    }
  } catch (error) {
    console.error('[AdminBot] Ошибка при редактировании сообщения:', error);
  }
}

/**
 * 🔐 Проверка авторизации администратора
 */
function isAuthorizedAdmin(username?: string): boolean {
  return username ? AUTHORIZED_ADMINS.includes(username) : false;
}

/**
 * 🏠 Отправка главного меню
 */
async function sendMainMenu(chatId: number, messageId?: number): Promise<void> {
  const welcomeText = `
🎛️ <b>Админ-панель UniFarm</b>

Добро пожаловать в центр управления платформой!
Выберите нужный раздел для работы:

<i>💡 Все действия логируются для безопасности</i>
  `;

  if (messageId) {
    await editMessage(chatId, messageId, welcomeText, {
      reply_markup: JSON.stringify(getMainMenuKeyboard())
    });
  } else {
    await sendMessage(chatId, welcomeText, {
      reply_markup: JSON.stringify(getMainMenuKeyboard())
    });
  }
}

/**
 * 🗄️ Обработка команд базы данных
 */
async function handleDatabaseAction(chatId: number, action: string, messageId?: number, username?: string): Promise<void> {
  if (!username) {
    await sendMessage(chatId, "❌ Ошибка: не удалось определить username");
    return;
  }

  switch (action) {
    case 'menu_database':
      const dbMenuText = `
🗄️ <b>Управление базой данных</b>

Выберите операцию для работы с базой данных:
      `;
      
      if (messageId) {
        await editMessage(chatId, messageId, dbMenuText, {
          reply_markup: JSON.stringify(getDatabaseMenuKeyboard())
        });
      }
      break;

    case 'db_reconnect':
      await sendMessage(chatId, "🔄 Переподключение к базе данных...");
      
      try {
        const response = await fetch(`${API_BASE_URL}/api/db/reconnect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            admin_username: username,
            admin_key: ADMIN_SECRET
          })
        });

        const result = await response.json();
        
        if (result.success) {
          await sendMessage(chatId, `✅ База данных успешно переподключена!\n\n${result.data.message || ''}`);
        } else {
          await sendMessage(chatId, `❌ Ошибка переподключения: ${result.error}`);
        }
      } catch (error) {
        await sendMessage(chatId, `❌ Ошибка запроса: ${error}`);
      }
      break;

    case 'db_events':
      try {
        const response = await fetch(`${API_BASE_URL}/api/db/events?admin_username=${username}&admin_key=${ADMIN_SECRET}`);
        const result = await response.json();
        
        if (result.success && result.data.events) {
          const events = result.data.events.slice(0, 10); // Последние 10 событий
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

    case 'db_status':
      try {
        const response = await fetch(`${API_BASE_URL}/api/admin/db-status`);
        const result = await response.json();
        
        if (result.success) {
          const status = result.data;
          const statusText = `
📊 <b>Статус подключения к БД</b>

🔗 <b>Подключение:</b> ${status.connected ? '✅ Активно' : '❌ Отключено'}
🏢 <b>База данных:</b> <code>${status.database}</code>
🌐 <b>Хост:</b> <code>${status.host}</code>
👤 <b>Пользователь:</b> <code>${status.user}</code>
⚡ <b>Пул соединений:</b> ${status.poolSize || 'N/A'}

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
 * 👥 Обработка команд пользователей
 */
async function handleUsersAction(chatId: number, action: string, messageId?: number): Promise<void> {
  switch (action) {
    case 'menu_users':
      const usersMenuText = `
👥 <b>Управление пользователями</b>

Выберите операцию для работы с пользователями:
      `;
      
      if (messageId) {
        await editMessage(chatId, messageId, usersMenuText, {
          reply_markup: JSON.stringify(getUsersMenuKeyboard())
        });
      }
      break;

    case 'user_stats':
      try {
        const response = await fetch(`${API_BASE_URL}/api/users/stats`);
        const result = await response.json();
        
        if (result.success) {
          const stats = result.data;
          const statsText = `
📊 <b>Статистика пользователей</b>

👥 <b>Всего пользователей:</b> ${stats.total || 0}
🆕 <b>Новых за сегодня:</b> ${stats.todayNew || 0}
🔥 <b>Активных за 24ч:</b> ${stats.active24h || 0}
💰 <b>С балансом > 0:</b> ${stats.withBalance || 0}

⏰ <b>Обновлено:</b> ${new Date().toLocaleString('ru-RU')}
          `;
          
          await sendMessage(chatId, statsText);
        } else {
          await sendMessage(chatId, "❌ Не удалось получить статистику пользователей");
        }
      } catch (error) {
        await sendMessage(chatId, `❌ Ошибка получения статистики: ${error}`);
      }
      break;

    default:
      await sendMessage(chatId, "❌ Функция пользователей в разработке");
  }
}

/**
 * 💰 Обработка финансовых команд
 */
async function handleFinanceAction(chatId: number, action: string, messageId?: number): Promise<void> {
  switch (action) {
    case 'menu_finance':
      const financeMenuText = `
💰 <b>Финансовые операции</b>

Управление финансами платформы:
      `;
      
      if (messageId) {
        await editMessage(chatId, messageId, financeMenuText, {
          reply_markup: JSON.stringify(getFinanceMenuKeyboard())
        });
      }
      break;

    case 'finance_withdrawals':
      try {
        const response = await fetch(`${API_BASE_URL}/api/finance/withdrawals`);
        const result = await response.json();
        
        if (result.success) {
          const withdrawals = result.data.slice(0, 5); // Последние 5 заявок
          let withdrawText = "📤 <b>Заявки на вывод:</b>\n\n";
          
          if (withdrawals.length === 0) {
            withdrawText += "✅ Новых заявок нет";
          } else {
            withdrawals.forEach((w: any, index: number) => {
              withdrawText += `${index + 1}. 👤 ID: ${w.userId}\n`;
              withdrawText += `   💰 Сумма: ${w.amount} UNI\n`;
              withdrawText += `   📅 Дата: ${new Date(w.created_at).toLocaleString('ru-RU')}\n\n`;
            });
          }
          
          await sendMessage(chatId, withdrawText);
        } else {
          await sendMessage(chatId, "❌ Не удалось получить заявки на вывод");
        }
      } catch (error) {
        await sendMessage(chatId, `❌ Ошибка получения заявок: ${error}`);
      }
      break;

    default:
      await sendMessage(chatId, "❌ Финансовая функция в разработке");
  }
}

/**
 * 🚀 Главная функция обработки обновлений
 */
async function handleUpdate(update: TelegramUpdate): Promise<void> {
  try {
    if (update.message) {
      const message = update.message;
      const chatId = message.chat.id;
      const username = message.from.username;
      const text = message.text;

      console.log(`[AdminBot] Сообщение от ${username || message.from.id}: ${text}`);

      // Проверяем авторизацию
      if (!isAuthorizedAdmin(username)) {
        await sendMessage(chatId, `
⛔️ <b>Доступ запрещен</b>

Вы не авторизованы как администратор UniFarm.
Обратитесь к разработчикам для получения доступа.
        `);
        return;
      }

      // Обрабатываем команды
      if (text === '/start' || text === '/menu') {
        await sendMainMenu(chatId);
      } else {
        await sendMessage(chatId, "Используйте /start для открытия главного меню");
      }
    }

    if (update.callback_query) {
      const query = update.callback_query;
      const chatId = query.message?.chat.id;
      const messageId = query.message?.message_id;
      const username = query.from.username;
      const data = query.data;

      if (!chatId || !messageId || !data) return;

      console.log(`[AdminBot] Callback от ${username || query.from.id}: ${data}`);

      // Проверяем авторизацию
      if (!isAuthorizedAdmin(username)) {
        await sendMessage(chatId, "⛔️ Доступ запрещен");
        return;
      }

      // Обрабатываем callback'и
      if (data === 'back_main') {
        await sendMainMenu(chatId, messageId);
      } else if (data.startsWith('menu_database') || data.startsWith('db_')) {
        await handleDatabaseAction(chatId, data, messageId, username);
      } else if (data.startsWith('menu_users') || data.startsWith('user_')) {
        await handleUsersAction(chatId, data, messageId);
      } else if (data.startsWith('menu_finance') || data.startsWith('finance_')) {
        await handleFinanceAction(chatId, data, messageId);
      } else if (data === 'refresh_status') {
        await sendMainMenu(chatId, messageId);
      } else {
        await sendMessage(chatId, "🚧 Функция в разработке");
      }

      // Отвечаем на callback query
      await fetch(`https://api.telegram.org/bot${ADMIN_BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: query.id })
      });
    }
  } catch (error) {
    console.error('[AdminBot] Ошибка обработки обновления:', error);
  }
}

/**
 * ⚙️ Установка webhook для админ-бота
 */
export async function setAdminBotWebhook(baseUrl: string): Promise<boolean> {
  if (!ADMIN_BOT_TOKEN) {
    console.error('[AdminBot] Токен бота не найден');
    return false;
  }

  try {
    const webhookUrl = `${baseUrl}/api/admin/webhook`;
    
    const response = await fetch(`https://api.telegram.org/bot${ADMIN_BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl })
    });

    const data = await response.json();
    if (data.ok) {
      console.log(`[AdminBot] ✅ Webhook установлен: ${webhookUrl}`);
      return true;
    } else {
      console.error(`[AdminBot] ❌ Ошибка установки webhook: ${data.description}`);
      return false;
    }
  } catch (error) {
    console.error('[AdminBot] Ошибка при установке webhook:', error);
    return false;
  }
}

// Экспорт основных функций
export {
  handleUpdate,
  sendMessage,
  isAuthorizedAdmin,
  sendMainMenu
};