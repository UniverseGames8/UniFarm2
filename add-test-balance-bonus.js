/**
 * Скрипт для добавления тестовых средств пользователю через систему ежедневных бонусов
 * 
 * Использует API ежедневных бонусов для многократного начисления средств
 * тестовому пользователю в среде разработки.
 * 
 * Запуск: node add-test-balance-bonus.js <user_id> <количество_бонусов>
 * Пример: node add-test-balance-bonus.js 1 10
 */

import fetch from 'node-fetch';
import { db } from './server/db.js';
import { users } from './shared/schema.js';
import { eq } from 'drizzle-orm';

// Базовый URL API
const API_BASE_URL = process.env.API_URL || 'https://uni-farm-connect-x-lukyanenkolawfa.replit.app';

/**
 * Вызывает API для получения статуса бонуса
 * @param {number} userId ID пользователя
 * @returns {Promise<object>} Ответ API
 */
async function checkBonusStatus(userId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/daily-bonus/status?user_id=${userId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`Ошибка при проверке статуса бонуса: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Ошибка при проверке статуса бонуса:', error);
    throw error;
  }
}

/**
 * Вызывает API для получения ежедневного бонуса
 * @param {number} userId ID пользователя
 * @returns {Promise<object>} Ответ API
 */
async function claimBonus(userId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/daily-bonus/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId })
    });
    
    if (!response.ok) {
      throw new Error(`Ошибка при получении бонуса: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Ошибка при получении бонуса:', error);
    throw error;
  }
}

/**
 * Сбрасывает статус бонуса пользователя в БД напрямую,
 * чтобы можно было снова получить бонус для тестирования
 * @param {number} userId ID пользователя
 * @returns {Promise<void>}
 */
async function resetBonusStatus(userId) {
  try {
    // Для тестирования мы обходим проверку на ежедневное получение бонуса,
    // обновляя дату последнего получения на вчерашний день
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Обновляем дату последнего получения бонуса
    await db
      .update(users)
      .set({ 
        checkin_last_date: yesterday
      })
      .where(eq(users.id, userId));
    
    console.log(`[✓] Статус бонуса сброшен для пользователя ID=${userId}`);
  } catch (error) {
    console.error('Ошибка при сбросе статуса бонуса:', error);
    throw error;
  }
}

/**
 * Получает информацию о балансе пользователя
 * @param {number} userId ID пользователя
 * @returns {Promise<object>} Баланс пользователя
 */
async function getUserBalance(userId) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/wallet/balance?user_id=${userId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`Ошибка при получении баланса: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Ошибка при получении баланса:', error);
    throw error;
  }
}

/**
 * Основная функция для добавления тестовых средств пользователю
 * @param {number} userId ID пользователя
 * @param {number} count Количество бонусов для начисления
 * @returns {Promise<void>}
 */
async function addTestBalanceViaBonus(userId, count) {
  console.log(`Запуск начисления ${count} бонусов пользователю ID=${userId}...`);
  
  try {
    // Сначала проверяем текущий баланс
    const initialBalanceResponse = await getUserBalance(userId);
    if (!initialBalanceResponse.success) {
      throw new Error('Не удалось получить начальный баланс пользователя');
    }
    
    const initialBalance = initialBalanceResponse.data.uni;
    console.log(`[i] Начальный баланс UNI: ${initialBalance}`);
    
    // Запускаем цикл начисления бонусов
    let successfulClaims = 0;
    let totalAdded = 0;
    
    for (let i = 0; i < count; i++) {
      try {
        // Сбрасываем статус бонуса
        await resetBonusStatus(userId);
        
        // Проверяем статус бонуса (для логирования)
        const statusResponse = await checkBonusStatus(userId);
        if (!statusResponse.success) {
          console.error(`Ошибка в ответе API статуса бонуса: ${JSON.stringify(statusResponse)}`);
          continue;
        }
        
        const canClaim = statusResponse.data.canClaim;
        const bonusAmount = statusResponse.data.bonusAmount;
        
        if (!canClaim) {
          console.log(`[!] Бонус недоступен для получения (попытка ${i+1}/${count})`);
          continue;
        }
        
        // Получаем бонус
        const claimResponse = await claimBonus(userId);
        if (!claimResponse.success || !claimResponse.data.success) {
          console.error(`Ошибка при получении бонуса: ${JSON.stringify(claimResponse)}`);
          continue;
        }
        
        // Если успешно получили бонус
        successfulClaims++;
        totalAdded += bonusAmount;
        
        console.log(`[✓] Бонус #${successfulClaims} успешно получен: +${bonusAmount} UNI`);
      } catch (error) {
        console.error(`Ошибка в итерации ${i+1}:`, error);
      }
      
      // Добавляем задержку между запросами
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Проверяем финальный баланс
    const finalBalanceResponse = await getUserBalance(userId);
    if (!finalBalanceResponse.success) {
      throw new Error('Не удалось получить финальный баланс пользователя');
    }
    
    const finalBalance = finalBalanceResponse.data.uni;
    const actualAdded = finalBalance - initialBalance;
    
    console.log('\nРезультаты операции:');
    console.log(`[i] Успешных начислений: ${successfulClaims} из ${count}`);
    console.log(`[i] Ожидаемая сумма: +${totalAdded} UNI`);
    console.log(`[i] Фактическая сумма: +${actualAdded} UNI`);
    console.log(`[i] Начальный баланс: ${initialBalance} UNI`);
    console.log(`[i] Финальный баланс: ${finalBalance} UNI`);
    console.log(`\n[✓] Операция завершена успешно!`);
    
  } catch (error) {
    console.error('Произошла критическая ошибка:', error);
    process.exit(1);
  }
}

/**
 * Запуск скрипта с параметрами командной строки
 */
async function main() {
  try {
    const args = process.argv.slice(2);
    
    // Проверяем наличие необходимых аргументов
    if (args.length < 2) {
      console.error('Необходимо указать ID пользователя и количество бонусов');
      console.error('Использование: node add-test-balance-bonus.js <user_id> <количество_бонусов>');
      process.exit(1);
    }
    
    // Парсим и валидируем аргументы
    const userId = parseInt(args[0]);
    const count = parseInt(args[1]);
    
    if (isNaN(userId) || userId <= 0) {
      console.error('ID пользователя должен быть положительным числом');
      process.exit(1);
    }
    
    if (isNaN(count) || count <= 0) {
      console.error('Количество бонусов должно быть положительным числом');
      process.exit(1);
    }
    
    // Запускаем основную функцию
    await addTestBalanceViaBonus(userId, count);
    
  } catch (error) {
    console.error('Ошибка при запуске скрипта:', error);
    process.exit(1);
  }
}

// Запускаем скрипт
main();