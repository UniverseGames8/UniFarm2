/**
 * Скрипт для обновления URL кнопки меню бота на текущий URL разработки
 */

import * as dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

async function callTelegramApi(method, data = {}) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error('❌ Отсутствует токен бота в переменных окружения');
    process.exit(1);
  }

  const url = `https://api.telegram.org/bot${botToken}/${method}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  return response.json();
}

async function getCurrentDevelopmentUrl() {
  // Проверяем, был ли передан URL через переменную окружения
  if (process.env.DEPLOY_URL) {
    return process.env.DEPLOY_URL;
  }
  
  // Формируем URL на основе Replit данных
  const protocol = 'https://';
  // После деплоя URL становится {slug}-{owner}.replit.app
  const baseUrl = process.env.REPL_SLUG + '-' + process.env.REPL_OWNER + '.replit.app';
  return protocol + baseUrl;
}

async function updateMenuButton() {
  console.log('\n📱 Обновление URL кнопки меню бота\n');

  // Получаем текущий URL разработки
  const devUrl = await getCurrentDevelopmentUrl();
  console.log(`➤ Текущий URL разработки: ${devUrl}`);

  // Конфигурируем кнопку меню
  const menuButton = {
    type: 'web_app',
    text: 'Открыть UniFarm',
    web_app: {
      url: devUrl,
    },
  };

  console.log(`➤ Обновляем URL кнопки меню на: ${devUrl}`);
  
  // Устанавливаем кнопку меню
  const result = await callTelegramApi('setChatMenuButton', {
    menu_button: menuButton,
  });

  if (result.ok) {
    console.log('✅ Кнопка меню успешно обновлена');
  } else {
    console.error(`❌ Ошибка при обновлении кнопки меню: ${result.description}`);
    process.exit(1);
  }

  console.log('\n✅ Обновление URL завершено\n');
}

updateMenuButton().catch(error => {
  console.error('❌ Произошла ошибка:', error);
  process.exit(1);
});