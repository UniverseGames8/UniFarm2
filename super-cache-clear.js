/**
 * СУПЕР АГРЕССИВНАЯ ОЧИСТКА КЕША TELEGRAM MINI APP
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PRODUCTION_URL = 'https://uni-farm-connect-x-lukyanenkolawfa.replit.app';

async function superCacheClear() {
  console.log('🚀 СУПЕР АГРЕССИВНАЯ ОЧИСТКА КЕША TELEGRAM');
  console.log('===============================================');
  
  try {
    // Создаем уникальный timestamp для принудительной очистки
    const superTimestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const superCacheBustUrl = `${PRODUCTION_URL}?force_reload=${superTimestamp}&cache_clear=${randomId}&v=${Date.now()}`;
    
    console.log('\n🔥 1. Удаляем старое меню...');
    // Сначала удаляем меню полностью
    const deleteMenuResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setChatMenuButton`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        menu_button: { type: 'default' }
      })
    });
    
    const deleteResult = await deleteMenuResponse.json();
    console.log(deleteResult.ok ? '✅ Старое меню удалено' : '❌ Ошибка удаления меню');
    
    // Ждем 2 секунды
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('\n🎯 2. Устанавливаем новое меню с супер кеш-бастингом...');
    const newMenuResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setChatMenuButton`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        menu_button: {
          type: 'web_app',
          text: 'Открыть UniFarm',
          web_app: { url: superCacheBustUrl }
        }
      })
    });
    
    const newMenuResult = await newMenuResponse.json();
    if (newMenuResult.ok) {
      console.log(`✅ Новое меню установлено: ${superCacheBustUrl}`);
    } else {
      console.log(`❌ Ошибка установки нового меню: ${newMenuResult.description}`);
    }
    
    console.log('\n🔗 3. Обновляем webhook с дропом старых обновлений...');
    const webhookResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: `${PRODUCTION_URL}/api/telegram/webhook`,
        drop_pending_updates: true,
        allowed_updates: ["message", "callback_query"],
        max_connections: 1
      })
    });
    
    const webhookResult = await webhookResponse.json();
    console.log(webhookResult.ok ? '✅ Webhook обновлен' : '❌ Ошибка webhook');
    
    console.log('\n🔍 4. Проверяем итоговые настройки...');
    const checkResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
    const checkResult = await checkResponse.json();
    
    if (checkResult.ok) {
      console.log(`📡 Webhook: ${checkResult.result.url}`);
      console.log(`📊 Pending: ${checkResult.result.pending_update_count}`);
    }
    
    console.log('\n🎉 СУПЕР ОЧИСТКА ЗАВЕРШЕНА!');
    console.log('===============================================');
    console.log('🚨 КРИТИЧЕСКИ ВАЖНО:');
    console.log('1. ⚠️  ПОЛНОСТЬЮ ВЫЙДИТЕ ИЗ TELEGRAM');
    console.log('2. 🔄 ПЕРЕЗАПУСТИТЕ TELEGRAM ПРИЛОЖЕНИЕ');
    console.log('3. 🔍 Найдите бота @UniFarming_Bot заново');
    console.log('4. 🎯 Нажмите "Открыть UniFarm"');
    console.log('');
    console.log('💡 Только полный перезапуск Telegram поможет!');
    
  } catch (error) {
    console.error('❌ Критическая ошибка супер очистки:', error.message);
  }
}

superCacheClear();