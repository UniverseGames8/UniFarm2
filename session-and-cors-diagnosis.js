/**
 * Диагностический скрипт для проверки настроек сессий и CORS
 * Анализирует потенциальные проблемы с сессиями, cookies и CORS-настройками
 * 
 * Использование:
 * node session-and-cors-diagnosis.js [url]
 * 
 * url - опциональный параметр, URL вашего приложения для проверки заголовков CORS
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Параметры из командной строки
const appUrl = process.argv[2] || 'https://uni-farm-connect-2-osadchukdmitro2.replit.app';

// Запуск диагностики
console.log('[Диагностика Сессии] 🔍 Начало анализа настроек сессий и CORS');
console.log(`[Диагностика Сессии] 🌐 Проверяемый URL: ${appUrl}`);

// Поиск файлов настроек Express
async function findExpressConfigFiles() {
  console.log('\n[Диагностика Сессии] 🔎 Поиск файлов с настройками Express и сессий...');
  
  // Поиск файлов, связанных с настройками Express и сессий
  const potentialFiles = [
    './server/index.ts',
    './server/routes.ts',
    './server/app.ts',
    './index.ts',
    './app.ts'
  ];
  
  const foundFiles = [];
  
  for (const filePath of potentialFiles) {
    try {
      if (fs.existsSync(filePath)) {
        console.log(`[Диагностика Сессии] ✅ Найден файл: ${filePath}`);
        
        // Проверяем содержимое файла на наличие настроек сессий и CORS
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        
        // Проверяем наличие кода для настройки сессий
        const hasSessionConfig = fileContent.includes('express-session') || 
                                 fileContent.includes('cookie-session') ||
                                 fileContent.includes('session(');
        
        // Проверяем наличие кода для настройки CORS
        const hasCorsConfig = fileContent.includes('cors(') || 
                             fileContent.includes('Access-Control-Allow-Origin');
        
        // Отмечаем, что найдено в файле
        const fileFindings = [];
        if (hasSessionConfig) fileFindings.push('настройки сессий');
        if (hasCorsConfig) fileFindings.push('настройки CORS');
        
        foundFiles.push({
          path: filePath,
          hasSessionConfig,
          hasCorsConfig,
          notes: fileFindings.length > 0 ? 
                `Обнаружены: ${fileFindings.join(', ')}` : 
                'Не найдены настройки сессий или CORS'
        });
      }
    } catch (error) {
      console.error(`[Диагностика Сессии] ⚠️ Ошибка при проверке файла ${filePath}:`, error.message);
    }
  }
  
  return foundFiles;
}

// Анализ настроек сессий из найденных файлов
async function analyzeSessionSettings(files) {
  console.log('\n[Диагностика Сессии] 🔍 Анализ настроек сессий...');
  
  // Потенциальные проблемы с сессиями
  const potentialIssues = [];
  
  // Проверяем файлы с настройками сессий
  for (const file of files) {
    if (file.hasSessionConfig) {
      try {
        const content = fs.readFileSync(file.path, 'utf-8');
        
        // Проверка настроек безопасности cookies
        const hasSecureCookie = content.includes('secure: true');
        const hasSameSiteCookie = content.includes('sameSite');
        const hasHttpOnlyCookie = content.includes('httpOnly: true');
        
        if (!hasSecureCookie) {
          potentialIssues.push('Отсутствует флаг secure для cookies');
        }
        
        if (!hasSameSiteCookie) {
          potentialIssues.push('Отсутствует настройка sameSite для cookies');
        }
        
        if (!hasHttpOnlyCookie) {
          potentialIssues.push('Отсутствует флаг httpOnly для cookies');
        }
        
        // Проверка настроек хранения сессий
        const usesMemoryStore = content.includes('MemoryStore') || 
                               !content.includes('Store');
        
        if (usesMemoryStore) {
          potentialIssues.push('Используется MemoryStore для сессий, что не подходит для production');
        }
        
        // Проверка срока жизни сессии
        const sessionMaxAge = content.match(/maxAge:\s*(\d+)/);
        if (sessionMaxAge) {
          const maxAgeValue = parseInt(sessionMaxAge[1]);
          // Если срок жизни сессии меньше часа (3600000 мс)
          if (maxAgeValue < 3600000) {
            potentialIssues.push(`Срок жизни сессии (${maxAgeValue} мс) может быть слишком коротким`);
          }
        } else {
          console.log('⚠️ Не найдена явная настройка maxAge для сессий');
        }
      } catch (error) {
        console.error(`[Диагностика Сессии] ⚠️ Ошибка при анализе файла ${file.path}:`, error.message);
      }
    }
  }
  
  return potentialIssues;
}

// Анализ настроек CORS из найденных файлов
async function analyzeCorsSettings(files) {
  console.log('\n[Диагностика Сессии] 🔍 Анализ настроек CORS...');
  
  // Потенциальные проблемы с CORS
  const potentialIssues = [];
  
  // Проверяем файлы с настройками CORS
  for (const file of files) {
    if (file.hasCorsConfig) {
      try {
        const content = fs.readFileSync(file.path, 'utf-8');
        
        // Проверка настроек разрешенных источников (origin)
        const hasTelegramDomain = content.includes('t.me') || 
                                 content.includes('telegram') ||
                                 content.includes('web.telegram');
        
        const hasStarOrigin = content.includes("origin: '*'") ||
                             content.includes("'*'") && content.includes('Access-Control-Allow-Origin');
        
        if (!hasTelegramDomain && !hasStarOrigin) {
          potentialIssues.push('Не найдены разрешения CORS для доменов Telegram');
        }
        
        // Проверка настроек credentials
        const hasCredentialsTrue = content.includes('credentials: true');
        
        if (!hasCredentialsTrue) {
          potentialIssues.push('Не найдена настройка credentials: true, необходимая для передачи cookies');
        }
        
        // Проверка разрешенных заголовков
        const hasAllowedHeaders = content.includes('allowedHeaders') || 
                                content.includes('Access-Control-Allow-Headers');
        
        if (!hasAllowedHeaders) {
          potentialIssues.push('Не настроены разрешенные заголовки для CORS');
        }
      } catch (error) {
        console.error(`[Диагностика Сессии] ⚠️ Ошибка при анализе файла ${file.path}:`, error.message);
      }
    }
  }
  
  return potentialIssues;
}

// Проверка заголовков CORS на сервере
async function checkServerCorsHeaders() {
  console.log('\n[Диагностика Сессии] 🌐 Проверка заголовков CORS на сервере...');
  
  return new Promise((resolve) => {
    try {
      // Подготавливаем модуль для HTTP или HTTPS запросов в зависимости от протокола
      const requestModule = appUrl.startsWith('https') ? https : http;
      
      // Добавляем заголовок origin, как если бы запрос шел из Telegram
      const options = {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://web.telegram.org',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type,telegram-data'
        }
      };
      
      // Делаем предварительный запрос OPTIONS для проверки CORS
      const req = requestModule.request(appUrl, options, (res) => {
        console.log(`[Диагностика Сессии] ✅ Статус ответа: ${res.statusCode}`);
        
        // Получаем заголовки CORS из ответа
        const corsHeaders = {
          allowOrigin: res.headers['access-control-allow-origin'],
          allowMethods: res.headers['access-control-allow-methods'],
          allowHeaders: res.headers['access-control-allow-headers'],
          allowCredentials: res.headers['access-control-allow-credentials'],
          exposeHeaders: res.headers['access-control-expose-headers'],
          maxAge: res.headers['access-control-max-age']
        };
        
        console.log('[Диагностика Сессии] 📋 Заголовки CORS в ответе:');
        for (const [header, value] of Object.entries(corsHeaders)) {
          console.log(`   ${header}: ${value || '<отсутствует>'}`);
        }
        
        // Проверяем потенциальные проблемы CORS
        const corsIssues = [];
        
        if (!corsHeaders.allowOrigin) {
          corsIssues.push('Отсутствует заголовок Access-Control-Allow-Origin');
        } else if (corsHeaders.allowOrigin !== '*' && !corsHeaders.allowOrigin.includes('telegram')) {
          corsIssues.push(`Access-Control-Allow-Origin не разрешает домены Telegram: ${corsHeaders.allowOrigin}`);
        }
        
        if (!corsHeaders.allowCredentials || corsHeaders.allowCredentials !== 'true') {
          corsIssues.push('Отсутствует или выключен заголовок Access-Control-Allow-Credentials, необходимый для cookies');
        }
        
        if (!corsHeaders.allowHeaders) {
          corsIssues.push('Отсутствует заголовок Access-Control-Allow-Headers');
        } else if (!corsHeaders.allowHeaders.includes('telegram-data')) {
          corsIssues.push('Access-Control-Allow-Headers не разрешает заголовок telegram-data');
        }
        
        resolve(corsIssues);
      });
      
      req.on('error', (error) => {
        console.error('[Диагностика Сессии] ❌ Ошибка при проверке CORS заголовков:', error.message);
        resolve(['Невозможно подключиться к серверу для проверки CORS: ' + error.message]);
      });
      
      // Устанавливаем таймаут 5 секунд
      req.setTimeout(5000, () => {
        console.error('[Диагностика Сессии] ⚠️ Таймаут при проверке CORS заголовков');
        req.destroy();
        resolve(['Таймаут при попытке подключения к серверу для проверки CORS']);
      });
      
      req.end();
    } catch (error) {
      console.error('[Диагностика Сессии] ❌ Критическая ошибка при проверке CORS:', error);
      resolve(['Критическая ошибка при проверке CORS: ' + error.message]);
    }
  });
}

// Запуск всех проверок
async function runAllTests() {
  try {
    // Ищем файлы с настройками
    const configFiles = await findExpressConfigFiles();
    
    if (configFiles.length === 0) {
      console.log('[Диагностика Сессии] ⚠️ Не найдены файлы с настройками Express');
    } else {
      // Анализируем настройки сессий
      const sessionIssues = await analyzeSessionSettings(configFiles);
      
      console.log('\n[Диагностика Сессии] 📋 Потенциальные проблемы с сессиями:');
      if (sessionIssues.length === 0) {
        console.log('✅ Явных проблем с настройками сессий не обнаружено');
      } else {
        sessionIssues.forEach(issue => console.log(`⚠️ ${issue}`));
      }
      
      // Анализируем настройки CORS
      const corsIssues = await analyzeCorsSettings(configFiles);
      
      console.log('\n[Диагностика Сессии] 📋 Потенциальные проблемы с CORS (из кода):');
      if (corsIssues.length === 0) {
        console.log('✅ Явных проблем с настройками CORS в коде не обнаружено');
      } else {
        corsIssues.forEach(issue => console.log(`⚠️ ${issue}`));
      }
    }
    
    // Проверяем заголовки CORS на сервере
    try {
      const serverCorsIssues = await checkServerCorsHeaders();
      
      console.log('\n[Диагностика Сессии] 📋 Проблемы с CORS на сервере:');
      if (serverCorsIssues.length === 0) {
        console.log('✅ Явных проблем с CORS на сервере не обнаружено');
      } else {
        serverCorsIssues.forEach(issue => console.log(`⚠️ ${issue}`));
      }
    } catch (error) {
      console.error('[Диагностика Сессии] ❌ Ошибка при проверке CORS на сервере:', error);
    }
    
    // Общие рекомендации
    console.log('\n[Диагностика Сессии] 📝 Общие рекомендации:');
    console.log('1. Убедитесь, что для сессионных cookies установлены флаги Secure и SameSite');
    console.log('2. Проверьте, что CORS настроен для разрешения запросов от доменов Telegram');
    console.log('3. Убедитесь, что credentials: true установлено для передачи cookies в CORS запросах');
    console.log('4. Используйте надежное хранилище для сессий вместо MemoryStore');
    console.log('5. Проверьте, что срок жизни сессий достаточно долгий для удобства пользователей');
    
    console.log('\n[Диагностика Сессии] 🏁 Диагностика завершена.');
    
  } catch (error) {
    console.error('[Диагностика Сессии] ❌ Критическая ошибка при выполнении диагностики:', error);
  }
}

// Запускаем все тесты
runAllTests();