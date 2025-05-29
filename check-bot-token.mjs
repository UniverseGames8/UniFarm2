/**
 * Скрипт для проверки токена Telegram бота
 */
import fetch from 'node-fetch';

// Получаем токен из переменной окружения
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Проверяем наличие токена
if (!BOT_TOKEN) {
  console.error('❌ Ошибка: TELEGRAM_BOT_TOKEN не найден в переменных окружения');
  process.exit(1);
}

console.log(`🔑 Проверка токена бота: ${BOT_TOKEN.substring(0, 10)}...`);

// Функция для проверки токена бота через API Telegram
async function checkBotToken() {
  try {
    console.log('🔍 Отправка запроса к Telegram API...');
    
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const result = await response.json();
    
    if (result.ok) {
      console.log('✅ Токен бота действителен! Информация о боте:');
      console.log(`   ID: ${result.result.id}`);
      console.log(`   Имя: ${result.result.first_name}`);
      console.log(`   Username: @${result.result.username}`);
      console.log(`   Поддерживает встраивание в чаты: ${result.result.can_join_groups ? 'Да' : 'Нет'}`);
      console.log(`   Поддерживает inline-режим: ${result.result.supports_inline_queries ? 'Да' : 'Нет'}`);
      return true;
    } else {
      console.error('❌ Ошибка при проверке токена бота:');
      console.error(`   Код ошибки: ${result.error_code}`);
      console.error(`   Описание: ${result.description}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Критическая ошибка при проверке токена бота:', error);
    return false;
  }
}

// Запускаем проверку
checkBotToken().then(isValid => {
  if (isValid) {
    console.log('✅ Токен бота корректен и готов к использованию');
  } else {
    console.error('❌ Токен бота недействителен или возникла ошибка при проверке');
    process.exit(1);
  }
}).catch(error => {
  console.error('❌ Непредвиденная ошибка:', error);
  process.exit(1);
});