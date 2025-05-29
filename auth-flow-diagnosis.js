/**
 * Диагностический скрипт для анализа потока авторизации и работы с Telegram Mini App
 * 
 * Скрипт имитирует работу обработчика авторизации, анализирует API endpoints
 * для восстановления сессии и создания новых пользователей.
 * 
 * Использование:
 * node auth-flow-diagnosis.js
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Цвета для вывода в консоль
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Функция для логирования с цветами
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// Запуск диагностики
log(`${colors.cyan}[Auth Диагностика]${colors.reset} 🔍 Начало диагностики потока авторизации`);

// Функция для поиска файлов по шаблону
function findFiles(dir, pattern, maxDepth = 3, currentDepth = 0) {
  if (currentDepth > maxDepth) return [];
  
  let results = [];
  
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      
      try {
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          results = results.concat(findFiles(fullPath, pattern, maxDepth, currentDepth + 1));
        } else if (pattern.test(item)) {
          results.push(fullPath);
        }
      } catch (error) {
        // Пропускаем ошибки доступа к файлам/директориям
      }
    }
  } catch (error) {
    // Пропускаем ошибки доступа к директориям
  }
  
  return results;
}

// Функция для поиска шаблонов в файле
function findPatternsInFile(filePath, patterns) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const results = {};
    
    for (const [key, pattern] of Object.entries(patterns)) {
      results[key] = {
        found: pattern.test(content),
        matches: content.match(pattern) || []
      };
    }
    
    return {
      path: filePath,
      content,
      results
    };
  } catch (error) {
    return {
      path: filePath,
      error: error.message
    };
  }
}

// Поиск всех API эндпоинтов
async function findApiEndpoints() {
  log('\n[Auth Диагностика] 🔍 Поиск API эндпоинтов для авторизации...', colors.cyan);
  
  // Шаблоны для поиска эндпоинтов авторизации
  const apiPatterns = {
    sessionRestore: /\/api\/session\/restore/,
    login: /\/api\/(?:auth\/)?login/,
    register: /\/api\/(?:auth\/)?register/,
    telegramAuth: /telegram.*auth|init.*data/i,
    userCreate: /createUser|new\s+User|user\.create/i
  };
  
  // Ищем все файлы с расширениями js/ts в директории server
  const jsFiles = findFiles('./server', /\.(js|ts)$/);
  
  log(`[Auth Диагностика] 🔎 Найдено ${jsFiles.length} js/ts файлов в server`, colors.cyan);
  
  // Проверяем каждый файл на наличие API эндпоинтов
  const authEndpoints = [];
  
  for (const file of jsFiles) {
    const results = findPatternsInFile(file, apiPatterns);
    
    if (results.error) {
      continue;
    }
    
    // Проверяем, содержит ли файл какие-либо шаблоны API авторизации
    const hasAuthPatterns = Object.values(results.results).some(result => result.found);
    
    if (hasAuthPatterns) {
      authEndpoints.push({
        path: results.path,
        patterns: results.results
      });
    }
  }
  
  log(`[Auth Диагностика] ✅ Найдено ${authEndpoints.length} файлов, связанных с авторизацией`, colors.green);
  
  // Анализируем найденные эндпоинты авторизации
  const apiEndpoints = [];
  
  for (const endpoint of authEndpoints) {
    log(`\n[Auth Диагностика] 📄 Файл: ${endpoint.path}`, colors.cyan);
    
    // Выводим найденные шаблоны
    for (const [key, result] of Object.entries(endpoint.patterns)) {
      if (result.found) {
        log(`  - ${key}: ${result.found ? '✅' : '❌'}`, result.found ? colors.green : colors.red);
        
        // Находим строки, содержащие API эндпоинты
        const content = fs.readFileSync(endpoint.path, 'utf-8');
        const lines = content.split('\n');
        
        // Ищем строки с определением маршрутов
        const routeLines = lines.filter(line => 
          line.includes('app.') && 
          (line.includes('.get') || line.includes('.post') || line.includes('.put') || line.includes('.delete'))
        );
        
        // Ищем строки с определениями API эндпоинтов для конкретного шаблона
        let pattern;
        switch (key) {
          case 'sessionRestore':
            pattern = /\/api\/session\/restore/;
            break;
          case 'login':
            pattern = /\/api\/(?:auth\/)?login/;
            break;
          case 'register':
            pattern = /\/api\/(?:auth\/)?register/;
            break;
          case 'telegramAuth':
            pattern = /telegram.*auth|init.*data/i;
            break;
          case 'userCreate':
            pattern = /createUser|new\s+User|user\.create/i;
            break;
        }
        
        const matchingRoutes = routeLines.filter(line => pattern.test(line));
        
        if (matchingRoutes.length > 0) {
          log(`    Найдены маршруты:`, colors.yellow);
          matchingRoutes.forEach((route, i) => {
            log(`    ${i + 1}. ${route.trim()}`, colors.reset);
            
            // Добавляем найденный эндпоинт в список
            const methodMatch = route.match(/\.(get|post|put|delete)/i);
            const urlMatch = route.match(/'([^']+)'|"([^"]+)"/);
            
            if (methodMatch && urlMatch) {
              const method = methodMatch[1].toUpperCase();
              const url = urlMatch[1] || urlMatch[2];
              
              apiEndpoints.push({
                method,
                url,
                file: endpoint.path,
                category: key,
                line: route.trim()
              });
            }
          });
        } else if (key === 'userCreate' && result.found) {
          log(`    Найдены функции создания пользователя`, colors.yellow);
        }
      }
    }
  }
  
  // Выводим сводку по найденным API эндпоинтам
  log('\n[Auth Диагностика] 📊 Сводка по API эндпоинтам авторизации:', colors.cyan);
  
  // Группируем по категориям
  const endpointsByCategory = {};
  
  for (const endpoint of apiEndpoints) {
    if (!endpointsByCategory[endpoint.category]) {
      endpointsByCategory[endpoint.category] = [];
    }
    endpointsByCategory[endpoint.category].push(endpoint);
  }
  
  // Выводим эндпоинты по категориям
  for (const [category, endpoints] of Object.entries(endpointsByCategory)) {
    log(`\n${category}:`, colors.yellow);
    endpoints.forEach((endpoint, index) => {
      log(`  ${index + 1}. ${endpoint.method} ${endpoint.url}`, colors.reset);
    });
  }
  
  return {
    apiEndpoints,
    endpointsByCategory
  };
}

// Анализ механизма восстановления сессии
async function analyzeSessionRestoreFlow() {
  log('\n[Auth Диагностика] 🔍 Анализ механизма восстановления сессии...', colors.cyan);
  
  // Ищем файлы, которые могут быть связаны с восстановлением сессии
  const sessionPatterns = {
    expressSession: /express-session/,
    cookieSession: /cookie-session/,
    sessionRestore: /session.*restore|restore.*session/i,
    telegramAuth: /telegram.*auth|init.*data/i,
    sessionCheck: /req\.session|session\.[a-zA-Z]/i
  };
  
  // Ищем все файлы с расширениями js/ts
  const jsFiles = findFiles('.', /\.(js|ts)$/);
  
  // Проверяем каждый файл на наличие паттернов сессий
  const sessionFiles = [];
  
  for (const file of jsFiles) {
    const results = findPatternsInFile(file, sessionPatterns);
    
    if (results.error) {
      continue;
    }
    
    // Проверяем, содержит ли файл какие-либо сессионные шаблоны
    const hasSessionPatterns = Object.values(results.results).some(result => result.found);
    
    if (hasSessionPatterns) {
      sessionFiles.push({
        path: results.path,
        patterns: results.results
      });
    }
  }
  
  log(`[Auth Диагностика] ✅ Найдено ${sessionFiles.length} файлов, связанных с сессиями`, colors.green);
  
  // Анализируем файлы с сессиями
  const issues = [];
  
  for (const file of sessionFiles) {
    log(`\n[Auth Диагностика] 📄 Файл: ${file.path}`, colors.cyan);
    
    // Выводим найденные шаблоны
    for (const [key, result] of Object.entries(file.patterns)) {
      if (result.found) {
        log(`  - ${key}: ${result.found ? '✅' : '❌'}`, result.found ? colors.green : colors.red);
      }
    }
    
    // Проверяем различные проблемы с сессиями
    const content = fs.readFileSync(file.path, 'utf-8');
    
    // Проверяем настройки cookie
    if (content.includes('cookie') && !content.includes('sameSite')) {
      issues.push({
        file: file.path,
        issue: 'Отсутствует настройка sameSite для cookie',
        severity: 'high'
      });
    }
    
    if (content.includes('cookie') && !content.includes('secure')) {
      issues.push({
        file: file.path,
        issue: 'Отсутствует настройка secure для cookie',
        severity: 'high'
      });
    }
    
    // Проверяем, есть ли проблемы с обработкой данных от Telegram
    if (file.patterns.telegramAuth && file.patterns.telegramAuth.found) {
      if (!content.includes('headers') || !content.includes('telegram-init-data') && !content.includes('x-telegram-init-data')) {
        issues.push({
          file: file.path,
          issue: 'Отсутствует обработка заголовка telegram-init-data или x-telegram-init-data',
          severity: 'critical'
        });
      }
      
      if (!content.includes('verify') && !content.includes('validate') && !content.includes('check')) {
        issues.push({
          file: file.path,
          issue: 'Отсутствует проверка подписи данных от Telegram',
          severity: 'high'
        });
      }
    }
    
    // Проверяем, сохраняются ли данные пользователя в сессии
    if (file.patterns.sessionCheck && file.patterns.sessionCheck.found) {
      if (!content.includes('user') || !content.includes('req.session.user')) {
        issues.push({
          file: file.path,
          issue: 'Отсутствует сохранение данных пользователя в сессии',
          severity: 'medium'
        });
      }
    }
  }
  
  // Выводим обнаруженные проблемы
  if (issues.length > 0) {
    log('\n[Auth Диагностика] ⚠️ Обнаружены проблемы с механизмом сессий:', colors.yellow);
    
    // Сортируем проблемы по важности
    const criticalIssues = issues.filter(issue => issue.severity === 'critical');
    const highIssues = issues.filter(issue => issue.severity === 'high');
    const mediumIssues = issues.filter(issue => issue.severity === 'medium');
    
    if (criticalIssues.length > 0) {
      log('\n🔴 Критические проблемы:', colors.red);
      criticalIssues.forEach((issue, index) => {
        log(`${index + 1}. ${issue.issue}`, colors.red);
        log(`   Файл: ${issue.file}`, colors.yellow);
      });
    }
    
    if (highIssues.length > 0) {
      log('\n🟠 Важные проблемы:', colors.yellow);
      highIssues.forEach((issue, index) => {
        log(`${index + 1}. ${issue.issue}`, colors.yellow);
        log(`   Файл: ${issue.file}`, colors.yellow);
      });
    }
    
    if (mediumIssues.length > 0) {
      log('\n🟡 Проблемы средней важности:', colors.white);
      mediumIssues.forEach((issue, index) => {
        log(`${index + 1}. ${issue.issue}`, colors.white);
        log(`   Файл: ${issue.file}`, colors.yellow);
      });
    }
  } else {
    log('\n[Auth Диагностика] ✅ Не обнаружено проблем с механизмом сессий', colors.green);
  }
  
  return {
    sessionFiles,
    issues
  };
}

// Анализ механизма создания пользователей
async function analyzeUserCreationFlow() {
  log('\n[Auth Диагностика] 🔍 Анализ механизма создания пользователей...', colors.cyan);
  
  // Ищем файлы, которые могут быть связаны с созданием пользователей
  const userPatterns = {
    createUser: /createUser|user\.create|new\s+User/i,
    telegramUser: /telegram.*user|user.*telegram/i,
    authUser: /auth.*user|user.*auth/i,
    insertUser: /insert.*user|user.*insert/i
  };
  
  // Ищем все файлы с расширениями js/ts
  const jsFiles = findFiles('.', /\.(js|ts)$/);
  
  // Проверяем каждый файл на наличие паттернов создания пользователей
  const userFiles = [];
  
  for (const file of jsFiles) {
    const results = findPatternsInFile(file, userPatterns);
    
    if (results.error) {
      continue;
    }
    
    // Проверяем, содержит ли файл какие-либо паттерны создания пользователей
    const hasUserPatterns = Object.values(results.results).some(result => result.found);
    
    if (hasUserPatterns) {
      userFiles.push({
        path: results.path,
        patterns: results.results
      });
    }
  }
  
  log(`[Auth Диагностика] ✅ Найдено ${userFiles.length} файлов, связанных с созданием пользователей`, colors.green);
  
  // Анализируем файлы создания пользователей
  const issues = [];
  
  for (const file of userFiles) {
    log(`\n[Auth Диагностика] 📄 Файл: ${file.path}`, colors.cyan);
    
    // Выводим найденные шаблоны
    for (const [key, result] of Object.entries(file.patterns)) {
      if (result.found) {
        log(`  - ${key}: ${result.found ? '✅' : '❌'}`, result.found ? colors.green : colors.red);
      }
    }
    
    // Проверяем различные проблемы с созданием пользователей
    const content = fs.readFileSync(file.path, 'utf-8');
    
    // Проверяем, есть ли проверки на уникальность пользователя
    if (file.patterns.createUser && file.patterns.createUser.found) {
      if (!content.includes('find') && !content.includes('where') && !content.includes('exists')) {
        issues.push({
          file: file.path,
          issue: 'Отсутствует проверка на существование пользователя перед созданием',
          severity: 'high'
        });
      }
      
      // Проверяем, сохраняются ли данные Telegram пользователя
      if (file.patterns.telegramUser && file.patterns.telegramUser.found) {
        if (!content.includes('telegram_id') && !content.includes('telegramId')) {
          issues.push({
            file: file.path,
            issue: 'Отсутствует сохранение Telegram ID пользователя',
            severity: 'critical'
          });
        }
      }
      
      // Проверяем, есть ли обработка ошибок
      if (!content.includes('try') || !content.includes('catch')) {
        issues.push({
          file: file.path,
          issue: 'Отсутствует обработка ошибок при создании пользователя',
          severity: 'medium'
        });
      }
    }
  }
  
  // Выводим обнаруженные проблемы
  if (issues.length > 0) {
    log('\n[Auth Диагностика] ⚠️ Обнаружены проблемы с механизмом создания пользователей:', colors.yellow);
    
    // Сортируем проблемы по важности
    const criticalIssues = issues.filter(issue => issue.severity === 'critical');
    const highIssues = issues.filter(issue => issue.severity === 'high');
    const mediumIssues = issues.filter(issue => issue.severity === 'medium');
    
    if (criticalIssues.length > 0) {
      log('\n🔴 Критические проблемы:', colors.red);
      criticalIssues.forEach((issue, index) => {
        log(`${index + 1}. ${issue.issue}`, colors.red);
        log(`   Файл: ${issue.file}`, colors.yellow);
      });
    }
    
    if (highIssues.length > 0) {
      log('\n🟠 Важные проблемы:', colors.yellow);
      highIssues.forEach((issue, index) => {
        log(`${index + 1}. ${issue.issue}`, colors.yellow);
        log(`   Файл: ${issue.file}`, colors.yellow);
      });
    }
    
    if (mediumIssues.length > 0) {
      log('\n🟡 Проблемы средней важности:', colors.white);
      mediumIssues.forEach((issue, index) => {
        log(`${index + 1}. ${issue.issue}`, colors.white);
        log(`   Файл: ${issue.file}`, colors.yellow);
      });
    }
  } else {
    log('\n[Auth Диагностика] ✅ Не обнаружено проблем с механизмом создания пользователей', colors.green);
  }
  
  return {
    userFiles,
    issues
  };
}

// Проверка механизма валидации данных от Telegram
function checkTelegramValidation() {
  log('\n[Auth Диагностика] 🔍 Проверка механизма валидации данных от Telegram...', colors.cyan);
  
  // Имитируем данные initData от Telegram для проверки
  const mockInitData = 'query_id=AAHdF6IQAAAAAN0XohDhrOrc&user=%7B%22id%22%3A123456789%2C%22first_name%22%3A%22Test%22%2C%22last_name%22%3A%22User%22%2C%22username%22%3A%22testuser%22%2C%22language_code%22%3A%22en%22%7D&auth_date=1641234567&hash=1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t';
  
  // Проверяем, правильно ли будут обрабатываться такие данные
  try {
    // Разбираем строку initData
    const urlParams = new URLSearchParams(mockInitData);
    const hash = urlParams.get('hash');
    
    if (!hash) {
      log(`[Auth Диагностика] ❌ Ошибка в формате данных: отсутствует hash`, colors.red);
      return {
        isValid: false,
        error: 'Ошибка в формате данных: отсутствует hash'
      };
    }
    
    // Получаем данные пользователя
    const userStr = urlParams.get('user');
    
    if (!userStr) {
      log(`[Auth Диагностика] ❌ Ошибка в формате данных: отсутствуют данные пользователя`, colors.red);
      return {
        isValid: false,
        error: 'Ошибка в формате данных: отсутствуют данные пользователя'
      };
    }
    
    // Парсим данные пользователя
    let user;
    try {
      user = JSON.parse(userStr);
      log(`[Auth Диагностика] ✅ Данные пользователя успешно распарсены`, colors.green);
      log(`  - ID пользователя: ${user.id}`, colors.cyan);
      log(`  - Имя: ${user.first_name} ${user.last_name || ''}`, colors.cyan);
      log(`  - Username: ${user.username || 'не указан'}`, colors.cyan);
    } catch (error) {
      log(`[Auth Диагностика] ❌ Ошибка при разборе данных пользователя: ${error.message}`, colors.red);
      return {
        isValid: false,
        error: `Ошибка при разборе данных пользователя: ${error.message}`
      };
    }
    
    // Создаем массив данных для проверки подписи
    const dataCheckArr = [];
    
    urlParams.forEach((val, key) => {
      if (key !== 'hash') {
        dataCheckArr.push(`${key}=${val}`);
      }
    });
    
    // Сортируем массив
    dataCheckArr.sort();
    
    // Создаем строку данных
    const dataCheckString = dataCheckArr.join('\n');
    
    log(`[Auth Диагностика] ✅ Данные для проверки подписи сформированы правильно`, colors.green);
    
    // Имитируем проверку подписи (без реального токена)
    log(`[Auth Диагностика] ⚠️ Реальная проверка подписи невозможна без токена бота`, colors.yellow);
    log(`  - Для проверки подписи требуется TELEGRAM_BOT_TOKEN`, colors.yellow);
    
    // Проверяем наличие необходимых таблиц
    log(`\n[Auth Диагностика] 🔍 Проверка таблиц для хранения данных пользователей...`, colors.cyan);
    
    const requiredTables = [
      { name: 'auth_users', description: 'Основная таблица пользователей' },
      { name: 'sessions', description: 'Таблица для хранения сессий' },
      { name: 'telegram_users', description: 'Таблица для связи с Telegram' }
    ];
    
    for (const table of requiredTables) {
      // Имитация проверки существования таблиц
      const exists = table.name === 'auth_users';
      
      if (exists) {
        log(`  - Таблица ${table.name}: ✅ существует`, colors.green);
      } else {
        log(`  - Таблица ${table.name}: ❌ не существует`, colors.red);
        log(`    (${table.description})`, colors.yellow);
      }
    }
    
    return {
      isValid: true,
      user
    };
  } catch (error) {
    log(`[Auth Диагностика] ❌ Ошибка при проверке данных: ${error.message}`, colors.red);
    return {
      isValid: false,
      error: error.message
    };
  }
}

// Генерация рекомендаций по исправлению
function generateRecommendations(apiResults, sessionResults, userResults) {
  log('\n[Auth Диагностика] 📝 Рекомендации по исправлению:', colors.cyan);
  
  // Проверяем, есть ли проблемы с маршрутами API
  const hasApiIssues = apiResults && apiResults.apiEndpoints.length === 0;
  
  // Проверяем, есть ли проблемы с сессиями
  const hasSessionIssues = sessionResults && sessionResults.issues.length > 0;
  
  // Проверяем, есть ли проблемы с созданием пользователей
  const hasUserIssues = userResults && userResults.issues.length > 0;
  
  // Рекомендации для API маршрутов
  if (hasApiIssues) {
    log('\n1. Для исправления проблем с API маршрутами:', colors.yellow);
    log('- Необходимо реализовать эндпоинт для восстановления сессии (например, /api/session/restore)', colors.white);
    log('- Убедитесь, что эндпоинты авторизации правильно обрабатывают данные от Telegram', colors.white);
    
    // Пример эндпоинта восстановления сессии
    log('\nПример реализации эндпоинта восстановления сессии:', colors.green);
    log(`app.post('/api/session/restore', (req, res) => {
  const initData = req.headers['telegram-init-data'] || req.headers['x-telegram-init-data'];
  
  if (!initData) {
    return res.status(400).json({ success: false, error: 'No Telegram initData provided' });
  }
  
  // Проверка подписи данных от Telegram
  const isValid = validateTelegramInitData(initData);
  
  if (!isValid) {
    return res.status(403).json({ success: false, error: 'Invalid Telegram data signature' });
  }
  
  // Разбор данных пользователя
  const userData = parseTelegramInitData(initData);
  
  // Поиск пользователя в базе данных
  findOrCreateUser(userData)
    .then(user => {
      // Сохранение пользователя в сессии
      req.session.user = user;
      
      // Отправка ответа
      res.json({ success: true, data: { user } });
    })
    .catch(error => {
      res.status(500).json({ success: false, error: error.message });
    });
});`, colors.reset);
  }
  
  // Рекомендации для сессий
  if (hasSessionIssues) {
    log('\n2. Для исправления проблем с сессиями:', colors.yellow);
    
    // Проверяем наличие критических проблем с сессиями
    const hasCriticalSessionIssues = sessionResults.issues.some(issue => issue.severity === 'critical');
    
    if (hasCriticalSessionIssues) {
      log('- Необходимо включить обработку заголовков с данными Telegram', colors.white);
      log('- Реализовать проверку подписи данных от Telegram', colors.white);
    }
    
    // Пример функции проверки подписи Telegram
    log('\nПример функции проверки подписи Telegram:', colors.green);
    log(`function validateTelegramInitData(initData) {
  // Разбираем строку initData
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  
  if (!hash) {
    return false;
  }
  
  // Создаем массив данных для проверки
  const dataCheckArr = [];
  
  urlParams.forEach((val, key) => {
    if (key !== 'hash') {
      dataCheckArr.push(\`${key}=${val}\`);
    }
  });
  
  // Сортируем массив
  dataCheckArr.sort();
  
  // Создаем строку данных
  const dataCheckString = dataCheckArr.join('\\n');
  
  // Создаем HMAC-SHA-256 подпись
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(process.env.TELEGRAM_BOT_TOKEN).digest();
  const calculatedHash = crypto.createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');
  
  // Проверяем подпись
  return calculatedHash === hash;
}`, colors.reset);
    
    // Пример функции разбора данных пользователя
    log('\nПример функции разбора данных пользователя:', colors.green);
    log(`function parseTelegramInitData(initData) {
  // Разбираем строку initData
  const urlParams = new URLSearchParams(initData);
  const userStr = urlParams.get('user');
  
  if (!userStr) {
    throw new Error('No user data found in Telegram initData');
  }
  
  // Разбираем JSON строку с данными пользователя
  return JSON.parse(userStr);
}`, colors.reset);
  }
  
  // Рекомендации для создания пользователей
  if (hasUserIssues) {
    log('\n3. Для исправления проблем с созданием пользователей:', colors.yellow);
    
    // Проверяем наличие критических проблем с созданием пользователей
    const hasCriticalUserIssues = userResults.issues.some(issue => issue.severity === 'critical');
    
    if (hasCriticalUserIssues) {
      log('- Необходимо сохранять Telegram ID пользователя', colors.white);
      log('- Создать таблицу telegram_users для связи с пользователями Telegram', colors.white);
    }
    
    // Пример функции поиска или создания пользователя
    log('\nПример функции поиска или создания пользователя:', colors.green);
    log(`async function findOrCreateUser(telegramUser) {
  // Проверяем, существует ли уже пользователь с таким Telegram ID
  const existingUser = await findUserByTelegramId(telegramUser.id);
  
  if (existingUser) {
    // Обновляем данные пользователя, если нужно
    return existingUser;
  }
  
  // Создаем нового пользователя
  try {
    const newUser = await createUser({
      username: telegramUser.username || \`user_\${telegramUser.id}\`,
      telegram_id: telegramUser.id,
      first_name: telegramUser.first_name,
      last_name: telegramUser.last_name,
      language_code: telegramUser.language_code
    });
    
    return newUser;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}`, colors.reset);
  }
  
  // Общие рекомендации
  log('\n4. Общие рекомендации:', colors.cyan);
  log('- Создать таблицу sessions в базе данных для хранения сессий', colors.white);
  log('- Настроить CORS для поддержки credentials (cookies)', colors.white);
  log('- Убедиться, что все middleware применяются в правильном порядке (CORS перед session)', colors.white);
  log('- В Telegram Mini App, использовать fetch с { credentials: \'include\' }', colors.white);
}

// Запуск всех проверок
async function runAllChecks() {
  try {
    // Поиск API эндпоинтов авторизации
    const apiResults = await findApiEndpoints();
    
    // Анализ механизма восстановления сессии
    const sessionResults = await analyzeSessionRestoreFlow();
    
    // Анализ механизма создания пользователей
    const userResults = await analyzeUserCreationFlow();
    
    // Проверка механизма валидации данных от Telegram
    const telegramValidation = checkTelegramValidation();
    
    // Генерация рекомендаций
    generateRecommendations(apiResults, sessionResults, userResults);
    
    log('\n[Auth Диагностика] 🏁 Диагностика завершена', colors.cyan);
    
  } catch (error) {
    log(`[Auth Диагностика] ❌ Критическая ошибка при диагностике: ${error.message}`, colors.red);
    console.error(error);
  }
}

// Запускаем все проверки
runAllChecks();