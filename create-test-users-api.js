/**
 * Скрипт для безопасного тестирования реферальной системы через API
 * Создает пользователей и реферальные связи непосредственно через API-запросы
 */

// Конфигурация
const CONFIG = {
  // Базовый URL API
  API_URL: 'https://93cb0060-75d7-4281-ac65-b204cda864a4-00-1j7bpbfst9vfx.pike.replit.dev/api',
  // Количество уровней для создания (максимум 20)
  LEVELS: 3, // Можно увеличить до 20 для полного тестирования
  // Префикс для имен пользователей
  USERNAME_PREFIX: 'test_ref',
  // Базовая сумма для депозита
  DEPOSIT_AMOUNT: 100
};

// Используем fetch из 'node-fetch'
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

/**
 * Выполняет GET-запрос к API
 */
async function apiGet(endpoint, userId = null) {
  const headers = {
    'Content-Type': 'application/json',
    'x-development-mode': 'true'
  };
  
  if (userId) {
    headers['x-development-user-id'] = userId.toString();
  }
  
  try {
    const response = await fetch(`${CONFIG.API_URL}/${endpoint}`, {
      method: 'GET',
      headers
    });
    
    if (!response.ok) {
      throw new Error(`API вернул статус ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Ошибка при GET-запросе к ${endpoint}:`, error.message);
    throw error;
  }
}

/**
 * Выполняет POST-запрос к API
 */
async function apiPost(endpoint, data, userId = null) {
  const headers = {
    'Content-Type': 'application/json',
    'x-development-mode': 'true'
  };
  
  if (userId) {
    headers['x-development-user-id'] = userId.toString();
  }
  
  try {
    const response = await fetch(`${CONFIG.API_URL}/${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API вернул статус ${response.status}: ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Ошибка при POST-запросе к ${endpoint}:`, error.message);
    throw error;
  }
}

/**
 * Регистрирует нового пользователя через API
 */
async function registerUser(username) {
  console.log(`Регистрация пользователя: ${username}`);
  
  try {
    // Пробуем использовать API для создания тестового пользователя
    const userData = await apiPost('users/register', {
      username,
      password: 'Test123!',
      is_test: true
    });
    
    console.log(`Пользователь ${username} успешно создан с ID: ${userData.data.id}`);
    return userData.data;
  } catch (error) {
    console.error(`Не удалось создать пользователя через стандартный API:`, error.message);
    
    // Пробуем альтернативный API для тестовых пользователей
    try {
      const userData = await apiPost('users/create-test', {
        username
      });
      
      console.log(`Пользователь ${username} успешно создан с ID: ${userData.data.id}`);
      return userData.data;
    } catch (altError) {
      console.error(`Не удалось создать пользователя и через альтернативный API:`, altError.message);
      throw altError;
    }
  }
}

/**
 * Создает реферальную связь между пользователями
 */
async function createReferralRelationship(userId, inviterId) {
  console.log(`Создание реферальной связи: ${userId} (приглашенный) -> ${inviterId} (пригласитель)`);
  
  try {
    const result = await apiPost('referral/create-relationship', {
      userId,
      inviterId
    });
    
    console.log('Реферальная связь успешно создана');
    return result.data;
  } catch (error) {
    console.error('Не удалось создать реферальную связь:', error.message);
    throw error;
  }
}

/**
 * Создает депозит в фарминг для пользователя
 */
async function createDeposit(userId, amount) {
  console.log(`Создание депозита для пользователя ${userId}: ${amount} UNI`);
  
  try {
    const result = await apiPost('uni-farming/deposit', {
      amount: amount.toString()
    }, userId);
    
    console.log(`Депозит успешно создан: ${amount} UNI`);
    return result.data;
  } catch (error) {
    console.error('Не удалось создать депозит:', error.message);
    throw error;
  }
}

/**
 * Запускает сбор дохода от фарминга (harvest)
 */
async function harvestFarming(userId) {
  console.log(`Запуск сбора дохода (harvest) для пользователя ${userId}`);
  
  try {
    const result = await apiPost('uni-farming/harvest', {}, userId);
    console.log('Сбор дохода успешно выполнен');
    return result.data;
  } catch (error) {
    console.error('Не удалось выполнить harvest:', error.message);
    throw error;
  }
}

/**
 * Проверяет транзакции пользователя
 */
async function checkTransactions(userId) {
  console.log(`Проверка транзакций для пользователя ${userId}`);
  
  try {
    const result = await apiGet('transactions', userId);
    const transactions = result.data.transactions || [];
    
    console.log(`Найдено ${transactions.length} транзакций`);
    transactions.forEach(tx => {
      console.log(`- ID: ${tx.id}, Тип: ${tx.type}, Сумма: ${tx.amount} ${tx.currency}, Время: ${tx.created_at}`);
    });
    
    // Подсчет реферальных транзакций
    const referralTransactions = transactions.filter(tx => tx.type && tx.type.includes('referral'));
    console.log(`Из них реферальных: ${referralTransactions.length}`);
    
    return transactions;
  } catch (error) {
    console.error('Не удалось получить транзакции:', error.message);
    return [];
  }
}

/**
 * Создает цепочку рефералов заданной длины
 */
async function createReferralChain(levels) {
  console.log(`=== Создание цепочки рефералов из ${levels} уровней ===`);
  
  // Создаем массив с информацией о пользователях
  const users = [];
  
  // Создаем пользователей для каждого уровня
  for (let level = 0; level < levels; level++) {
    const username = `${CONFIG.USERNAME_PREFIX}_${level}`;
    
    try {
      // Создаем пользователя
      const user = await registerUser(username);
      users.push(user);
      
      // Если это не первый пользователь, создаем реферальную связь
      if (level > 0) {
        await createReferralRelationship(user.id, users[level - 1].id);
      }
      
      console.log(`Пользователь для уровня ${level} успешно создан: ${username} (ID: ${user.id})`);
    } catch (error) {
      console.error(`Ошибка при создании пользователя для уровня ${level}:`, error.message);
      break;
    }
  }
  
  return users;
}

/**
 * Тестирует работу реферальной системы
 */
async function testReferralSystem(users) {
  if (users.length === 0) {
    console.error('Нет пользователей для тестирования');
    return;
  }
  
  console.log(`=== Тестирование реферальной системы с ${users.length} пользователями ===`);
  
  // Получаем пользователя самого нижнего уровня (последнего в цепочке)
  const bottomUser = users[users.length - 1];
  
  // Создаем депозит для последнего пользователя
  try {
    await createDeposit(bottomUser.id, CONFIG.DEPOSIT_AMOUNT);
    
    // Ждем небольшую паузу для обработки депозита
    console.log('Ожидание 5 секунд для обработки депозита...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Запускаем сбор дохода
    await harvestFarming(bottomUser.id);
    
    // Ждем паузу для обработки реферальных начислений
    console.log('Ожидание 10 секунд для обработки реферальных начислений...');
    await new Promise(resolve => setTimeout(resolve, 10000));
  } catch (error) {
    console.error('Ошибка при тестировании фарминга:', error.message);
  }
}

/**
 * Проверяет результаты тестирования
 */
async function checkResults(users) {
  console.log(`=== Проверка результатов тестирования для ${users.length} пользователей ===`);
  
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    console.log(`\n--- Проверка пользователя на уровне ${i} (ID: ${user.id}, Username: ${user.username}) ---`);
    
    // Проверяем транзакции пользователя
    const transactions = await checkTransactions(user.id);
    
    // Находим реферальные транзакции
    const referralTransactions = transactions.filter(tx => tx.type && tx.type.includes('referral'));
    
    if (referralTransactions.length > 0) {
      console.log(`✅ Пользователь имеет ${referralTransactions.length} реферальных транзакций:`);
      referralTransactions.forEach(tx => {
        console.log(`  - ${tx.amount} ${tx.currency} (${tx.type}): ${tx.description || 'Нет описания'}`);
      });
    } else if (i < users.length - 1) { // Пропускаем последнего пользователя, он не должен иметь реферальных начислений
      console.log(`⚠️ Пользователь уровня ${i} не имеет реферальных транзакций`);
    }
  }
}

/**
 * Основная функция для запуска тестирования
 */
async function main() {
  try {
    console.log('=== Начало тестирования реферальной системы ===');
    
    // Создаем цепочку рефералов
    const users = await createReferralChain(CONFIG.LEVELS);
    console.log(`Успешно создано ${users.length} пользователей в реферальной цепочке`);
    
    // Тестируем реферальную систему
    await testReferralSystem(users);
    
    // Проверяем результаты
    await checkResults(users);
    
    console.log('\n=== Тестирование реферальной системы успешно завершено ===');
  } catch (error) {
    console.error('Ошибка при тестировании реферальной системы:', error);
  }
}

// Запускаем основную функцию
(async () => {
  try {
    await main();
  } catch (error) {
    console.error('Непредвиденная ошибка:', error);
  }
})();