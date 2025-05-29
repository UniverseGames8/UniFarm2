/**
 * СОЗДАНИЕ НОВОГО MINI APP С ДРУГИМ ПУТЕМ
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PRODUCTION_URL = 'https://uni-farm-connect-x-lukyanenkolawfa.replit.app';

async function createNewMiniApp() {
  console.log('🎯 СОЗДАНИЕ НОВОГО MINI APP С НОВЫМ ПУТЕМ');
  console.log('============================================');
  
  try {
    // Создаем новый путь для приложения
    const timestamp = Date.now();
    const newPath = `/app/new/${timestamp}`;
    const newMiniAppUrl = `${PRODUCTION_URL}${newPath}`;
    
    console.log('\n🔥 1. Удаляем старое меню полностью...');
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setChatMenuButton`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ menu_button: { type: 'default' } })
    });
    
    // Ждем 3 секунды
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('\n🚀 2. Создаем новое меню с НОВЫМ ПУТЕМ...');
    const menuResult = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setChatMenuButton`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        menu_button: {
          type: 'web_app',
          text: '🌟 UniFarm NEW',
          web_app: { url: newMiniAppUrl }
        }
      })
    });
    
    const menuResponse = await menuResult.json();
    if (menuResponse.ok) {
      console.log(`✅ Новый Mini App создан: ${newMiniAppUrl}`);
    } else {
      console.log(`❌ Ошибка: ${menuResponse.description}`);
    }
    
    console.log('\n🔗 3. Обновляем webhook...');
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: `${PRODUCTION_URL}/api/telegram/webhook`,
        drop_pending_updates: true
      })
    });
    
    console.log('✅ Webhook обновлен');
    
    console.log('\n🎉 НОВЫЙ MINI APP СОЗДАН!');
    console.log('============================================');
    console.log('📱 ТЕПЕРЬ ПОПРОБУЙТЕ:');
    console.log('1. Найдите бота @UniFarming_Bot');
    console.log('2. Нажмите кнопку "🌟 UniFarm NEW"');
    console.log('');
    console.log(`🔗 Новый путь: ${newPath}`);
    console.log(`🌐 Полный URL: ${newMiniAppUrl}`);
    console.log('');
    console.log('💡 Новый путь должен заставить браузер загрузить');
    console.log('   свежие файлы с правильного сервера!');
    
  } catch (error) {
    console.error('❌ Ошибка создания нового Mini App:', error.message);
  }
}

createNewMiniApp();