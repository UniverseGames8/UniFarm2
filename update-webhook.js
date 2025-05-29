/**
 * Скрипт для обновления Telegram webhook на продакшен URL
 */

import fetch from 'node-fetch';

async function updateWebhook() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const productionUrl = 'https://uni-farm-connect-x-lukyanenkolawfa.replit.app/api/telegram/webhook';
  
  if (!botToken) {
    console.error('❌ TELEGRAM_BOT_TOKEN не найден');
    return;
  }
  
  console.log('🚀 Обновляем webhook на продакшен URL...');
  console.log('📍 Новый URL:', productionUrl);
  
  try {
    // Устанавливаем новый webhook
    const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: productionUrl
      })
    });
    
    const result = await response.json();
    
    if (result.ok) {
      console.log('✅ Webhook успешно обновлен!');
      console.log('📋 Результат:', JSON.stringify(result, null, 2));
      
      // Проверяем новый webhook
      console.log('\n🔍 Проверяем новый webhook...');
      const checkResponse = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
      const checkResult = await checkResponse.json();
      
      if (checkResult.ok) {
        console.log('📊 Информация о webhook:');
        console.log('   URL:', checkResult.result.url);
        console.log('   Ожидающих обновлений:', checkResult.result.pending_update_count);
        console.log('   Максимум подключений:', checkResult.result.max_connections);
      }
      
    } else {
      console.error('❌ Ошибка при установке webhook:', result);
    }
    
  } catch (error) {
    console.error('❌ Ошибка при выполнении запроса:', error);
  }
}

updateWebhook();