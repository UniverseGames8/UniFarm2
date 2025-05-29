/**
 * Скрипт для настройки Telegram бота и вебхука
 * 
 * Используется для ручного запуска настройки бота и вебхука
 * с целевым URL для Mini App и вебхука.
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Загружаем переменные окружения
dotenv.config();

// Получаем директорию скрипта
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Целевой URL приложения
const TARGET_APP_URL = 'https://uni-farm-connect-x-lukyanenkolawfa.replit.app';
const WEBHOOK_PATH = '/api/telegram/webhook';

// Токен бота из переменных окружения
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Проверяем наличие токена
if (!BOT_TOKEN) {
  console.error('Ошибка: TELEGRAM_BOT_TOKEN не найден в переменных окружения');
  process.exit(1);
}

/**
 * Вызывает метод Telegram Bot API
 */
async function callTelegramApi(method, data = {}) {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
    
    // Преобразуем объект в FormData
    const params = new URLSearchParams();
    Object.keys(data).forEach(key => {
      params.append(key, data[key]);
    });
    
    // Отправляем запрос
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params
    });
    
    // Обрабатываем ответ
    const result = await response.json();
    
    if (!result.ok) {
      console.error(`Ошибка API (${method}):`, result.description);
      return null;
    }
    
    return result.result;
  } catch (error) {
    console.error(`Ошибка при вызове API (${method}):`, error.message);
    return null;
  }
}

/**
 * Получает информацию о боте
 */
async function getBotInfo() {
  console.log('Получение информации о боте...');
  return await callTelegramApi('getMe');
}

/**
 * Устанавливает команды бота
 */
async function setCommands() {
  console.log('Установка команд бота...');
  
  const commands = [
    { command: 'start', description: 'Начать использовать UniFarm' },
    { command: 'help', description: 'Помощь по использованию' },
    { command: 'deposit', description: 'Внести депозит' },
    { command: 'withdraw', description: 'Вывести средства' },
    { command: 'referral', description: 'Реферальная программа' }
  ];
  
  return await callTelegramApi('setMyCommands', {
    commands: JSON.stringify(commands)
  });
}

/**
 * Устанавливает кнопку меню с WebApp
 */
async function setMenuButton() {
  console.log('Установка кнопки меню...');
  
  const menuButton = {
    menu_button: JSON.stringify({
      type: 'web_app',
      text: 'Открыть UniFarm',
      web_app: { url: TARGET_APP_URL }
    })
  };
  
  return await callTelegramApi('setMenuButton', menuButton);
}

/**
 * Устанавливает вебхук
 */
async function setWebhook() {
  console.log('Установка вебхука...');
  
  const webhookUrl = `${TARGET_APP_URL}${WEBHOOK_PATH}`;
  
  return await callTelegramApi('setWebhook', {
    url: webhookUrl,
    allowed_updates: JSON.stringify(['message', 'callback_query'])
  });
}

/**
 * Получает информацию о текущем вебхуке
 */
async function getWebhookInfo() {
  console.log('Получение информации о вебхуке...');
  return await callTelegramApi('getWebhookInfo');
}

/**
 * Запускает полную настройку бота
 */
async function setupBot() {
  console.log('\n🤖 Запуск настройки Telegram бота');
  console.log('==============================\n');
  
  // Получаем информацию о боте
  const botInfo = await getBotInfo();
  if (!botInfo) {
    console.error('❌ Невозможно получить информацию о боте. Проверьте токен.');
    return false;
  }
  
  console.log(`✅ Бот @${botInfo.username} (${botInfo.first_name}) успешно подключен`);
  
  // Устанавливаем команды
  const commands = await setCommands();
  if (commands) {
    console.log('✅ Команды бота успешно установлены');
  } else {
    console.warn('⚠️ Не удалось установить команды бота');
  }
  
  // Устанавливаем кнопку меню
  const menuButton = await setMenuButton();
  if (menuButton) {
    console.log(`✅ Кнопка меню успешно установлена для URL: ${TARGET_APP_URL}`);
  } else {
    console.warn('⚠️ Не удалось установить кнопку меню');
  }
  
  // Устанавливаем вебхук
  const webhook = await setWebhook();
  if (webhook) {
    console.log(`✅ Вебхук успешно установлен на: ${TARGET_APP_URL}${WEBHOOK_PATH}`);
  } else {
    console.warn('⚠️ Не удалось установить вебхук');
  }
  
  // Получаем итоговую информацию о вебхуке
  const webhookInfo = await getWebhookInfo();
  if (webhookInfo) {
    console.log('\n📡 Информация о вебхуке:');
    console.log('URL:', webhookInfo.url);
    console.log('Ожидающие обновления:', webhookInfo.pending_update_count);
    console.log('Последняя ошибка:', webhookInfo.last_error_message || 'нет');
    console.log('Разрешенные обновления:', webhookInfo.allowed_updates?.join(', ') || 'все');
  }
  
  console.log('\n✅ Настройка бота завершена!');
  return true;
}

// Запускаем настройку
setupBot().catch(error => {
  console.error('❌ Ошибка при настройке бота:', error);
  process.exit(1);
});