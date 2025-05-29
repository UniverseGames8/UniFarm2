/**
 * Фінальне налаштування Telegram бота @UniFarming_Bot
 */

import fetch from 'node-fetch';

async function finalBotSetup() {
  console.log('🚀 Фінальне налаштування бота @UniFarming_Bot...');
  
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!botToken) {
    console.error('❌ TELEGRAM_BOT_TOKEN не знайдено!');
    return;
  }

  // 1. Налаштуємо правильний Menu Button
  console.log('🔧 Налаштування Menu Button...');
  
  const menuResponse = await fetch(`https://api.telegram.org/bot${botToken}/setChatMenuButton`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      menu_button: {
        type: 'web_app',
        text: 'Открыть приложение',
        web_app: {
          url: 'https://uni-farm-connect-x-lukyanenkolawfa.replit.app'
        }
      }
    })
  });
  
  const menuResult = await menuResponse.json();
  
  if (menuResult.ok) {
    console.log('✅ Menu Button налаштовано!');
    console.log('📱 Текст: "Открыть приложение"');
    console.log('🔗 URL: https://uni-farm-connect-x-lukyanenkolawfa.replit.app');
  } else {
    console.error('❌ Помилка Menu Button:', menuResult.description);
  }

  // 2. Додамо команди бота
  console.log('\n🔧 Налаштування команд бота...');
  
  const commands = [
    {
      command: 'start',
      description: 'Запустить бота и получить приветственное сообщение'
    },
    {
      command: 'app',
      description: 'Открыть UniFarm Mini App'
    },
    {
      command: 'help',
      description: 'Помощь по использованию'
    },
    {
      command: 'deposit',
      description: 'Внести депозит'
    },
    {
      command: 'withdraw',
      description: 'Вывести средства'
    },
    {
      command: 'referral',
      description: 'Реферальная программа'
    },
    {
      command: 'refcode',
      description: 'Получить реферальный код'
    },
    {
      command: 'info',
      description: 'Информация о боте'
    }
  ];
  
  const commandsResponse = await fetch(`https://api.telegram.org/bot${botToken}/setMyCommands`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ commands })
  });
  
  const commandsResult = await commandsResponse.json();
  
  if (commandsResult.ok) {
    console.log('✅ Команди бота налаштовано!');
    console.log(`📋 Додано ${commands.length} команд`);
  } else {
    console.error('❌ Помилка команд:', commandsResult.description);
  }

  // 3. Перевіримо фінальні налаштування
  console.log('\n📋 Перевірка фінальних налаштувань...');
  
  const finalCheck = await fetch(`https://api.telegram.org/bot${botToken}/getChatMenuButton`);
  const finalResult = await finalCheck.json();
  
  if (finalResult.ok) {
    console.log('✅ Фінальні налаштування Menu Button:');
    console.log(`📱 Текст: "${finalResult.result.text}"`);
    console.log(`🔗 URL: ${finalResult.result.web_app.url}`);
  }
  
  console.log('\n🎉 Фінальне налаштування завершено!');
  console.log('📲 Бот @UniFarming_Bot готовий до тестування:');
  console.log('   • Menu Button: "Открыть приложение"');
  console.log('   • Команди: /start, /app, /help, /deposit, /withdraw, /referral');
  console.log('   • Mini App: https://t.me/UniFarming_Bot/UniFarm');
}

finalBotSetup().catch(console.error);