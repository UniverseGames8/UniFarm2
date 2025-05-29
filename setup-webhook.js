/**
 * Скрипт для принудительной настройки Telegram вебхука
 * на URL https://uni-farm-connect-x-lukyanenkolawfa.replit.app
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

// Токен бота из переменных окружения
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Целевой URL приложения
const TARGET_URL = 'https://uni-farm-connect-x-lukyanenkolawfa.replit.app';
const WEBHOOK_PATH = '/api/telegram/webhook';
const WEBHOOK_URL = `${TARGET_URL}${WEBHOOK_PATH}`;

// Проверка наличия токена
if (!BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN не найден в переменных окружения!');
  process.exit(1);
}

/**
 * Вызывает метод Telegram API
 */
async function callTelegramApi(method, data = {}) {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
    
    // Подготавливаем параметры
    const params = new URLSearchParams();
    for (const key in data) {
      params.append(key, data[key]);
    }
    
    // Выполняем запрос
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });
    
    // Обрабатываем ответ
    const result = await response.json();
    
    if (!result.ok) {
      console.error(`Ошибка в API (${method}): ${result.description}`);
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
 * Получает информацию о текущем вебхуке
 */
async function getWebhookInfo() {
  console.log('Получение информации о вебхуке...');
  return await callTelegramApi('getWebhookInfo');
}

/**
 * Удаляет текущий вебхук
 */
async function deleteWebhook() {
  console.log('Удаление текущего вебхука...');
  return await callTelegramApi('deleteWebhook');
}

/**
 * Устанавливает новый вебхук
 */
async function setWebhook() {
  console.log(`Установка вебхука на ${WEBHOOK_URL}...`);
  return await callTelegramApi('setWebhook', {
    url: WEBHOOK_URL,
    allowed_updates: JSON.stringify(['message', 'callback_query']),
    drop_pending_updates: true
  });
}

/**
 * Устанавливает команды бота
 */
async function setCommands() {
  console.log('Настройка команд бота...');
  
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
 * Устанавливает кнопку меню с Mini App
 */
async function setMenuButton() {
  console.log('Настройка кнопки меню...');
  
  // Використовуємо актуальний метод setChatMenuButton
  const params = {
    menu_button: JSON.stringify({
      type: 'web_app',
      text: 'Открыть UniFarm',
      web_app: { url: TARGET_URL }
    })
  };
  
  return await callTelegramApi('setChatMenuButton', params);
}

/**
 * Основная функция
 */
async function main() {
  console.log('=== ПРИНУДИТЕЛЬНАЯ НАСТРОЙКА TELEGRAM ВЕБХУКА ===');
  console.log(`Целевой URL: ${TARGET_URL}`);
  console.log(`Путь вебхука: ${WEBHOOK_PATH}`);
  console.log(`Полный URL вебхука: ${WEBHOOK_URL}`);
  console.log('==========================================');
  
  try {
    // Получаем информацию о боте
    const botInfo = await getBotInfo();
    if (!botInfo) {
      console.error('Не удалось получить информацию о боте.');
      return;
    }
    
    console.log(`Бот: @${botInfo.username} (${botInfo.first_name})`);
    
    // Получаем текущий вебхук
    const webhookInfo = await getWebhookInfo();
    if (webhookInfo) {
      console.log('Текущий вебхук URL:', webhookInfo.url || 'не установлен');
      console.log('Последняя ошибка:', webhookInfo.last_error_message || 'нет');
      
      // Удаляем текущий вебхук
      await deleteWebhook();
      console.log('Текущий вебхук удален');
    }
    
    // Устанавливаем новый вебхук
    const webhookResult = await setWebhook();
    if (webhookResult) {
      console.log('✓ Вебхук успешно установлен');
    } else {
      console.error('✗ Не удалось установить вебхук');
    }
    
    // Устанавливаем команды бота
    const commandsResult = await setCommands();
    if (commandsResult) {
      console.log('✓ Команды бота установлены');
    } else {
      console.error('✗ Не удалось установить команды бота');
    }
    
    // Устанавливаем кнопку меню
    const menuResult = await setMenuButton();
    if (menuResult) {
      console.log('✓ Кнопка меню установлена');
    } else {
      console.error('✗ Не удалось установить кнопку меню');
    }
    
    // Проверяем итоговый результат
    const finalWebhookInfo = await getWebhookInfo();
    if (finalWebhookInfo) {
      console.log('\nИтоговый результат:');
      console.log('Вебхук URL:', finalWebhookInfo.url);
      console.log('Ожидающие обновления:', finalWebhookInfo.pending_update_count);
      console.log('Последняя ошибка:', finalWebhookInfo.last_error_message || 'нет');
      
      if (finalWebhookInfo.url === WEBHOOK_URL) {
        console.log('\n✅ УСПЕШНО: Вебхук установлен на целевой URL');
      } else {
        console.error('\n❌ ОШИБКА: Вебхук не соответствует целевому URL');
      }
    }
  } catch (error) {
    console.error('Произошла ошибка:', error);
  }
}

// Запускаем основную функцию
main();