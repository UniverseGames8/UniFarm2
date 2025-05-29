/**
 * Скрипт для проверки API TON Farming
 */
import fetch from 'node-fetch';

async function testTonFarmingAPI() {
  try {
    console.log('Тестирование API TON Farming');
    
    // Получаем активные TON Boost депозиты
    const response = await fetch('http://localhost:5000/api/ton-farming/active?user_id=1', {
      headers: {
        'Content-Type': 'application/json',
        'x-development-mode': 'true',
        'x-development-user-id': '1'
      }
    });
    
    if (!response.ok) {
      console.error(`Ошибка API: ${response.status} ${response.statusText}`);
      return;
    }
    
    const data = await response.json();
    console.log('Активные TON Boost депозиты:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.success && data.data && data.data.length > 0) {
      // Проверяем ставки для Medium Boost
      const mediumBoost = data.data.find(boost => boost.id === 2);
      if (mediumBoost) {
        console.log('\nПроверка Medium Boost:');
        console.log(`- Сумма депозита: ${mediumBoost.ton_amount} TON`);
        console.log(`- Ставка TON/сек: ${mediumBoost.rate_ton_per_second}`);
        
        // Рассчитываем, какой процент в день соответствует этой ставке
        const tonRatePerSecond = parseFloat(mediumBoost.rate_ton_per_second);
        const tonAmount = parseFloat(mediumBoost.ton_amount);
        const SECONDS_IN_DAY = 86400;
        
        const dailyRatePercent = (tonRatePerSecond * SECONDS_IN_DAY / tonAmount) * 100;
        console.log(`- Вычисление: ${tonRatePerSecond} × ${SECONDS_IN_DAY} / ${tonAmount} × 100 = ${dailyRatePercent.toFixed(6)}%`);
        console.log(`- Расчетная дневная ставка: ${dailyRatePercent.toFixed(2)}%`);
        
        if (Math.abs(dailyRatePercent - 1.0) < 0.1) {
          console.log('✅ Ставка соответствует ожидаемой (1% в день)');
        } else if (Math.abs(dailyRatePercent - 5.0) < 0.1) {
          console.log('❌ Ставка соответствует старому значению (5% в день)');
        } else {
          console.log(`❓ Неожиданная ставка: ${dailyRatePercent.toFixed(2)}%`);
        }
      } else {
        console.log('Medium Boost (ID: 2) не найден среди активных депозитов');
      }
    } else {
      console.log('Активных TON Boost депозитов не найдено или ошибка API');
    }
  } catch (error) {
    console.error('Ошибка при выполнении запроса:', error);
  }
}

// Вызываем функцию тестирования
testTonFarmingAPI();