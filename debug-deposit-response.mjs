/**
 * Отладочный скрипт для проверки ответа API на запрос депозита
 * Выполняет запрос и детально анализирует ответ сервера
 */
import fetch from 'node-fetch';

async function testDeposit() {
  // URL для тестирования - локальный и production
  const urls = [
    'https://uni-farm-connect-x-lukyanenkolawfa.replit.appsisko.replit.dev',  // локальный
    'https://uni-farm-connect-2-misterxuniverse.replit.app'  // production
  ];

  for (const baseUrl of urls) {
    console.log(`\n----- Тестирование ${baseUrl} -----`);
    const endpoint = '/api/uni-farming/deposit';
    
    // Данные для тестирования с правильным форматом amount как строки
    const testData = {
      user_id: 1,
      amount: "5" // Обратите внимание: amount теперь строка, а не число
    };
    
    console.log(`Отправка POST запроса на ${baseUrl}${endpoint}`);
    console.log('Данные запроса:', testData);
    
    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(testData)
      });
      
      // Информация о статусе и заголовках
      console.log(`Статус ответа: ${response.status} ${response.statusText}`);
      console.log('Заголовки ответа:');
      for (const [key, value] of response.headers.entries()) {
        console.log(`  ${key}: ${value}`);
      }
      
      // Получаем ответ как текст
      const textResponse = await response.text();
      console.log('\nТело ответа (текст):', textResponse);
      
      // Пытаемся распарсить как JSON
      try {
        const jsonResponse = JSON.parse(textResponse);
        console.log('Тело ответа (JSON):', JSON.stringify(jsonResponse, null, 2));
        console.log('✅ JSON валидный!');
      } catch (parseError) {
        console.error('❌ Ошибка парсинга JSON:', parseError.message);
        
        // Детальный анализ ответа для выявления проблем
        console.log('\n🔍 Анализ ответа:');
        console.log('Длина ответа:', textResponse.length, 'символов');
        
        if (textResponse.length === 0) {
          console.error('  - Пустой ответ');
        } else {
          console.log('  - Первые 100 символов:', JSON.stringify(textResponse.substring(0, 100)));
          console.log('  - Последние 100 символов:', JSON.stringify(textResponse.substring(textResponse.length - 100)));
          
          // Проверка на наличие HTML в ответе
          if (textResponse.includes('<html') || textResponse.includes('<!DOCTYPE')) {
            console.error('  - Ответ содержит HTML вместо JSON');
          }
          
          // Проверка на невидимые символы или BOM
          const hasInvisibleChars = /[\u0000-\u001F\u007F-\u009F\uFEFF]/.test(textResponse);
          if (hasInvisibleChars) {
            console.error('  - Ответ содержит невидимые символы или BOM');
          }
          
          // Проверка на множество ответов
          if (textResponse.includes('}{')) {
            console.error('  - Обнаружено несколько объектов JSON в одном ответе');
          }
        }
      }
    } catch (fetchError) {
      console.error('❌ Ошибка выполнения запроса:', fetchError.message);
    }
  }
}

testDeposit();