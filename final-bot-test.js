/**
 * 🎯 Финальная проверка умного бота с админ-панелью
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const APP_URL = 'https://uni-farm-connect-x-lukyanenkolawfa.replit.app';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

/**
 * Отправляет тестовое сообщение /start от админа
 */
async function testAdminStartCommand() {
  log('\n🧪 Тестирование команды /start от администратора...', colors.cyan);
  
  const testUpdate = {
    update_id: Date.now(),
    message: {
      message_id: 1,
      from: {
        id: 123456789,
        first_name: "Test Admin",
        username: "a888bnd"  // Ваш admin username
      },
      chat: {
        id: 123456789
      },
      date: Math.floor(Date.now() / 1000),
      text: "/start"
    }
  };
  
  try {
    const response = await fetch(`${APP_URL}/api/telegram/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUpdate)
    });
    
    if (response.ok) {
      log(`✅ Команда /start обработана (${response.status})`, colors.green);
      return true;
    } else {
      log(`❌ Ошибка обработки: ${response.status}`, colors.red);
      return false;
    }
  } catch (error) {
    log(`❌ Ошибка отправки: ${error.message}`, colors.red);
    return false;
  }
}

/**
 * Отправляет тестовое сообщение /adminka
 */
async function testAdminkaCommand() {
  log('\n🔧 Тестирование команды /adminka...', colors.cyan);
  
  const testUpdate = {
    update_id: Date.now() + 1,
    message: {
      message_id: 2,
      from: {
        id: 123456789,
        first_name: "Test Admin",
        username: "a888bnd"
      },
      chat: {
        id: 123456789
      },
      date: Math.floor(Date.now() / 1000),
      text: "/adminka"
    }
  };
  
  try {
    const response = await fetch(`${APP_URL}/api/telegram/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUpdate)
    });
    
    if (response.ok) {
      log(`✅ Команда /adminka обработана (${response.status})`, colors.green);
      return true;
    } else {
      log(`❌ Ошибка обработки: ${response.status}`, colors.red);
      return false;
    }
  } catch (error) {
    log(`❌ Ошибка отправки: ${error.message}`, colors.red);
    return false;
  }
}

/**
 * Тестирует команду от обычного пользователя
 */
async function testRegularUserCommand() {
  log('\n👤 Тестирование команды /start от обычного пользователя...', colors.cyan);
  
  const testUpdate = {
    update_id: Date.now() + 2,
    message: {
      message_id: 3,
      from: {
        id: 987654321,
        first_name: "Regular User",
        username: "regular_user"
      },
      chat: {
        id: 987654321
      },
      date: Math.floor(Date.now() / 1000),
      text: "/start"
    }
  };
  
  try {
    const response = await fetch(`${APP_URL}/api/telegram/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUpdate)
    });
    
    if (response.ok) {
      log(`✅ Команда /start от пользователя обработана (${response.status})`, colors.green);
      return true;
    } else {
      log(`❌ Ошибка обработки: ${response.status}`, colors.red);
      return false;
    }
  } catch (error) {
    log(`❌ Ошибка отправки: ${error.message}`, colors.red);
    return false;
  }
}

/**
 * Проверяет webhook и команды
 */
async function checkBotSetup() {
  log('\n📋 Проверка настроек бота...', colors.cyan);
  
  try {
    // Проверяем команды
    const commandsResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMyCommands`);
    const commandsData = await commandsResponse.json();
    
    if (commandsData.ok) {
      log(`✅ Команды бота: ${commandsData.result.length}`, colors.green);
      commandsData.result.forEach(cmd => {
        log(`   /${cmd.command} - ${cmd.description}`, colors.blue);
      });
    }
    
    // Проверяем webhook
    const webhookResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
    const webhookData = await webhookResponse.json();
    
    if (webhookData.ok) {
      const info = webhookData.result;
      log(`🔗 Webhook URL: ${info.url}`, colors.blue);
      log(`✅ Активен: ${info.url ? 'Да' : 'Нет'}`, info.url ? colors.green : colors.red);
      
      if (info.last_error_message) {
        log(`⚠️ Последняя ошибка: ${info.last_error_message}`, colors.yellow);
      }
    }
    
    return true;
  } catch (error) {
    log(`❌ Ошибка проверки: ${error.message}`, colors.red);
    return false;
  }
}

/**
 * Сбрасывает webhook заново
 */
async function resetWebhook() {
  log('\n🔄 Принудительный сброс webhook...', colors.yellow);
  
  try {
    // Удаляем
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`, {
      method: 'POST'
    });
    
    // Ждем
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Устанавливаем заново
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: `${APP_URL}/api/telegram/webhook`,
        allowed_updates: ['message', 'callback_query']
      })
    });
    
    const data = await response.json();
    
    if (data.ok) {
      log('✅ Webhook переустановлен', colors.green);
      return true;
    } else {
      log(`❌ Ошибка: ${data.description}`, colors.red);
      return false;
    }
  } catch (error) {
    log(`❌ Ошибка сброса: ${error.message}`, colors.red);
    return false;
  }
}

/**
 * Основная функция
 */
async function main() {
  log('🎯 ФИНАЛЬНАЯ ПРОВЕРКА УМНОГО БОТА', colors.magenta);
  log('=' * 50, colors.blue);
  
  if (!BOT_TOKEN) {
    log('❌ Токен бота не найден', colors.red);
    process.exit(1);
  }
  
  // Проверяем настройки
  await checkBotSetup();
  
  // Сбрасываем webhook
  await resetWebhook();
  
  // Ждем немного
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Тестируем команды
  const results = [];
  results.push(await testAdminStartCommand());
  results.push(await testAdminkaCommand());
  results.push(await testRegularUserCommand());
  
  // Итог
  const successCount = results.filter(Boolean).length;
  log('\n📊 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ:', colors.magenta);
  log(`✅ Успешных тестов: ${successCount}/${results.length}`, successCount === results.length ? colors.green : colors.yellow);
  
  if (successCount === results.length) {
    log('\n🎉 ВСЕ ИСПРАВЛЕНИЯ ПРИМЕНЕНЫ УСПЕШНО!', colors.green);
    log('📱 Теперь попробуйте команды в реальном боте:', colors.blue);
    log('   1. Найдите @UniFarming_Bot', colors.blue);
    log('   2. Отправьте /start', colors.blue);
    log('   3. Администраторы увидят кнопку "Админ-панель"', colors.blue);
    log('   4. Попробуйте /adminka для прямого доступа', colors.blue);
  } else {
    log('\n⚠️ Некоторые тесты не прошли', colors.yellow);
    log('🔧 Возможно нужна дополнительная настройка', colors.yellow);
  }
}

main().catch(error => {
  log(`💥 Критическая ошибка: ${error.message}`, colors.red);
  process.exit(1);
});