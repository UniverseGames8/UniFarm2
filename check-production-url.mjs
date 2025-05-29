/**
 * Скрипт для проверки URL приложения и его соответствия настройкам бота
 * Проверяет текущий URL и сравнивает его с ожидаемым production URL
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

// Ожидаемый production URL
const EXPECTED_PRODUCTION_URL = 'https://uni-farm-connect-2-misterxuniverse.replit.app';
const EXPECTED_MINI_APP_URL = `${EXPECTED_PRODUCTION_URL}/UniFarm`;

// Telegram Bot Token из .env
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TELEGRAM_BOT_TOKEN) {
  console.error('❌ Ошибка: TELEGRAM_BOT_TOKEN не найден в переменных окружения');
  process.exit(1);
}

async function callTelegramApi(method, data = {}) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    return await response.json();
  } catch (error) {
    console.error(`❌ Ошибка при вызове API ${method}:`, error.message);
    return null;
  }
}

async function getCurrentHostname() {
  try {
    // Попытаемся определить текущий hostname из Replit
    const response = await fetch('https://replit.com/api/v1/repls/self', {
      headers: {
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.url || null;
    }
    
    return null;
  } catch (error) {
    console.error('Не удалось определить текущий hostname:', error.message);
    return null;
  }
}

async function getMenuButton() {
  const result = await callTelegramApi('getMyCommands');
  
  if (!result || !result.ok) {
    console.error('❌ Не удалось получить команды бота');
    return null;
  }
  
  return result.result;
}

async function getWebhookInfo() {
  const result = await callTelegramApi('getWebhookInfo');
  
  if (!result || !result.ok) {
    console.error('❌ Не удалось получить информацию о webhook');
    return null;
  }
  
  return result.result;
}

function printComparisonTable(currentUrl, expectedUrl, webhookUrl, menuButtonUrl) {
  console.log('\n========================================================');
  console.log('📋 СРАВНЕНИЕ URL НАСТРОЕК UniFarm');
  console.log('--------------------------------------------------------');
  console.log(`📌 Текущий URL: ${currentUrl || 'Не определен'}`);
  console.log(`🎯 Ожидаемый URL: ${expectedUrl}`);
  console.log(`🔗 URL в webhook: ${webhookUrl || 'Не настроен'}`);
  console.log(`🔘 URL в кнопке меню: ${menuButtonUrl || 'Не настроен'}`);
  console.log('--------------------------------------------------------');
  
  // Статус соответствия
  const webhookMatch = webhookUrl && webhookUrl.includes(expectedUrl);
  const menuMatch = menuButtonUrl && menuButtonUrl.includes(expectedUrl);
  
  console.log(`Webhook соответствует ожидаемому URL: ${webhookMatch ? '✅ Да' : '❌ Нет'}`);
  console.log(`Кнопка меню соответствует ожидаемому URL: ${menuMatch ? '✅ Да' : '❌ Нет'}`);
  console.log('========================================================\n');
  
  // Рекомендации
  if (!webhookMatch || !menuMatch) {
    console.log('🔧 РЕКОМЕНДАЦИИ:');
    console.log('--------------------------------------------------------');
    if (!webhookMatch) {
      console.log('1. Обновите webhook URL:');
      console.log('   node setup-telegram-webhook.js');
    }
    if (!menuMatch) {
      console.log(`${!webhookMatch ? '2' : '1'}. Обновите настройки кнопок и команд бота:`);
      console.log('   node setup-telegram-mini-app.js');
    }
    console.log('--------------------------------------------------------');
  } else {
    console.log('✅ Все настройки URL соответствуют ожидаемым. Дополнительные действия не требуются.');
  }
}

async function main() {
  console.log('🔍 Проверка URL настроек UniFarm...');
  
  // Получаем текущий hostname
  const currentHostname = await getCurrentHostname();
  
  // Получаем информацию о webhook
  const webhookInfo = await getWebhookInfo();
  const webhookUrl = webhookInfo ? webhookInfo.url : null;
  
  // Получаем информацию о кнопке меню
  const commands = await getMenuButton();
  let menuButtonUrl = null;
  
  if (commands && commands.length > 0) {
    // Ищем команду /app или /start с web_app
    const appCommand = commands.find(cmd => 
      (cmd.command === 'app' || cmd.command === 'start') && 
      cmd.description && 
      cmd.description.includes('UniFarm')
    );
    
    if (appCommand && appCommand.web_app_info) {
      menuButtonUrl = appCommand.web_app_info.url;
    }
  }
  
  // Выводим сравнительную таблицу
  printComparisonTable(
    currentHostname,
    EXPECTED_PRODUCTION_URL,
    webhookUrl,
    menuButtonUrl
  );
}

main().catch(error => {
  console.error('❌ Произошла ошибка при выполнении скрипта:', error);
  process.exit(1);
});