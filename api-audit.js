/**
 * Аудит API эндпоинтов UniFarm
 * 
 * Этот скрипт проверяет состояние всех основных API-эндпоинтов,
 * формируя отчет о результатах тестирования
 */

import fetch from 'node-fetch';

// Базовый URL сервера (используем текущий хост)
const BASE_URL = 'https://uni-farm-connect-x-lukyanenkolawfa.replit.appsisko.replit.dev';
console.log(`Базовый URL для тестирования: ${BASE_URL}`);

// Список эндпоинтов для тестирования
const ENDPOINTS = [
  { method: 'GET', path: '/api/me', description: 'Получение информации о текущем пользователе' },
  { method: 'GET', path: '/api/uni-farming/info', description: 'Получение информации о фарминге UNI', params: { user_id: 1 } },
  { method: 'POST', path: '/api/uni-farming/deposit', description: 'Создание депозита UNI', body: { user_id: 1, amount: "5" } },
  { method: 'GET', path: '/api/uni-farming/deposits', description: 'Получение списка депозитов пользователя', params: { user_id: 1 } },
  { method: 'POST', path: '/api/harvest', description: 'Сбор доходности фарминга', body: { user_id: 1 } },
  { method: 'GET', path: '/api/referral/tree', description: 'Получение структуры рефералов', params: { user_id: 1 } },
  { method: 'POST', path: '/api/airdrop/register', description: 'Регистрация пользователя в airdrop', body: { guest_id: "test-guest-id-" + Math.random().toString(36).substring(2, 10) } },
  { method: 'POST', path: '/api/withdraw', description: 'Запрос на вывод средств', body: { user_id: 1, amount: "1", currency: "UNI", address: "UQDtM3H8YMatbHqQH9nGxnshJJBnzZs1u2qYLiaZXfS6h6bH" } }
];

// Форматирование вывода
const LOG_SEPARATOR = '='.repeat(80);
const LOG_SUBSEPARATOR = '-'.repeat(80);

// Функция для построения URL с параметрами
function buildUrl(path, params) {
  if (!params) return path;
  
  const url = new URL(path, BASE_URL);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });
  
  return url.toString();
}

// Функция тестирования одного эндпоинта
async function testEndpoint(endpoint) {
  console.log(LOG_SEPARATOR);
  console.log(`Тестирование: ${endpoint.method} ${endpoint.path}`);
  console.log(`Описание: ${endpoint.description}`);
  
  const url = buildUrl(endpoint.path, endpoint.params);
  console.log(`URL: ${url}`);
  
  try {
    const options = {
      method: endpoint.method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };
    
    // Добавление тела запроса для POST методов
    if (endpoint.method === 'POST' && endpoint.body) {
      options.body = JSON.stringify(endpoint.body);
      console.log(`Тело запроса: ${options.body}`);
    }
    
    const fullUrl = new URL(url, BASE_URL).toString();
    console.log(`Полный URL: ${fullUrl}`);
    
    const response = await fetch(fullUrl, options);
    const contentType = response.headers.get('content-type') || '';
    
    console.log(`Статус ответа: ${response.status} ${response.statusText}`);
    console.log(`Content-Type: ${contentType}`);
    
    let responseText;
    try {
      responseText = await response.text();
      console.log(`Длина ответа: ${responseText.length} символов`);
      
      // Попытка разобрать JSON
      if (contentType.includes('application/json')) {
        const jsonData = JSON.parse(responseText);
        
        // Проверка структуры ответа
        const hasSuccess = 'success' in jsonData;
        const hasData = 'data' in jsonData;
        
        console.log(`Структура ответа: ${hasSuccess ? '✅' : '❌'} success, ${hasData ? '✅' : '❌'} data`);
        
        if (hasSuccess) {
          console.log(`success: ${jsonData.success}`);
        }
        
        if (hasData) {
          if (typeof jsonData.data === 'object' && jsonData.data !== null) {
            console.log(`data: Объект с ${Object.keys(jsonData.data).length} полями`);
          } else if (Array.isArray(jsonData.data)) {
            console.log(`data: Массив с ${jsonData.data.length} элементами`);
          } else {
            console.log(`data: ${jsonData.data}`);
          }
        }
        
        // Сокращенный вывод JSON
        const jsonString = JSON.stringify(jsonData, null, 2);
        if (jsonString.length > 1000) {
          console.log(`Ответ (сокращено): ${jsonString.substring(0, 1000)}...`);
        } else {
          console.log(`Ответ: ${jsonString}`);
        }
        
        // Итоговый результат
        if (response.status === 200 && hasSuccess && jsonData.success === true) {
          console.log('✅ Результат: API работает корректно');
        } else {
          console.log('⚠️ Результат: API возвращает ошибку или некорректные данные');
        }
      } else {
        console.log('❌ Результат: Ответ не в формате JSON');
        console.log(`Ответ: ${responseText.substring(0, 500)}${responseText.length > 500 ? '...' : ''}`);
      }
    } catch (parseError) {
      console.log(`❌ Ошибка парсинга ответа: ${parseError.message}`);
      console.log(`Ответ (сырой): ${responseText.substring(0, 500)}${responseText.length > 500 ? '...' : ''}`);
    }
  } catch (error) {
    console.log(`❌ Ошибка запроса: ${error.message}`);
  }
}

// Основная функция для запуска аудита
async function runAudit() {
  console.log(LOG_SEPARATOR);
  console.log(`АУДИТ API ЭНДПОИНТОВ UNIFARM`);
  console.log(`Дата и время: ${new Date().toISOString()}`);
  console.log(`Базовый URL: ${BASE_URL}`);
  console.log(`Количество эндпоинтов для тестирования: ${ENDPOINTS.length}`);
  console.log(LOG_SEPARATOR);
  
  for (const endpoint of ENDPOINTS) {
    await testEndpoint(endpoint);
    console.log(LOG_SUBSEPARATOR);
  }
  
  console.log(LOG_SEPARATOR);
  console.log('АУДИТ ЗАВЕРШЕН');
  console.log(LOG_SEPARATOR);
}

// Запуск аудита
runAudit().catch(error => {
  console.error('Ошибка при выполнении аудита:', error);
});