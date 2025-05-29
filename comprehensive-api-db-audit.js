/**
 * Комплексная проверка API и согласованности с базой данных UniFarm
 * 
 * Этот скрипт проводит углубленный анализ взаимодействия API с базой данных,
 * тестирует граничные случаи и проверяет целостность данных
 */

import fetch from 'node-fetch';

// Базовый URL сервера
const BASE_URL = 'https://uni-farm-connect-x-lukyanenkolawfa.replit.appsisko.replit.dev';
console.log(`Базовый URL для тестирования: ${BASE_URL}`);

// Форматирование вывода
const LOG_SEPARATOR = '='.repeat(80);
const LOG_SUBSEPARATOR = '-'.repeat(80);

// Тестовые данные
const TEST_DATA = {
  userId: 1, // Существующий пользователь
  nonExistentUserId: 999999, // Несуществующий пользователь
  invalidUserId: 'abc', // Невалидный формат ID
  // Различные суммы для депозита фарминга
  depositAmounts: {
    normal: '5',
    huge: '10000', 
    tiny: '0.0001',
    zero: '0',
    negative: '-5',
    invalid: 'abc',
    asNumber: 5 // Числовое значение для проверки преобразования типа
  },
  // Тестовые данные для регистрации
  guestId: `test-guest-id-${Math.random().toString(36).substring(2, 10)}`,
  // Тестовые данные для операций вывода
  withdrawAmount: '1',
  withdrawCurrency: 'UNI',
  walletAddress: 'UQDtM3H8YMatbHqQH9nGxnshJJBnzZs1u2qYLiaZXfS6h6bH'
};

// Группы тестовых сценариев
const TEST_SCENARIOS = [
  // 1. Базовые тесты работоспособности API
  {
    name: 'Базовые тесты API',
    tests: [
      {
        name: 'Получение информации о пользователе',
        endpoint: '/api/me',
        method: 'GET',
        expectedStatus: 200
      },
      {
        name: 'Получение информации о фарминге',
        endpoint: '/api/uni-farming/info',
        method: 'GET',
        params: { user_id: TEST_DATA.userId },
        expectedStatus: 200
      }
    ]
  },
  
  // 2. Тесты создания депозита
  {
    name: 'Тесты создания депозита',
    tests: [
      {
        name: 'Создание депозита со стандартной суммой',
        endpoint: '/api/uni-farming/deposit',
        method: 'POST',
        body: { user_id: TEST_DATA.userId, amount: TEST_DATA.depositAmounts.normal },
        expectedStatus: 200,
        validator: (response) => {
          return response.success === true && 
                 response.data.depositAmount === TEST_DATA.depositAmounts.normal;
        }
      },
      {
        name: 'Создание депозита с числовым amount',
        endpoint: '/api/uni-farming/deposit',
        method: 'POST',
        body: { user_id: TEST_DATA.userId, amount: TEST_DATA.depositAmounts.asNumber },
        expectedStatus: 200,
        validator: (response) => {
          return response.success === true && 
                 response.data.depositAmount === String(TEST_DATA.depositAmounts.asNumber);
        }
      },
      {
        name: 'Создание депозита с нулевой суммой',
        endpoint: '/api/uni-farming/deposit',
        method: 'POST',
        body: { user_id: TEST_DATA.userId, amount: TEST_DATA.depositAmounts.zero },
        expectedStatus: 400, // Ожидаем ошибку при нулевой сумме
      },
      {
        name: 'Создание депозита с отрицательной суммой',
        endpoint: '/api/uni-farming/deposit',
        method: 'POST',
        body: { user_id: TEST_DATA.userId, amount: TEST_DATA.depositAmounts.negative },
        expectedStatus: 400, // Ожидаем ошибку при отрицательной сумме
      },
      {
        name: 'Создание депозита с невалидной суммой',
        endpoint: '/api/uni-farming/deposit',
        method: 'POST',
        body: { user_id: TEST_DATA.userId, amount: TEST_DATA.depositAmounts.invalid },
        expectedStatus: 400, // Ожидаем ошибку при невалидной сумме
      }
    ]
  },
  
  // 3. Тесты харвеста (сбора наград)
  {
    name: 'Тесты харвеста фарминга',
    tests: [
      {
        name: 'Сбор наград фарминга для существующего пользователя',
        endpoint: '/api/harvest',
        method: 'POST',
        body: { user_id: TEST_DATA.userId },
        expectedStatus: 200
      },
      {
        name: 'Сбор наград фарминга для несуществующего пользователя',
        endpoint: '/api/harvest',
        method: 'POST',
        body: { user_id: TEST_DATA.nonExistentUserId },
        expectedStatus: 404 // Ожидаем ошибку 404 для несуществующего пользователя
      }
    ]
  },
  
  // 4. Тесты работы с депозитами
  {
    name: 'Тесты работы с депозитами',
    tests: [
      {
        name: 'Получение списка депозитов',
        endpoint: '/api/uni-farming/deposits',
        method: 'GET',
        params: { user_id: TEST_DATA.userId },
        expectedStatus: 200,
        validator: (response) => {
          return response.success === true && 
                 Array.isArray(response.data) && 
                 response.data.length > 0; // Ожидаем непустой массив депозитов
        }
      }
    ]
  },
  
  // 5. Тесты реферальной системы
  {
    name: 'Тесты реферальной системы',
    tests: [
      {
        name: 'Получение реферальной структуры',
        endpoint: '/api/referral/tree',
        method: 'GET',
        params: { user_id: TEST_DATA.userId },
        expectedStatus: 200,
        validator: (response) => {
          return response.success === true && 
                 response.data && 
                 'ownRefCode' in response.data; // Проверяем наличие ожидаемых полей
        }
      }
    ]
  },
  
  // 6. Тесты AirDrop регистрации
  {
    name: 'Тесты AirDrop регистрации',
    tests: [
      {
        name: 'Регистрация нового пользователя в airdrop',
        endpoint: '/api/airdrop/register',
        method: 'POST',
        body: { guest_id: TEST_DATA.guestId },
        expectedStatus: 200,
        validator: (response) => {
          return response.success === true && 
                 response.data.guest_id === TEST_DATA.guestId &&
                 response.data.is_new_user === true;
        }
      },
      {
        name: 'Повторная регистрация существующего пользователя в airdrop',
        endpoint: '/api/airdrop/register',
        method: 'POST',
        body: { guest_id: TEST_DATA.guestId },
        expectedStatus: 200,
        validator: (response) => {
          return response.success === true && 
                 response.data.guest_id === TEST_DATA.guestId &&
                 response.data.is_new_user === false; // Второй раз - это уже не новый пользователь
        }
      }
    ]
  },
  
  // 7. Тесты операций вывода
  {
    name: 'Тесты операций вывода',
    tests: [
      {
        name: 'Запрос на вывод средств',
        endpoint: '/api/withdraw',
        method: 'POST',
        body: { 
          user_id: TEST_DATA.userId, 
          amount: TEST_DATA.withdrawAmount, 
          currency: TEST_DATA.withdrawCurrency,
          address: TEST_DATA.walletAddress
        },
        expectedStatus: 200,
        validator: (response) => {
          return response.success === true && 
                 response.data && 
                 'transaction_id' in response.data; // Проверяем наличие ID транзакции
        }
      },
      {
        name: 'Запрос на вывод с отрицательной суммой',
        endpoint: '/api/withdraw',
        method: 'POST',
        body: { 
          user_id: TEST_DATA.userId, 
          amount: TEST_DATA.depositAmounts.negative, 
          currency: TEST_DATA.withdrawCurrency,
          address: TEST_DATA.walletAddress
        },
        expectedStatus: 400 // Ожидаем ошибку при отрицательной сумме
      }
    ]
  },
  
  // 8. Проверка граничных случаев и обработки ошибок
  {
    name: 'Граничные случаи и обработка ошибок',
    tests: [
      {
        name: 'Отсутствие обязательных параметров',
        endpoint: '/api/uni-farming/deposit',
        method: 'POST',
        body: { user_id: TEST_DATA.userId }, // Отсутствует amount
        expectedStatus: 400 // Ожидаем ошибку о неполных данных
      },
      {
        name: 'Невалидный формат user_id',
        endpoint: '/api/uni-farming/info',
        method: 'GET',
        params: { user_id: TEST_DATA.invalidUserId },
        expectedStatus: 400 // Ожидаем ошибку валидации
      },
      {
        name: 'Проверка защиты от SQL-инъекций',
        endpoint: '/api/uni-farming/info',
        method: 'GET',
        params: { user_id: "1 OR 1=1" },
        expectedStatus: 400 // Ожидаем блокировку невалидного запроса
      },
      {
        name: 'Запрос к несуществующему API',
        endpoint: '/api/non-existent-endpoint',
        method: 'GET',
        expectedStatus: 404 // Ожидаем 404 Not Found
      }
    ]
  }
];

// Функция для построения URL с параметрами
function buildUrl(path, params) {
  if (!params) return path;
  
  const url = new URL(path, BASE_URL);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });
  
  return url.toString();
}

// Функция для выполнения теста
async function runTest(test) {
  console.log(`\nТест: ${test.name}`);
  
  const url = buildUrl(test.endpoint, test.params);
  console.log(`URL: ${url}`);
  
  try {
    const options = {
      method: test.method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };
    
    // Добавление тела запроса для POST и PUT
    if ((test.method === 'POST' || test.method === 'PUT') && test.body) {
      options.body = JSON.stringify(test.body);
      console.log(`Тело запроса: ${options.body}`);
    }
    
    const fullUrl = new URL(url, BASE_URL).toString();
    
    const response = await fetch(fullUrl, options);
    const contentType = response.headers.get('content-type') || '';
    
    console.log(`Статус ответа: ${response.status} ${response.statusText}`);
    console.log(`Content-Type: ${contentType}`);
    
    let responseData;
    let success = false;
    let validatorResult = true;
    
    try {
      const responseText = await response.text();
      
      // Пытаемся разобрать JSON для дальнейшего анализа
      if (contentType.includes('application/json')) {
        responseData = JSON.parse(responseText);
        
        // Проверка ожидаемого статуса
        if (response.status === test.expectedStatus) {
          // Запускаем дополнительную валидацию, если она определена
          if (test.validator && typeof test.validator === 'function') {
            validatorResult = test.validator(responseData);
            if (!validatorResult) {
              console.log('❌ Валидатор данных вернул отрицательный результат');
            }
          }
          
          success = validatorResult;
        } else {
          console.log(`❌ Ожидался статус ${test.expectedStatus}, получен ${response.status}`);
        }
        
        // Сокращенный вывод JSON
        const jsonString = JSON.stringify(responseData, null, 2);
        if (jsonString.length > 500) {
          console.log(`Ответ (сокращено): ${jsonString.substring(0, 500)}...`);
        } else {
          console.log(`Ответ: ${jsonString}`);
        }
      } else {
        console.log('❌ Ответ не в формате JSON');
        console.log(`Ответ: ${responseText.substring(0, 500)}${responseText.length > 500 ? '...' : ''}`);
      }
    } catch (parseError) {
      console.log(`❌ Ошибка парсинга ответа: ${parseError.message}`);
    }
    
    return {
      name: test.name,
      endpoint: test.endpoint,
      method: test.method,
      status: response.status,
      expectedStatus: test.expectedStatus,
      success: success,
      response: responseData
    };
  } catch (error) {
    console.log(`❌ Ошибка запроса: ${error.message}`);
    return {
      name: test.name,
      endpoint: test.endpoint,
      method: test.method,
      error: error.message,
      success: false
    };
  }
}

// Функция запуска сценария тестирования
async function runScenario(scenario) {
  console.log(LOG_SEPARATOR);
  console.log(`Сценарий: ${scenario.name}`);
  console.log(LOG_SEPARATOR);
  
  const results = [];
  
  for (const test of scenario.tests) {
    const result = await runTest(test);
    results.push(result);
    console.log(LOG_SUBSEPARATOR);
  }
  
  return results;
}

// Основная функция для запуска всех тестов
async function runAllTests() {
  console.log(LOG_SEPARATOR);
  console.log(`КОМПЛЕКСНЫЙ АУДИТ API И БД UNIFARM`);
  console.log(`Дата и время: ${new Date().toISOString()}`);
  console.log(`Базовый URL: ${BASE_URL}`);
  console.log(`Количество сценариев: ${TEST_SCENARIOS.length}`);
  console.log(LOG_SEPARATOR);
  
  const allResults = [];
  
  for (const scenario of TEST_SCENARIOS) {
    const scenarioResults = await runScenario(scenario);
    allResults.push({
      name: scenario.name,
      results: scenarioResults
    });
  }
  
  // Сводный отчет
  console.log(LOG_SEPARATOR);
  console.log('СВОДНЫЙ ОТЧЕТ');
  console.log(LOG_SEPARATOR);
  
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  
  for (const scenario of allResults) {
    let scenarioPass = 0;
    let scenarioFail = 0;
    
    for (const result of scenario.results) {
      if (result.success) {
        scenarioPass++;
        passedTests++;
      } else {
        scenarioFail++;
        failedTests++;
      }
      totalTests++;
    }
    
    console.log(`${scenario.name}: Пройдено ${scenarioPass}/${scenarioPass + scenarioFail} тестов`);
  }
  
  console.log(LOG_SEPARATOR);
  console.log(`Всего тестов: ${totalTests}`);
  console.log(`Пройдено: ${passedTests} (${Math.round(passedTests / totalTests * 100)}%)`);
  console.log(`Не пройдено: ${failedTests} (${Math.round(failedTests / totalTests * 100)}%)`);
  console.log(LOG_SEPARATOR);
  
  // Подробная информация о провалившихся тестах
  if (failedTests > 0) {
    console.log('ДЕТАЛИ ПРОВАЛЕННЫХ ТЕСТОВ:');
    console.log(LOG_SEPARATOR);
    
    for (const scenario of allResults) {
      for (const result of scenario.results) {
        if (!result.success) {
          console.log(`Сценарий: ${scenario.name}`);
          console.log(`Тест: ${result.name}`);
          console.log(`Эндпоинт: ${result.method} ${result.endpoint}`);
          
          if (result.error) {
            console.log(`Ошибка: ${result.error}`);
          } else if (result.status !== result.expectedStatus) {
            console.log(`Ожидался статус: ${result.expectedStatus}, получен: ${result.status}`);
          } else {
            console.log(`Проверка данных не прошла`);
          }
          
          if (result.response) {
            console.log(`Ответ: ${JSON.stringify(result.response, null, 2).substring(0, 300)}...`);
          }
          
          console.log(LOG_SUBSEPARATOR);
        }
      }
    }
  }
  
  return {
    totalTests,
    passedTests,
    failedTests,
    scenarios: allResults
  };
}

// Запуск тестов
runAllTests().catch(error => {
  console.error('Ошибка при выполнении тестов:', error);
});