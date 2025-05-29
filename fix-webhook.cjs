/**
 * Скрипт для виправлення webhook Telegram бота на коректну URL-адресу
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Константи
const LOG_DIR = path.join(__dirname, 'logs');
const CORRECT_URL = 'https://uni-farm-connect-x-lukyanenkolawfa.replit.app';

// Створюємо директорію для логів, якщо вона не існує
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Зчитуємо токен бота з .env файлу або змінних середовища
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
  const logFile = path.join(LOG_DIR, 'webhook-fix.log');
  const formattedMessage = `[${timestamp}] ${isError ? 'ERROR: ' : ''}${message}\n`;
  
  console[isError ? 'error' : 'log'](message);
  
  try {
    fs.appendFileSync(logFile, formattedMessage);
  } catch (error) {
    console.error(`Помилка запису в лог: ${error.message}`);
  }
}

// Функція для виклику Telegram API
function callTelegramApi(method, params = {}) {
  return new Promise((resolve, reject) => {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
    const postData = JSON.stringify(params);
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response);
        } catch (e) {
          reject(new Error(`Помилка обробки відповіді: ${e.message}`));
        }
      });
    });
    
    req.on('error', (e) => {
      reject(e);
    });
    
    req.write(postData);
    req.end();
  });
}

// Функції для налаштування webhook
async function getWebhookInfo() {
  try {
    const response = await callTelegramApi('getWebhookInfo');
    
    if (!response.ok) {
      throw new Error(response.description || 'Невідома помилка API');
    }
    
    return response.result;
  } catch (error) {
    log(`Помилка отримання інформації про webhook: ${error.message}`, true);
    return null;
  }
}

async function deleteWebhook() {
  try {
    const response = await callTelegramApi('deleteWebhook', { drop_pending_updates: false });
    
    if (!response.ok) {
      throw new Error(response.description || 'Невідома помилка API');
    }
    
    log('Webhook успішно видалено');
    return true;
  } catch (error) {
    log(`Помилка видалення webhook: ${error.message}`, true);
    return false;
  }
}

async function setWebhook(url) {
  try {
    const params = {
      url,
      allowed_updates: ['message', 'callback_query']
    };
    
    const response = await callTelegramApi('setWebhook', params);
    
    if (!response.ok) {
      throw new Error(response.description || 'Невідома помилка API');
    }
    
    log(`Webhook успішно встановлено на ${url}`);
    return true;
  } catch (error) {
    log(`Помилка встановлення webhook: ${error.message}`, true);
    return false;
  }
}

// Основна функція
async function fixWebhook() {
  try {
    log('Початок виправлення webhook для Telegram бота...');
    
    // Отримуємо інформацію про поточний webhook
    const webhookInfo = await getWebhookInfo();
    
    if (!webhookInfo) {
      log('Не вдалося отримати інформацію про webhook', true);
      return;
    }
    
    log(`Поточний webhook URL: ${webhookInfo.url || 'не встановлено'}`);
    
    // Формуємо коректний URL для webhook
    const correctWebhookUrl = `${CORRECT_URL}/api/telegram/webhook`;
    
    if (webhookInfo.url === correctWebhookUrl) {
      log(`Webhook вже налаштовано коректно на ${correctWebhookUrl}`);
      
      if (webhookInfo.last_error_date) {
        const errorDate = new Date(webhookInfo.last_error_date * 1000);
        const errorMessage = webhookInfo.last_error_message || 'Невідома помилка';
        log(`Остання помилка webhook: ${errorMessage} (${errorDate.toISOString()})`, true);
      } else {
        log('Webhook працює без помилок');
      }
      
      return;
    }
    
    // Видаляємо поточний webhook
    log('Видалення поточного webhook...');
    await deleteWebhook();
    
    // Встановлюємо новий webhook
    log(`Встановлення webhook на ${correctWebhookUrl}...`);
    const result = await setWebhook(correctWebhookUrl);
    
    if (result) {
      // Перевіряємо налаштування
      const updatedInfo = await getWebhookInfo();
      
      if (updatedInfo) {
        log(`Оновлений webhook URL: ${updatedInfo.url}`);
        
        if (updatedInfo.url === correctWebhookUrl) {
          log('✅ Webhook успішно налаштовано!');
        } else {
          log(`❌ Проблема: встановлений URL (${updatedInfo.url}) відрізняється від очікуваного (${correctWebhookUrl})`, true);
        }
      }
    }
  } catch (error) {
    log(`Помилка при виправленні webhook: ${error.message}`, true);
  }
}

// Запускаємо скрипт
fixWebhook();