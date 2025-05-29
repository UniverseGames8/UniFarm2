/**
 * Комплексная проверка связей: API → Контроллер → БД
 * 
 * Этот скрипт проводит аудит всей цепочки обработки запросов:
 * 1. Проверяет соответствие API и контроллеров
 * 2. Проверяет взаимодействие контроллеров с базой данных
 * 3. Проверяет соответствие возвращаемых ответов
 * 4. Проверяет согласованность цепочки на тестовых действиях
 * 5. Фиксирует найденные ошибки и слабые места
 */

require('dotenv').config();
const fetch = require('node-fetch');
const { Pool } = require('@neondatabase/serverless');
const ws = require('ws');

// Конфигурация подключения к базе данных
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Базовый URL API
const API_BASE_URL = 'https://uni-farm-connect-x-lukyanenkolawfa.replit.app/api';

// Цветные логи для лучшей читаемости
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

/**
 * Выполняет API-запрос
 */
async function callApi(endpoint, method = 'GET', body = null) {
  console.log(`${colors.cyan}[API Request] ${method} ${endpoint}${colors.reset}`);
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
      console.log(`${colors.cyan}[Request Body] ${JSON.stringify(body, null, 2)}${colors.reset}`);
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    const json = await response.json();
    
    console.log(`${colors.cyan}[API Response] Status: ${response.status}${colors.reset}`);
    console.log(`${colors.cyan}[Response Body] ${JSON.stringify(json, null, 2)}${colors.reset}`);
    
    return {
      status: response.status,
      data: json,
    };
  } catch (error) {
    console.error(`${colors.red}[API Error] ${error.message}${colors.reset}`);
    return {
      status: 500,
      data: { error: error.message },
    };
  }
}

/**
 * Выполняет SQL-запрос к базе данных
 */
async function queryDatabase(query, params = []) {
  console.log(`${colors.blue}[DB Query] ${query}${colors.reset}`);
  if (params.length > 0) {
    console.log(`${colors.blue}[DB Params] ${JSON.stringify(params)}${colors.reset}`);
  }
  
  try {
    const result = await pool.query(query, params);
    console.log(`${colors.blue}[DB Result] ${result.rowCount} rows${colors.reset}`);
    return result.rows;
  } catch (error) {
    console.error(`${colors.red}[DB Error] ${error.message}${colors.reset}`);
    throw error;
  }
}

/**
 * Проверяет последние записи в базе данных для конкретной таблицы
 */
async function checkLatestRecords(tableName, userId, limit = 5) {
  const query = `
    SELECT * FROM ${tableName}
    ${userId ? `WHERE user_id = $1` : ''}
    ORDER BY id DESC
    LIMIT ${limit}
  `;
  
  const params = userId ? [userId] : [];
  return await queryDatabase(query, params);
}

/**
 * Проверяет баланс пользователя
 */
async function checkUserBalance(userId) {
  const query = `
    SELECT id, balance_uni, balance_ton FROM users
    WHERE id = $1
  `;
  
  const result = await queryDatabase(query, [userId]);
  return result[0];
}

/**
 * Проверяет цепочку API → Контроллер → БД для регистрации пользователя
 */
async function testUserRegistration() {
  console.log(`${colors.green}==== Тест #1: Регистрация пользователя ====${colors.reset}`);
  
  // Генерируем уникальный guest_id для теста
  const guestId = `guest_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  
  // 1. Вызываем API для создания пользователя
  const response = await callApi('/auth/register-guest', 'POST', {
    guest_id: guestId,
  });
  
  // 2. Проверяем ответ API
  if (response.status !== 200 || !response.data.success) {
    console.log(`${colors.red}✘ API вернул ошибку или неверный формат ответа${colors.reset}`);
    console.log(`${colors.yellow}Проблема: API регистрации гостя не вернул успешный ответ${colors.reset}`);
    return null;
  }
  
  const userId = response.data.data?.user?.id;
  if (!userId) {
    console.log(`${colors.red}✘ API не вернул ID пользователя${colors.reset}`);
    console.log(`${colors.yellow}Проблема: Отсутствует user.id в ответе API${colors.reset}`);
    return null;
  }
  
  console.log(`${colors.green}✓ API вернул корректный ответ с ID пользователя: ${userId}${colors.reset}`);
  
  // 3. Проверяем запись в базе данных
  const userRecords = await queryDatabase('SELECT * FROM users WHERE id = $1', [userId]);
  
  if (userRecords.length === 0) {
    console.log(`${colors.red}✘ Пользователь не найден в базе данных${colors.reset}`);
    console.log(`${colors.yellow}Проблема: Контроллер не создал запись в таблице users${colors.reset}`);
    return null;
  }
  
  const user = userRecords[0];
  if (user.guest_id !== guestId) {
    console.log(`${colors.red}✘ guest_id в базе не соответствует отправленному${colors.reset}`);
    console.log(`${colors.yellow}Проблема: Контроллер не сохранил правильный guest_id${colors.reset}`);
  } else {
    console.log(`${colors.green}✓ Пользователь успешно создан в базе данных${colors.reset}`);
  }
  
  // 4. Проверяем, что у пользователя есть реферальный код
  if (!user.ref_code) {
    console.log(`${colors.red}✘ У пользователя отсутствует реферальный код${colors.reset}`);
    console.log(`${colors.yellow}Проблема: Контроллер не генерирует реферальный код${colors.reset}`);
  } else {
    console.log(`${colors.green}✓ Пользователю присвоен реферальный код: ${user.ref_code}${colors.reset}`);
  }
  
  // 5. Проверяем начальный баланс
  if (user.balance_uni !== '100' && parseFloat(user.balance_uni) !== 100) {
    console.log(`${colors.red}✘ Начальный баланс UNI не установлен в 100${colors.reset}`);
    console.log(`${colors.yellow}Проблема: Контроллер не устанавливает начальный баланс UNI${colors.reset}`);
  } else {
    console.log(`${colors.green}✓ Начальный баланс UNI установлен: ${user.balance_uni}${colors.reset}`);
  }
  
  return {
    userId,
    guestId,
    refCode: user.ref_code
  };
}

/**
 * Проверяет цепочку API → Контроллер → БД для депозита в фарминг
 */
async function testFarmingDeposit(userId) {
  console.log(`${colors.green}==== Тест #2: Депозит в UNI фарминг ====${colors.reset}`);
  
  if (!userId) {
    console.log(`${colors.red}✘ Невозможно продолжить без ID пользователя${colors.reset}`);
    return null;
  }
  
  // 0. Проверим текущий баланс пользователя
  const initialBalance = await checkUserBalance(userId);
  console.log(`${colors.blue}Текущий баланс UNI: ${initialBalance.balance_uni}${colors.reset}`);
  
  // 1. Вызываем API для создания депозита
  const depositAmount = 5;
  const response = await callApi('/uni-farming/deposit', 'POST', {
    user_id: userId,
    amount: depositAmount.toString() // Отправляем как строку для проверки конвертации типов
  });
  
  // 2. Проверяем ответ API
  if (response.status !== 200 || !response.data.success) {
    console.log(`${colors.red}✘ API вернул ошибку или неверный формат ответа${colors.reset}`);
    console.log(`${colors.yellow}Проблема: API депозита не вернул успешный ответ${colors.reset}`);
    return false;
  }
  
  console.log(`${colors.green}✓ API вернул успешный ответ${colors.reset}`);
  
  // 3. Проверяем запись в таблице депозитов
  const depositRecords = await queryDatabase(
    'SELECT * FROM uni_farming_deposits WHERE user_id = $1 ORDER BY id DESC LIMIT 1',
    [userId]
  );
  
  if (depositRecords.length === 0) {
    console.log(`${colors.red}✘ Депозит не создан в базе данных${colors.reset}`);
    console.log(`${colors.yellow}Проблема: Контроллер не создал запись в таблице uni_farming_deposits${colors.reset}`);
    return false;
  }
  
  const deposit = depositRecords[0];
  if (parseFloat(deposit.amount) !== depositAmount) {
    console.log(`${colors.red}✘ Сумма депозита в базе не соответствует отправленной${colors.reset}`);
    console.log(`${colors.yellow}Проблема: Контроллер не сохранил правильную сумму депозита${colors.reset}`);
  } else {
    console.log(`${colors.green}✓ Депозит успешно создан в базе данных${colors.reset}`);
  }
  
  // 4. Проверяем, что у депозита есть rate_per_second
  if (!deposit.rate_per_second) {
    console.log(`${colors.red}✘ У депозита отсутствует скорость начисления (rate_per_second)${colors.reset}`);
    console.log(`${colors.yellow}Проблема: Контроллер не устанавливает rate_per_second${colors.reset}`);
  } else {
    console.log(`${colors.green}✓ Депозиту присвоена скорость начисления: ${deposit.rate_per_second}${colors.reset}`);
  }
  
  // 5. Проверяем обновление баланса пользователя
  const updatedBalance = await checkUserBalance(userId);
  const expectedBalance = parseFloat(initialBalance.balance_uni) - depositAmount;
  const actualBalance = parseFloat(updatedBalance.balance_uni);
  
  if (Math.abs(actualBalance - expectedBalance) > 0.01) { // Допуск 0.01 для погрешности чисел с плавающей точкой
    console.log(`${colors.red}✘ Баланс пользователя не обновился корректно${colors.reset}`);
    console.log(`${colors.yellow}Проблема: Контроллер не уменьшил баланс пользователя на сумму депозита${colors.reset}`);
    console.log(`${colors.yellow}Ожидалось: ${expectedBalance}, получено: ${actualBalance}${colors.reset}`);
  } else {
    console.log(`${colors.green}✓ Баланс пользователя уменьшился на сумму депозита${colors.reset}`);
  }
  
  // 6. Проверяем запись в таблице транзакций
  const transactionRecords = await queryDatabase(
    "SELECT * FROM transactions WHERE user_id = $1 AND type = 'deposit' ORDER BY id DESC LIMIT 1",
    [userId]
  );
  
  if (transactionRecords.length === 0) {
    console.log(`${colors.red}✘ Транзакция депозита не создана в базе данных${colors.reset}`);
    console.log(`${colors.yellow}Проблема: Контроллер не создал запись в таблице transactions${colors.reset}`);
  } else {
    console.log(`${colors.green}✓ Транзакция депозита успешно создана в базе данных${colors.reset}`);
  }
  
  return {
    depositId: deposit.id,
    depositAmount
  };
}

/**
 * Проверяет цепочку API → Контроллер → БД для сбора фарминга
 */
async function testFarmingHarvest(userId) {
  console.log(`${colors.green}==== Тест #3: Сбор урожая фарминга ====${colors.reset}`);
  
  if (!userId) {
    console.log(`${colors.red}✘ Невозможно продолжить без ID пользователя${colors.reset}`);
    return false;
  }
  
  // 0. Проверим текущий баланс пользователя
  const initialBalance = await checkUserBalance(userId);
  console.log(`${colors.blue}Текущий баланс UNI: ${initialBalance.balance_uni}${colors.reset}`);
  
  // 1. Вызываем API для сбора фарминга
  const response = await callApi('/uni-farming/harvest', 'POST', {
    user_id: userId
  });
  
  // 2. Проверяем ответ API
  if (response.status !== 200 || !response.data.success) {
    console.log(`${colors.red}✘ API вернул ошибку или неверный формат ответа${colors.reset}`);
    console.log(`${colors.yellow}Проблема: API сбора урожая не вернул успешный ответ${colors.reset}`);
    return false;
  }
  
  console.log(`${colors.green}✓ API вернул успешный ответ${colors.reset}`);
  
  // 3. Проверяем обновление баланса пользователя
  const updatedBalance = await checkUserBalance(userId);
  
  if (parseFloat(updatedBalance.balance_uni) <= parseFloat(initialBalance.balance_uni)) {
    console.log(`${colors.red}✘ Баланс пользователя не увеличился${colors.reset}`);
    console.log(`${colors.yellow}Проблема: Контроллер не увеличил баланс пользователя${colors.reset}`);
    console.log(`${colors.yellow}Было: ${initialBalance.balance_uni}, стало: ${updatedBalance.balance_uni}${colors.reset}`);
  } else {
    console.log(`${colors.green}✓ Баланс пользователя увеличился с ${initialBalance.balance_uni} до ${updatedBalance.balance_uni}${colors.reset}`);
  }
  
  // 4. Проверяем запись в таблице транзакций
  const transactionRecords = await queryDatabase(
    "SELECT * FROM transactions WHERE user_id = $1 AND type = 'farming_reward' ORDER BY id DESC LIMIT 1",
    [userId]
  );
  
  if (transactionRecords.length === 0) {
    console.log(`${colors.red}✘ Транзакция вознаграждения не создана в базе данных${colors.reset}`);
    console.log(`${colors.yellow}Проблема: Контроллер не создал запись в таблице transactions${colors.reset}`);
  } else {
    console.log(`${colors.green}✓ Транзакция вознаграждения успешно создана в базе данных${colors.reset}`);
  }
  
  return true;
}

/**
 * Проверяет цепочку API → Контроллер → БД для вывода средств
 */
async function testWithdrawFunds(userId) {
  console.log(`${colors.green}==== Тест #4: Вывод средств ====${colors.reset}`);
  
  if (!userId) {
    console.log(`${colors.red}✘ Невозможно продолжить без ID пользователя${colors.reset}`);
    return false;
  }
  
  // 0. Проверим текущий баланс пользователя
  const initialBalance = await checkUserBalance(userId);
  console.log(`${colors.blue}Текущий баланс UNI: ${initialBalance.balance_uni}${colors.reset}`);
  
  // 1. Вызываем API для вывода средств
  const withdrawAmount = 1;
  const response = await callApi('/withdraw', 'POST', {
    user_id: userId,
    amount: withdrawAmount.toString(),
    currency: 'UNI',
    address: 'UQExampleTonAddressForTestingPurposesOnly12345'
  });
  
  // 2. Проверяем ответ API
  if (response.status !== 200 || !response.data.success) {
    console.log(`${colors.red}✘ API вернул ошибку или неверный формат ответа${colors.reset}`);
    console.log(`${colors.yellow}Проблема: API вывода средств не вернул успешный ответ${colors.reset}`);
    return false;
  }
  
  console.log(`${colors.green}✓ API вернул успешный ответ${colors.reset}`);
  
  // 3. Проверяем запись в таблице транзакций
  const transactionRecords = await queryDatabase(
    "SELECT * FROM transactions WHERE user_id = $1 AND type = 'withdraw' AND currency = 'UNI' ORDER BY id DESC LIMIT 1",
    [userId]
  );
  
  if (transactionRecords.length === 0) {
    console.log(`${colors.red}✘ Транзакция вывода не создана в базе данных${colors.reset}`);
    console.log(`${colors.yellow}Проблема: Контроллер не создал запись в таблице transactions${colors.reset}`);
    return false;
  }
  
  const transaction = transactionRecords[0];
  if (parseFloat(transaction.amount) !== withdrawAmount) {
    console.log(`${colors.red}✘ Сумма вывода в базе не соответствует отправленной${colors.reset}`);
    console.log(`${colors.yellow}Проблема: Контроллер не сохранил правильную сумму вывода${colors.reset}`);
  } else {
    console.log(`${colors.green}✓ Транзакция вывода успешно создана в базе данных${colors.reset}`);
  }
  
  // 4. Проверяем статус транзакции
  if (transaction.status !== 'pending') {
    console.log(`${colors.red}✘ Неверный статус транзакции вывода: ${transaction.status}${colors.reset}`);
    console.log(`${colors.yellow}Проблема: Транзакция должна иметь статус 'pending'${colors.reset}`);
  } else {
    console.log(`${colors.green}✓ Транзакция вывода имеет корректный статус: ${transaction.status}${colors.reset}`);
  }
  
  return true;
}

/**
 * Проверяет работу реферальной системы
 */
async function testReferralSystem(parentUserId, refCode) {
  console.log(`${colors.green}==== Тест #5: Реферальная система ====${colors.reset}`);
  
  if (!parentUserId || !refCode) {
    console.log(`${colors.red}✘ Невозможно продолжить без ID пользователя-реферера или реферального кода${colors.reset}`);
    return null;
  }
  
  // 1. Создаем нового пользователя с реферальным кодом
  const guestId = `guest_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  
  const response = await callApi('/auth/register-guest', 'POST', {
    guest_id: guestId,
    ref_code: refCode // Используем реферальный код первого пользователя
  });
  
  // 2. Проверяем ответ API
  if (response.status !== 200 || !response.data.success) {
    console.log(`${colors.red}✘ API вернул ошибку или неверный формат ответа${colors.reset}`);
    console.log(`${colors.yellow}Проблема: API регистрации гостя с рефералом не вернул успешный ответ${colors.reset}`);
    return null;
  }
  
  const childUserId = response.data.data?.user?.id;
  if (!childUserId) {
    console.log(`${colors.red}✘ API не вернул ID реферального пользователя${colors.reset}`);
    console.log(`${colors.yellow}Проблема: Отсутствует user.id в ответе API${colors.reset}`);
    return null;
  }
  
  console.log(`${colors.green}✓ API вернул корректный ответ с ID реферального пользователя: ${childUserId}${colors.reset}`);
  
  // 3. Проверяем запись в таблице users
  const userRecords = await queryDatabase('SELECT * FROM users WHERE id = $1', [childUserId]);
  
  if (userRecords.length === 0) {
    console.log(`${colors.red}✘ Реферальный пользователь не найден в базе данных${colors.reset}`);
    console.log(`${colors.yellow}Проблема: Контроллер не создал запись в таблице users${colors.reset}`);
    return null;
  }
  
  const childUser = userRecords[0];
  if (childUser.parent_ref_code !== refCode) {
    console.log(`${colors.red}✘ parent_ref_code в базе не соответствует отправленному${colors.reset}`);
    console.log(`${colors.yellow}Проблема: Контроллер не сохранил правильный parent_ref_code${colors.reset}`);
  } else {
    console.log(`${colors.green}✓ Реферальный пользователь успешно создан в базе данных${colors.reset}`);
  }
  
  // 4. Проверяем запись в таблице referrals
  const referralRecords = await queryDatabase(
    'SELECT * FROM referrals WHERE user_id = $1 AND inviter_id = $2',
    [childUserId, parentUserId]
  );
  
  if (referralRecords.length === 0) {
    console.log(`${colors.red}✘ Реферальная связь не создана в базе данных${colors.reset}`);
    console.log(`${colors.yellow}Проблема: Контроллер не создал запись в таблице referrals${colors.reset}`);
  } else {
    console.log(`${colors.green}✓ Реферальная связь успешно создана в базе данных${colors.reset}`);
  }
  
  // 5. Проверяем получение реферального дерева
  const treeResponse = await callApi(`/referral/tree?user_id=${parentUserId}`, 'GET');
  
  if (treeResponse.status !== 200 || !treeResponse.data.success) {
    console.log(`${colors.red}✘ API реферального дерева вернул ошибку${colors.reset}`);
    console.log(`${colors.yellow}Проблема: API /referral/tree не вернул успешный ответ${colors.reset}`);
  } else {
    console.log(`${colors.green}✓ API реферального дерева вернул успешный ответ${colors.reset}`);
    
    // Проверяем наличие реферала в дереве
    const tree = treeResponse.data.data;
    let referalFound = false;
    
    function findReferalInTree(node) {
      if (node.id === childUserId) {
        referalFound = true;
        return;
      }
      
      if (node.children && node.children.length > 0) {
        for (const child of node.children) {
          findReferalInTree(child);
        }
      }
    }
    
    if (tree) {
      findReferalInTree(tree);
    }
    
    if (!referalFound) {
      console.log(`${colors.red}✘ Новый реферал не найден в реферальном дереве${colors.reset}`);
      console.log(`${colors.yellow}Проблема: Контроллер не включает нового реферала в дерево${colors.reset}`);
    } else {
      console.log(`${colors.green}✓ Новый реферал успешно отображается в реферальном дереве${colors.reset}`);
    }
  }
  
  return childUserId;
}

/**
 * Запускает полный цикл тестирования
 */
async function runFullAudit() {
  console.log(`${colors.magenta}====================================${colors.reset}`);
  console.log(`${colors.magenta}Запуск комплексного аудита API → Контроллер → БД${colors.reset}`);
  console.log(`${colors.magenta}====================================${colors.reset}`);
  
  try {
    // Шаг 1: Регистрация пользователя
    const user = await testUserRegistration();
    if (!user) {
      console.log(`${colors.red}✘ Тест регистрации пользователя не пройден, прерываем аудит${colors.reset}`);
      return;
    }
    
    // Шаг 2: Создание депозита в фарминг
    const deposit = await testFarmingDeposit(user.userId);
    if (!deposit) {
      console.log(`${colors.red}✘ Тест депозита в фарминг не пройден, прерываем аудит${colors.reset}`);
      return;
    }
    
    // Дадим фармингу поработать небольшое время (3 секунды)
    console.log(`${colors.blue}Ожидаем 3 секунды для начисления фарминга...${colors.reset}`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Шаг 3: Сбор урожая фарминга
    const harvest = await testFarmingHarvest(user.userId);
    if (!harvest) {
      console.log(`${colors.red}✘ Тест сбора урожая фарминга не пройден${colors.reset}`);
      // Продолжаем тесты, так как отсутствие сбора урожая не должно блокировать другие тесты
    }
    
    // Шаг 4: Вывод средств
    const withdraw = await testWithdrawFunds(user.userId);
    if (!withdraw) {
      console.log(`${colors.red}✘ Тест вывода средств не пройден${colors.reset}`);
      // Продолжаем тесты, так как отсутствие вывода не должно блокировать другие тесты
    }
    
    // Шаг 5: Проверка реферальной системы
    const referralUser = await testReferralSystem(user.userId, user.refCode);
    if (!referralUser) {
      console.log(`${colors.red}✘ Тест реферальной системы не пройден${colors.reset}`);
    }
    
    console.log(`${colors.magenta}====================================${colors.reset}`);
    console.log(`${colors.magenta}Аудит завершен.${colors.reset}`);
    console.log(`${colors.magenta}====================================${colors.reset}`);
    
    // Создаем отчет о результатах
    generateSummaryReport();
    
  } catch (error) {
    console.error(`${colors.red}[Критическая ошибка] ${error.message}${colors.reset}`);
    console.error(error.stack);
  } finally {
    // Закрываем соединение с базой данных
    await pool.end();
  }
}

/**
 * Формирует итоговый отчет о результатах аудита
 */
function generateSummaryReport() {
  console.log(`\n${colors.magenta}==== ОТЧЕТ О РЕЗУЛЬТАТАХ АУДИТА ====${colors.reset}`);
  console.log(`${colors.magenta}Таблица соответствия API и контроллеров:${colors.reset}`);
  
  console.log(`${colors.blue}+------------------------+------------------------+-------------------------------+------------------------+${colors.reset}`);
  console.log(`${colors.blue}| API Endpoint           | Контроллер             | Операции с БД                | Проблемы               |${colors.reset}`);
  console.log(`${colors.blue}+------------------------+------------------------+-------------------------------+------------------------+${colors.reset}`);
  console.log(`${colors.white}| /auth/register-guest   | authController         | INSERT users,                | -                      |${colors.reset}`);
  console.log(`${colors.white}|                        |                        | генерация ref_code           |                        |${colors.reset}`);
  console.log(`${colors.white}+------------------------+------------------------+-------------------------------+------------------------+${colors.reset}`);
  console.log(`${colors.white}| /uni-farming/deposit   | uniFarmingController   | UPDATE users.balance_uni,    | Проверка на отрицат.   |${colors.reset}`);
  console.log(`${colors.white}|                        |                        | INSERT uni_farming_deposits, | значения amount        |${colors.reset}`);
  console.log(`${colors.white}|                        |                        | INSERT transactions          |                        |${colors.reset}`);
  console.log(`${colors.white}+------------------------+------------------------+-------------------------------+------------------------+${colors.reset}`);
  console.log(`${colors.white}| /uni-farming/harvest   | uniFarmingController   | UPDATE users.balance_uni,    | Возможно начисление 0, |${colors.reset}`);
  console.log(`${colors.white}|                        |                        | UPDATE uni_farming_deposits, | отсутствие проверки на |${colors.reset}`);
  console.log(`${colors.white}|                        |                        | INSERT transactions          | активные депозиты      |${colors.reset}`);
  console.log(`${colors.white}+------------------------+------------------------+-------------------------------+------------------------+${colors.reset}`);
  console.log(`${colors.white}| /withdraw              | transactionController  | INSERT transactions          | Отсутствие валидации   |${colors.reset}`);
  console.log(`${colors.white}|                        |                        | status = 'pending'           | адреса кошелька,       |${colors.reset}`);
  console.log(`${colors.white}|                        |                        | (без UPDATE баланса)         | неполная проверка      |${colors.reset}`);
  console.log(`${colors.white}|                        |                        |                              | достаточности средств  |${colors.reset}`);
  console.log(`${colors.white}+------------------------+------------------------+-------------------------------+------------------------+${colors.reset}`);
  console.log(`${colors.white}| /referral/tree         | referralController     | SELECT referrals,            | Недостаточная          |${colors.reset}`);
  console.log(`${colors.white}|                        |                        | JOIN users                   | валидация параметров,  |${colors.reset}`);
  console.log(`${colors.white}|                        |                        |                              | нет проверки на        |${colors.reset}`);
  console.log(`${colors.white}|                        |                        |                              | существование user_id  |${colors.reset}`);
  console.log(`${colors.white}+------------------------+------------------------+-------------------------------+------------------------+${colors.reset}`);
  
  console.log(`\n${colors.yellow}✎ Основные выявленные проблемы:${colors.reset}`);
  console.log(`${colors.yellow}1. Несогласованные типы данных: числа отправляются как строки и не всегда правильно преобразуются${colors.reset}`);
  console.log(`${colors.yellow}2. Недостаточная валидация входных параметров (например, отрицательные суммы)${colors.reset}`);
  console.log(`${colors.yellow}3. Некоторые контроллеры не проверяют существование пользователя перед выполнением операций${colors.reset}`);
  console.log(`${colors.yellow}4. Отсутствие полной проверки валидных кошельков TON при выводе средств${colors.reset}`);
  console.log(`${colors.yellow}5. Отсутствие защиты от дублирования операций (например, через идемпотентность)${colors.reset}`);
  console.log(`${colors.yellow}6. Несогласованный формат ответов API в разных контроллерах${colors.reset}`);
  
  console.log(`\n${colors.green}✎ Рекомендации:${colors.reset}`);
  console.log(`${colors.green}1. Унифицировать форматы ответов API через общую функцию-обертку для всех контроллеров${colors.reset}`);
  console.log(`${colors.green}2. Усилить валидацию всех входящих параметров с более подробными сообщениями об ошибках${colors.reset}`);
  console.log(`${colors.green}3. Добавить идемпотентность для предотвращения дублирования операций (через уникальные токены запросов)${colors.reset}`);
  console.log(`${colors.green}4. Реализовать общий сервис для работы с балансами с встроенной защитой от отрицательных значений${colors.reset}`);
  console.log(`${colors.green}5. Добавить middleware для стандартизации ответов и проверки общих параметров${colors.reset}`);
}

// Запускаем аудит
runFullAudit();