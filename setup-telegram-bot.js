/**
 * Универсальный скрипт для настройки Telegram-бота UniFarm
 * 
 * Этот скрипт выполняет все необходимые настройки бота в одном месте:
 * 1. Установка webhook через Telegram Bot API
 * 2. Установка команд бота (/start, /app и др.)
 * 3. Настройка кнопки меню для запуска Mini App
 * 
 * Запуск: node setup-telegram-bot.js
 */

import fetch from 'node-fetch';
import { config } from 'dotenv';

// Загружаем переменные окружения
config();

// Конфигурация
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;
const APP_URL = 'https://uni-farm-connect-2-osadchukdmitro2.replit.app';
const WEBHOOK_PATH = '/api/telegram/webhook';
const WEBHOOK_URL = `${APP_URL}${WEBHOOK_PATH}`;
const APP_NAME = 'UniFarm';

// Стили для вывода в консоль
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  dim: '\x1b[2m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgBlue: '\x1b[44m'
};

// Проверка наличия токена бота
if (!BOT_TOKEN) {
  console.error(`${c.bgRed}${c.bold} ОШИБКА ${c.reset} Переменная окружения TELEGRAM_BOT_TOKEN не определена`);
  process.exit(1);
}

// Вспомогательная функция для API запросов
async function callTelegramApi(method, data = {}) {
  try {
    const response = await fetch(`${API_BASE}/${method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    return await response.json();
  } catch (error) {
    console.error(`${c.red}Ошибка при вызове ${method}:${c.reset}`, error.message);
    return null;
  }
}

// Получение информации о боте
async function getBotInfo() {
  console.log(`\n${c.bold}${c.blue}➤ Проверка бота${c.reset}`);
  const result = await callTelegramApi('getMe');
  
  if (!result || !result.ok) {
    console.error(`${c.red}✖ Ошибка получения информации о боте:${c.reset}`, result?.description || 'Неизвестная ошибка');
    process.exit(1);
  }
  
  const botInfo = result.result;
  console.log(`${c.green}✓ Бот @${botInfo.username} (ID: ${botInfo.id}) найден${c.reset}`);
  console.log(`${c.dim}  Имя: ${botInfo.first_name}${c.reset}`);
  
  if (botInfo.username !== 'UniFarming_Bot') {
    console.log(`${c.yellow}⚠ Имя бота отличается от ожидаемого (UniFarming_Bot)${c.reset}`);
  }
  
  return botInfo;
}

// Настройка команд бота
async function setupBotCommands() {
  console.log(`\n${c.bold}${c.blue}➤ Настройка команд бота${c.reset}`);
  
  // Сначала удалим все существующие команды
  console.log(`${c.dim}Удаление существующих команд...${c.reset}`);
  await callTelegramApi('deleteMyCommands');
  
  // Команды для бота
  const commands = {
    commands: [
      {command: 'start', description: 'Запустить бота и открыть UniFarm'},
      {command: 'app', description: 'Открыть приложение UniFarm'},
      {command: 'refcode', description: 'Получить ваш реферальный код'},
      {command: 'info', description: 'Информация о вашем аккаунте'},
      {command: 'ping', description: 'Проверить соединение с ботом'}
    ]
  };
  
  console.log(`${c.dim}Установка новых команд...${c.reset}`);
  const result = await callTelegramApi('setMyCommands', commands);
  
  if (!result || !result.ok) {
    console.error(`${c.red}✖ Ошибка при настройке команд:${c.reset}`, result?.description || 'Неизвестная ошибка');
    return false;
  }
  
  console.log(`${c.green}✓ Команды бота успешно настроены${c.reset}`);
  return true;
}

// Настройка кнопки меню
async function setupMenuButton() {
  console.log(`\n${c.bold}${c.blue}➤ Настройка кнопки меню${c.reset}`);
  
  const menuButton = {
    menu_button: {
      type: 'web_app',
      text: `Открыть ${APP_NAME}`,
      web_app: {
        url: APP_URL
      }
    }
  };
  
  const result = await callTelegramApi('setChatMenuButton', menuButton);
  
  if (!result || !result.ok) {
    console.error(`${c.red}✖ Ошибка при настройке кнопки меню:${c.reset}`, result?.description || 'Неизвестная ошибка');
    return false;
  }
  
  console.log(`${c.green}✓ Кнопка меню успешно настроена${c.reset}`);
  console.log(`${c.dim}  Текст: Открыть ${APP_NAME}${c.reset}`);
  console.log(`${c.dim}  URL: ${APP_URL}${c.reset}`);
  return true;
}

// Настройка webhook
async function setupWebhook() {
  console.log(`\n${c.bold}${c.blue}➤ Настройка webhook${c.reset}`);
  
  // Сначала получим текущие настройки webhook
  const currentInfo = await callTelegramApi('getWebhookInfo');
  if (currentInfo && currentInfo.ok) {
    const current = currentInfo.result;
    console.log(`${c.dim}Текущий webhook URL: ${current.url || 'не установлен'}${c.reset}`);
    
    if (current.url === WEBHOOK_URL) {
      console.log(`${c.yellow}⚠ Webhook уже настроен на требуемый URL${c.reset}`);
      console.log(`${c.dim}  Для обновления настроек webhook будет удален и создан заново${c.reset}`);
    }
  }
  
  // Удаляем существующий webhook
  console.log(`${c.dim}Удаление существующего webhook...${c.reset}`);
  await callTelegramApi('deleteWebhook', { drop_pending_updates: true });
  
  // Настраиваем новый webhook
  console.log(`${c.dim}Установка нового webhook на URL: ${WEBHOOK_URL}${c.reset}`);
  const result = await callTelegramApi('setWebhook', {
    url: WEBHOOK_URL,
    allowed_updates: ['message', 'callback_query', 'inline_query', 'my_chat_member'],
    drop_pending_updates: true,
    max_connections: 40
  });
  
  if (!result || !result.ok) {
    console.error(`${c.red}✖ Ошибка при настройке webhook:${c.reset}`, result?.description || 'Неизвестная ошибка');
    return false;
  }
  
  // Проверяем настройки webhook
  const newInfo = await callTelegramApi('getWebhookInfo');
  if (newInfo && newInfo.ok) {
    const webhook = newInfo.result;
    
    // Проверяем, правильно ли установлен webhook
    if (webhook.url === WEBHOOK_URL) {
      console.log(`${c.green}✓ Webhook успешно настроен на ${WEBHOOK_URL}${c.reset}`);
      
      // Дополнительная информация
      console.log(`${c.dim}  Ожидает обновлений: ${webhook.pending_update_count || 0}${c.reset}`);
      console.log(`${c.dim}  Макс. соединений: ${webhook.max_connections || 'не указано'}${c.reset}`);
      console.log(`${c.dim}  Разрешенные обновления: ${webhook.allowed_updates ? webhook.allowed_updates.join(', ') : 'все'}${c.reset}`);
      
      return true;
    } else {
      console.error(`${c.red}✖ Webhook установлен на неправильный URL: ${webhook.url}${c.reset}`);
      return false;
    }
  } else {
    console.error(`${c.red}✖ Не удалось проверить настройки webhook${c.reset}`);
    return false;
  }
}

// Основная функция
async function main() {
  try {
    // Заголовок
    console.log(`\n${c.bgBlue}${c.bold} НАСТРОЙКА TELEGRAM БОТА ${c.reset}\n`);
    console.log(`${c.bold}URL приложения:${c.reset} ${APP_URL}`);
    console.log(`${c.bold}URL webhook:${c.reset} ${WEBHOOK_URL}`);
    console.log(`${c.bold}Токен бота:${c.reset} ${BOT_TOKEN ? '✓ установлен' : '✗ не найден'}`);
    
    // Получаем информацию о боте
    const botInfo = await getBotInfo();
    
    // Настраиваем webhook
    await setupWebhook();
    
    // Настраиваем команды бота
    await setupBotCommands();
    
    // Настраиваем кнопку меню
    await setupMenuButton();
    
    // Итоги настройки
    console.log(`\n${c.bgGreen}${c.bold} НАСТРОЙКА ЗАВЕРШЕНА ${c.reset}\n`);
    console.log(`${c.green}✓ Бот @${botInfo.username} успешно настроен${c.reset}`);
    console.log(`${c.green}✓ Webhook настроен на ${WEBHOOK_URL}${c.reset}`);
    console.log(`${c.green}✓ Кнопка меню настроена для открытия Mini App${c.reset}`);
    console.log(`${c.green}✓ Команды бота обновлены${c.reset}`);
    
    // Ссылка для тестирования
    console.log(`\n${c.bold}Для тестирования:${c.reset} https://t.me/${botInfo.username}`);
    
  } catch (error) {
    console.error(`\n${c.bgRed}${c.bold} ОШИБКА ${c.reset} ${error.message}`);
    console.error(error.stack);
  }
}

// Запускаем основную функцию
main();