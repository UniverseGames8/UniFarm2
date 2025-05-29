/**
 * Обновление Mini App URL с параметром версии для принудительного обновления кеша
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function updateMiniAppUrl() {
  try {
    const timestamp = Date.now();
    const miniAppUrl = `https://uni-farm-connect-x-lukyanenkolawfa.replit.app?v=${timestamp}`;
    
    console.log('🔄 Обновление Mini App URL с принудительным обновлением кеша...');
    console.log(`🎯 Новый URL: ${miniAppUrl}`);
    
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setChatMenuButton`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        menu_button: {
          type: 'web_app',
          text: 'Открыть UniFarm',
          web_app: { url: miniAppUrl }
        }
      })
    });
    
    const result = await response.json();
    
    if (result.ok) {
      console.log('✅ Mini App URL успешно обновлен!');
      console.log(`🔗 Активный URL: ${miniAppUrl}`);
      console.log('🎉 Теперь попробуйте открыть Mini App из бота - кеш будет обновлен!');
    } else {
      console.log('❌ Ошибка обновления:', result.description);
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  }
}

updateMiniAppUrl();