/**
 * ФИНАЛЬНОЕ ИСПРАВЛЕНИЕ URL - замена всех временных ссылок на продакшн
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PRODUCTION_URL = 'https://uni-farm-connect-x-lukyanenkolawfa.replit.app';

async function finalUrlFix() {
  console.log('🔧 ФИНАЛЬНОЕ ИСПРАВЛЕНИЕ URL В UNIFARM');
  console.log('==========================================');
  
  try {
    // 1. Обновляем Mini App URL с принудительным кеш-бастингом
    const timestamp = Date.now();
    const cacheBustUrl = `${PRODUCTION_URL}?cache_clear=${timestamp}`;
    
    console.log('\n📱 1. Обновляем Mini App URL...');
    const menuResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setChatMenuButton`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        menu_button: {
          type: 'web_app',
          text: 'Открыть UniFarm',
          web_app: { url: cacheBustUrl }
        }
      })
    });
    
    const menuResult = await menuResponse.json();
    if (menuResult.ok) {
      console.log(`✅ Mini App URL обновлен: ${cacheBustUrl}`);
    } else {
      console.log(`❌ Ошибка обновления Mini App: ${menuResult.description}`);
    }
    
    // 2. Обновляем webhook URL
    console.log('\n🔗 2. Обновляем Webhook URL...');
    const webhookResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: `${PRODUCTION_URL}/api/telegram/webhook`,
        drop_pending_updates: true,
        allowed_updates: ["message", "callback_query"]
      })
    });
    
    const webhookResult = await webhookResponse.json();
    if (webhookResult.ok) {
      console.log(`✅ Webhook обновлен: ${PRODUCTION_URL}/api/telegram/webhook`);
    } else {
      console.log(`❌ Ошибка обновления webhook: ${webhookResult.description}`);
    }
    
    // 3. Проверяем текущие настройки
    console.log('\n🔍 3. Проверяем текущие настройки...');
    const infoResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
    const infoResult = await infoResponse.json();
    
    if (infoResult.ok) {
      console.log(`📡 Активный webhook: ${infoResult.result.url}`);
      console.log(`📊 Pending updates: ${infoResult.result.pending_update_count}`);
    }
    
    // 4. Очищаем старые переменные окружения
    console.log('\n🧹 4. Очищаем переменные окружения...');
    process.env.REPLIT_DOMAINS = PRODUCTION_URL;
    process.env.REPLIT_DEV_DOMAIN = PRODUCTION_URL;
    process.env.VITE_API_BASE_URL = PRODUCTION_URL;
    console.log('✅ Переменные окружения обновлены');
    
    console.log('\n🎉 ИСПРАВЛЕНИЕ ЗАВЕРШЕНО!');
    console.log('==========================================');
    console.log('📋 ИНСТРУКЦИЯ ДЛЯ ПОЛЬЗОВАТЕЛЯ:');
    console.log('1. ❌ ПОЛНОСТЬЮ закройте Mini App');
    console.log('2. 🔄 Закройте чат с ботом');
    console.log('3. 📱 Откройте чат с ботом заново');
    console.log('4. 🎯 Нажмите "Открыть UniFarm"');
    console.log('5. ✅ Telegram загрузит новую версию');
    console.log('');
    console.log('💡 Если проблема остается - перезагрузите Telegram полностью');
    
  } catch (error) {
    console.error('❌ Критическая ошибка:', error.message);
  }
}

finalUrlFix();