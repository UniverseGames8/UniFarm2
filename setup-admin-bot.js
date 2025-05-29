/**
 * 🤖 Скрипт для настройки и тестирования админского бота UniFarm
 * 
 * Проверяет подключение, устанавливает webhook и тестирует основные функции
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

const ADMIN_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const APP_URL = process.env.NODE_ENV === 'production' 
  ? 'https://uni-farm-connect-x-lukyanenkolawfa.replit.app'
  : 'https://uni-farm-connect-x-lukyanenkolawfa.replit.app';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

/**
 * Проверяет информацию о боте
 */
async function checkBotInfo() {
  log('\n🤖 Проверка информации о боте...', colors.cyan);
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${ADMIN_BOT_TOKEN}/getMe`);
    const data = await response.json();
    
    if (data.ok) {
      log(`✅ Бот найден: @${data.result.username}`, colors.green);
      log(`📛 Имя: ${data.result.first_name}`, colors.blue);
      log(`🆔 ID: ${data.result.id}`, colors.blue);
      return true;
    } else {
      log(`❌ Ошибка получения информации о боте: ${data.description}`, colors.red);
      return false;
    }
  } catch (error) {
    log(`❌ Ошибка запроса: ${error.message}`, colors.red);
    return false;
  }
}

/**
 * Устанавливает webhook для админ-бота
 */
async function setupWebhook() {
  log('\n🔗 Установка webhook...', colors.cyan);
  
  const webhookUrl = `${APP_URL}/api/admin/webhook`;
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${ADMIN_BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query']
      })
    });
    
    const data = await response.json();
    
    if (data.ok) {
      log(`✅ Webhook установлен: ${webhookUrl}`, colors.green);
      return true;
    } else {
      log(`❌ Ошибка установки webhook: ${data.description}`, colors.red);
      return false;
    }
  } catch (error) {
    log(`❌ Ошибка запроса: ${error.message}`, colors.red);
    return false;
  }
}

/**
 * Проверяет статус webhook
 */
async function checkWebhook() {
  log('\n📋 Проверка статуса webhook...', colors.cyan);
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${ADMIN_BOT_TOKEN}/getWebhookInfo`);
    const data = await response.json();
    
    if (data.ok) {
      const info = data.result;
      log(`🔗 URL: ${info.url || 'Не установлен'}`, colors.blue);
      log(`✅ Активен: ${info.url ? 'Да' : 'Нет'}`, info.url ? colors.green : colors.red);
      log(`📅 Последнее обновление: ${info.last_error_date ? new Date(info.last_error_date * 1000).toLocaleString('ru-RU') : 'Нет ошибок'}`, colors.blue);
      
      if (info.last_error_message) {
        log(`⚠️ Последняя ошибка: ${info.last_error_message}`, colors.yellow);
      }
      
      return Boolean(info.url);
    } else {
      log(`❌ Ошибка получения информации о webhook: ${data.description}`, colors.red);
      return false;
    }
  } catch (error) {
    log(`❌ Ошибка запроса: ${error.message}`, colors.red);
    return false;
  }
}

/**
 * Устанавливает команды для бота
 */
async function setupCommands() {
  log('\n⚙️ Установка команд для бота...', colors.cyan);
  
  const commands = [
    {
      command: 'start',
      description: 'Открыть админ-панель UniFarm'
    },
    {
      command: 'menu',
      description: 'Показать главное меню'
    },
    {
      command: 'status',
      description: 'Статус системы'
    }
  ];
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${ADMIN_BOT_TOKEN}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands })
    });
    
    const data = await response.json();
    
    if (data.ok) {
      log(`✅ Команды установлены (${commands.length})`, colors.green);
      commands.forEach(cmd => {
        log(`   /${cmd.command} - ${cmd.description}`, colors.blue);
      });
      return true;
    } else {
      log(`❌ Ошибка установки команд: ${data.description}`, colors.red);
      return false;
    }
  } catch (error) {
    log(`❌ Ошибка запроса: ${error.message}`, colors.red);
    return false;
  }
}

/**
 * Проверяет доступность API сервера
 */
async function checkServerAPI() {
  log('\n🌐 Проверка API сервера...', colors.cyan);
  
  try {
    const response = await fetch(`${APP_URL}/api/health`);
    const data = await response.json();
    
    if (response.ok) {
      log(`✅ API сервера доступен`, colors.green);
      log(`📊 Статус: ${data.status || 'OK'}`, colors.blue);
      return true;
    } else {
      log(`❌ API сервера недоступен (${response.status})`, colors.red);
      return false;
    }
  } catch (error) {
    log(`❌ Ошибка подключения к серверу: ${error.message}`, colors.red);
    return false;
  }
}

/**
 * Тестирует админские API endpoints
 */
async function testAdminAPI() {
  log('\n🔐 Тестирование админских API...', colors.cyan);
  
  const testUsername = 'a888bnd'; // Ваш username
  const adminSecret = 'unifarm_admin_secret_2025';
  
  try {
    // Тест получения событий БД
    const eventsResponse = await fetch(`${APP_URL}/api/db/events?admin_username=${testUsername}&admin_key=${adminSecret}`);
    
    if (eventsResponse.ok) {
      log(`✅ Админские API доступны`, colors.green);
      const eventsData = await eventsResponse.json();
      log(`📋 События БД: ${eventsData.data?.events?.length || 0} записей`, colors.blue);
    } else {
      log(`⚠️ Админские API требуют настройки (${eventsResponse.status})`, colors.yellow);
    }
    
    return true;
  } catch (error) {
    log(`❌ Ошибка тестирования админских API: ${error.message}`, colors.red);
    return false;
  }
}

/**
 * Отправляет тестовое сообщение админам
 */
async function sendTestMessage() {
  log('\n📨 Отправка тестового сообщения...', colors.cyan);
  
  // ID чатов администраторов (нужно получить при первом запуске /start)
  const adminChatIds = []; // Пустой массив - нужно получить реальные ID
  
  if (adminChatIds.length === 0) {
    log(`⚠️ Не указаны ID чатов администраторов`, colors.yellow);
    log(`📝 Отправьте команду /start админскому боту для получения ID чата`, colors.blue);
    return false;
  }
  
  const message = `
🎛️ <b>Тест админ-панели UniFarm</b>

✅ Система настроена и готова к работе!
📅 Время: ${new Date().toLocaleString('ru-RU')}

Используйте /start для открытия панели управления.
  `;
  
  try {
    for (const chatId of adminChatIds) {
      const response = await fetch(`https://api.telegram.org/bot${ADMIN_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML'
        })
      });
      
      const data = await response.json();
      
      if (data.ok) {
        log(`✅ Сообщение отправлено в чат ${chatId}`, colors.green);
      } else {
        log(`❌ Ошибка отправки в чат ${chatId}: ${data.description}`, colors.red);
      }
    }
    
    return true;
  } catch (error) {
    log(`❌ Ошибка отправки сообщения: ${error.message}`, colors.red);
    return false;
  }
}

/**
 * Основная функция настройки
 */
async function main() {
  log('🚀 Настройка админского бота UniFarm', colors.cyan);
  log('=' * 50, colors.blue);
  
  if (!ADMIN_BOT_TOKEN) {
    log('❌ Не найден токен бота (TELEGRAM_BOT_TOKEN)', colors.red);
    log('📝 Добавьте токен в файл .env', colors.yellow);
    process.exit(1);
  }
  
  const results = [];
  
  // Проверяем бота
  results.push(await checkBotInfo());
  
  // Проверяем сервер
  results.push(await checkServerAPI());
  
  // Устанавливаем webhook
  results.push(await setupWebhook());
  
  // Проверяем webhook
  results.push(await checkWebhook());
  
  // Устанавливаем команды
  results.push(await setupCommands());
  
  // Тестируем API
  results.push(await testAdminAPI());
  
  // Отправляем тестовое сообщение
  results.push(await sendTestMessage());
  
  // Итоговый отчет
  log('\n📊 ИТОГОВЫЙ ОТЧЕТ', colors.cyan);
  log('=' * 30, colors.blue);
  
  const successCount = results.filter(Boolean).length;
  const totalCount = results.length;
  
  if (successCount === totalCount) {
    log(`🎉 Все проверки пройдены! (${successCount}/${totalCount})`, colors.green);
    log('✅ Админский бот готов к использованию', colors.green);
  } else {
    log(`⚠️ Выполнено: ${successCount}/${totalCount} проверок`, colors.yellow);
    log('🔧 Некоторые функции требуют дополнительной настройки', colors.yellow);
  }
  
  log('\n📱 Для использования отправьте команду /start админскому боту', colors.blue);
}

// Запускаем скрипт
main().catch(error => {
  log(`💥 Критическая ошибка: ${error.message}`, colors.red);
  process.exit(1);
});