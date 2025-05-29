/**
 * Простий скрипт для тестування webhook Telegram бота
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Логування
const LOG_DIR = path.join(__dirname, 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Зчитуємо токен бота з .env файлу
let BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/TELEGRAM_BOT_TOKEN\s*=\s*([^\r\n]+)/);
    if (match && match[1]) {
      BOT_TOKEN = match[1].trim().replace(/^['"]|['"]$/g, '');
      console.log('Токен бота знайдено в .env файлі');
    }
  }
} catch (error) {
  console.error('Помилка при зчитуванні .env файлу:', error.message);
}

if (!BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN не знайдено. Перевірте наявність токена в змінних середовища або .env файлі.');
  process.exit(1);
}

// Логування
function log(message, isError = false) {
  const timestamp = new Date().toISOString();
  const logFile = path.join(LOG_DIR, 'webhook-test.log');
  const formattedMessage = `[${timestamp}] ${isError ? 'ERROR: ' : ''}${message}\n`;
  
  console[isError ? 'error' : 'log'](message);
  
  try {
    fs.appendFileSync(logFile, formattedMessage);
  } catch (error) {
    console.error(`Помилка запису в лог: ${error.message}`);
  }
}

// Функція для HTTPS запитів
function httpsRequest(url, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          resolve({ statusCode: res.statusCode, data: parsedData });
        } catch (error) {
          reject(new Error(`Помилка обробки відповіді: ${error.message}, дані: ${responseData}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Основні функції для роботи з Telegram API
async function getMe() {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/getMe`;
    const response = await httpsRequest(url);
    
    if (response.statusCode !== 200) {
      throw new Error(`HTTP код ${response.statusCode}`);
    }
    
    if (!response.data.ok) {
      throw new Error(response.data.description || 'Невідома помилка API');
    }
    
    return response.data.result;
  } catch (error) {
    log(`Помилка отримання інформації про бота: ${error.message}`, true);
    return null;
  }
}

async function getWebhookInfo() {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`;
    const response = await httpsRequest(url);
    
    if (response.statusCode !== 200) {
      throw new Error(`HTTP код ${response.statusCode}`);
    }
    
    if (!response.data.ok) {
      throw new Error(response.data.description || 'Невідома помилка API');
    }
    
    return response.data.result;
  } catch (error) {
    log(`Помилка отримання інформації про webhook: ${error.message}`, true);
    return null;
  }
}

async function setWebhook(url) {
  try {
    const apiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`;
    const data = {
      url: url,
      drop_pending_updates: true,
      allowed_updates: ["message", "callback_query"]
    };
    
    const response = await httpsRequest(apiUrl, 'POST', data);
    
    if (response.statusCode !== 200) {
      throw new Error(`HTTP код ${response.statusCode}`);
    }
    
    if (!response.data.ok) {
      throw new Error(response.data.description || 'Невідома помилка API');
    }
    
    return true;
  } catch (error) {
    log(`Помилка встановлення webhook: ${error.message}`, true);
    return false;
  }
}

async function deleteWebhook() {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook?drop_pending_updates=true`;
    const response = await httpsRequest(url);
    
    if (response.statusCode !== 200) {
      throw new Error(`HTTP код ${response.statusCode}`);
    }
    
    if (!response.data.ok) {
      throw new Error(response.data.description || 'Невідома помилка API');
    }
    
    return true;
  } catch (error) {
    log(`Помилка видалення webhook: ${error.message}`, true);
    return false;
  }
}

// Функція для перевірки доступності URL
async function checkUrlAvailability(url) {
  try {
    // Для спрощення перевірки просто перевіряємо, чи резолвиться домен
    const parsedUrl = new URL(url);
    const options = {
      method: 'HEAD',
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname,
      timeout: 5000
    };
    
    return new Promise((resolve) => {
      const req = https.request(options, (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 500);
      });
      
      req.on('error', () => {
        resolve(false);
      });
      
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      
      req.end();
    });
  } catch (error) {
    log(`URL ${url} недоступний: ${error.message}`, true);
    return false;
  }
}

// Головна функція тестування
async function testWebhook() {
  try {
    log('🚀 Початок тестування webhook для Telegram бота...');
    
    // Отримуємо інформацію про бота
    const botInfo = await getMe();
    if (!botInfo) {
      log('❌ Не вдалося отримати інформацію про бота. Перевірте TELEGRAM_BOT_TOKEN.', true);
      return;
    }
    
    log(`✅ Бот: @${botInfo.username} (${botInfo.first_name})`);
    
    // Визначаємо URL для webhook
    // Спершу перевіряємо змінні середовища
    let appUrl = process.env.APP_URL || process.env.MINI_APP_URL;
    
    // Якщо змінних немає, пробуємо вгадати URL для Replit
    if (!appUrl) {
      const replSlug = process.env.REPL_SLUG;
      const replOwner = process.env.REPL_OWNER;
      
      if (replSlug && replOwner) {
        appUrl = `https://${replSlug}.${replOwner}.repl.co`;
      } else {
        // Значення за замовчуванням
        appUrl = 'https://uni-farm-connect-2.osadchukdmitro2.repl.co';
      }
    }
    
    // Сформуємо URL для webhook
    const webhookPath = '/api/telegram/webhook';
    const webhookUrl = `${appUrl}${webhookPath}`;
    
    log(`Використовуємо URL для webhook: ${webhookUrl}`);
    
    // Отримуємо поточну інформацію про webhook
    const webhookInfo = await getWebhookInfo();
    if (!webhookInfo) {
      log('❌ Не вдалося отримати інформацію про поточний webhook.', true);
      return;
    }
    
    log(`Поточний webhook URL: ${webhookInfo.url || 'не встановлено'}`);
    
    // Аналізуємо стан webhook
    if (webhookInfo.url === webhookUrl) {
      log(`✅ Webhook вже налаштований на ${webhookUrl}`);
      
      if (webhookInfo.last_error_date) {
        const errorDate = new Date(webhookInfo.last_error_date * 1000);
        log(`⚠️ Остання помилка webhook: ${webhookInfo.last_error_message} (${errorDate.toISOString()})`, true);
        
        // Аналіз типових помилок
        if (webhookInfo.last_error_message.includes('Bad Gateway') || 
            webhookInfo.last_error_message.includes('Gateway Timeout')) {
          log('➡️ Причина: сервер недоступний. Перевірте, чи працює ваш сервер.', true);
        } else if (webhookInfo.last_error_message.includes('Bad Request') || 
                 webhookInfo.last_error_message.includes('Not Found')) {
          log('➡️ Причина: неправильний URI або невідомий метод. Перевірте, чи правильно налаштовано API.', true);
        }
      } else {
        log('✅ Webhook працює без помилок');
      }
    } else {
      log(`Поточний webhook (${webhookInfo.url || 'не встановлено'}) відрізняється від бажаного (${webhookUrl})`);
      
      // Перевіряємо доступність URL
      log(`Перевірка доступності ${webhookUrl}...`);
      const isAvailable = await checkUrlAvailability(webhookUrl);
      
      if (!isAvailable) {
        log(`⚠️ URL ${webhookUrl} недоступний ззовні. Webhook може не працювати.`, true);
        log('Перевірте, чи запущено ваш сервер та чи доступний він ззовні.', true);
      }
      
      // Питаємо користувача, чи хоче він оновити webhook
      log('Бажаєте оновити webhook на новий URL? (y/n)');
      process.stdout.write('> ');
      
      // Наскільки це можливо в NodeJS, імітуємо введення "y"
      process.stdout.write('y\n');
      
      // Видаляємо поточний webhook
      log('Видалення поточного webhook...');
      const deleteResult = await deleteWebhook();
      
      if (!deleteResult) {
        log('❌ Не вдалося видалити поточний webhook.', true);
        return;
      }
      
      // Встановлюємо новий webhook
      log(`Встановлення webhook на ${webhookUrl}...`);
      const setResult = await setWebhook(webhookUrl);
      
      if (!setResult) {
        log('❌ Не вдалося встановити новий webhook.', true);
        
        // Спроба альтернативного URL
        const altWebhookUrl = `${appUrl}/webhook`;
        log(`Спроба встановити альтернативний webhook на ${altWebhookUrl}...`);
        
        const altResult = await setWebhook(altWebhookUrl);
        
        if (!altResult) {
          log('❌ Не вдалося встановити альтернативний webhook.', true);
          return;
        } else {
          log(`✅ Альтернативний webhook встановлено на ${altWebhookUrl}`);
        }
      } else {
        log(`✅ Webhook успішно встановлено на ${webhookUrl}`);
      }
      
      // Перевіряємо оновлений webhook
      const updatedInfo = await getWebhookInfo();
      
      if (updatedInfo) {
        log(`Оновлений webhook URL: ${updatedInfo.url}`);
        
        if (updatedInfo.pending_update_count > 0) {
          log(`⚠️ Є ${updatedInfo.pending_update_count} непрочитаних повідомлень`, true);
        }
      }
    }
    
    // Інструкції для ручного тестування
    log('\n📋 Для ручного тестування webhook:');
    log(`1. Відправте повідомлення боту: https://t.me/${botInfo.username}`);
    log('2. Перевірте логи сервера для підтвердження отримання запиту');
    log('3. Якщо сервер не отримує запити:');
    log('   - Перевірте, чи запущено сервер');
    log('   - Переконайтеся, що маршрут /api/telegram/webhook правильно налаштований');
    log('   - Перевірте доступність сервера ззовні');
    
  } catch (error) {
    log(`❌ Помилка при тестуванні webhook: ${error.message}`, true);
    console.error(error);
  }
}

// Запуск тестування
testWebhook();