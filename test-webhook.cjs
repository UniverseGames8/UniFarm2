/**
 * Інструмент для тестування webhook Telegram бота UniFarm
 * 
 * Цей скрипт дозволяє перевірити налаштування webhook, надсилати тестові
 * запити та відстежувати їх обробку.
 */

const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');

// Завантажуємо змінні середовища вручну
function loadEnv() {
  try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      const lines = content.split('\n');
      
      lines.forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match && match[1] && match[2]) {
          const key = match[1].trim();
          const value = match[2].trim().replace(/^["']|["']$/g, '');
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      });
      
      console.log('Змінні середовища завантажено з .env файлу');
    }
  } catch (error) {
    console.error('Помилка при завантаженні .env файлу:', error.message);
  }
}

loadEnv();

// Перевіряємо наявність необхідних змінних середовища
const botToken = process.env.TELEGRAM_BOT_TOKEN;
if (!botToken) {
  console.error('❌ TELEGRAM_BOT_TOKEN не знайдено в змінних середовища.');
  console.error('Будь ласка, перевірте наявність токену в .env файлі та спробуйте знову.');
  process.exit(1);
}

// Створюємо папку для логів, якщо вона не існує
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Функція для логування
function log(message, isError = false) {
  const timestamp = new Date().toISOString();
  const logFile = path.join(logDir, 'webhook-test.log');
  const logMessage = `[${timestamp}] ${isError ? 'ERROR: ' : ''}${message}\n`;
  
  console[isError ? 'error' : 'log'](message);
  
  try {
    fs.appendFileSync(logFile, logMessage);
  } catch (err) {
    console.error(`Не вдалося записати в лог-файл: ${err.message}`);
  }
}

// Функція для виклику Telegram API
async function callTelegramApi(method, params = {}) {
  try {
    const url = `https://api.telegram.org/bot${botToken}/${method}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP помилка ${response.status}: ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    log(`Помилка при виклику методу ${method}: ${error.message}`, true);
    return { ok: false, error: error.message };
  }
}

// Функція для отримання інформації про webhook
async function getWebhookInfo() {
  log('Отримання інформації про поточний webhook...');
  
  const result = await callTelegramApi('getWebhookInfo');
  
  if (result.ok) {
    const info = result.result;
    log(`✅ Інформація отримана успішно:`);
    log(`URL: ${info.url || 'Не встановлено'}`);
    log(`Має нові запити: ${info.has_custom_certificate ? 'Так' : 'Ні'}`);
    log(`Очікуючі оновлення: ${info.pending_update_count || 0}`);
    
    if (info.last_error_date) {
      const errorDate = new Date(info.last_error_date * 1000);
      log(`⚠️ Остання помилка: ${info.last_error_message} (${errorDate.toISOString()})`, true);
    }
    
    return info;
  } else {
    log(`❌ Не вдалося отримати інформацію: ${result.error || 'Невідома помилка'}`, true);
    return null;
  }
}

// Функція для встановлення webhook
async function setWebhook(url) {
  log(`Встановлення webhook на URL: ${url}...`);
  
  const result = await callTelegramApi('setWebhook', {
    url,
    drop_pending_updates: true,
    allowed_updates: ['message', 'callback_query']
  });
  
  if (result.ok) {
    log(`✅ Webhook успішно встановлено на ${url}`);
    return true;
  } else {
    log(`❌ Не вдалося встановити webhook: ${result.error || result.description || 'Невідома помилка'}`, true);
    return false;
  }
}

// Функція для видалення webhook
async function deleteWebhook() {
  log('Видалення поточного webhook...');
  
  const result = await callTelegramApi('deleteWebhook', {
    drop_pending_updates: true
  });
  
  if (result.ok) {
    log('✅ Webhook успішно видалено');
    return true;
  } else {
    log(`❌ Не вдалося видалити webhook: ${result.error || result.description || 'Невідома помилка'}`, true);
    return false;
  }
}

// Замінюємо функцію створення тестового сервера на просту перевірку доступності URL
async function checkWebhookUrl(url) {
  log(`Перевірка доступності URL: ${url}...`);
  
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      timeout: 5000
    });
    
    if (response.ok) {
      log(`✅ URL ${url} доступний (статус: ${response.status})`);
      return true;
    } else {
      log(`⚠️ URL ${url} повернув статус: ${response.status}`, true);
      return false;
    }
  } catch (error) {
    log(`❌ Не вдалося підключитися до ${url}: ${error.message}`, true);
    return false;
  }
}

// Функція для надсилання тестового повідомлення від імені бота
async function sendTestMessage(chatId, text = 'Це тестове повідомлення від UniFarm бота') {
  log(`Надсилання тестового повідомлення до чату ${chatId}...`);
  
  const result = await callTelegramApi('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML'
  });
  
  if (result.ok) {
    log(`✅ Повідомлення успішно надіслано`);
    return true;
  } else {
    log(`❌ Не вдалося надіслати повідомлення: ${result.error || result.description || 'Невідома помилка'}`, true);
    return false;
  }
}

// Головна функція для тестування webhook
async function testWebhook() {
  try {
    log('🚀 Початок тестування webhook...');
    
    // Отримуємо інформацію про поточний webhook
    const currentWebhook = await getWebhookInfo();
    
    // Отримуємо інформацію про бота
    const botInfo = await callTelegramApi('getMe');
    if (botInfo.ok) {
      log(`Бот: @${botInfo.result.username} (${botInfo.result.first_name})`);
    } else {
      log('❌ Не вдалося отримати інформацію про бота. Перевірте токен.', true);
      return;
    }
    
    // Визначаємо URL для webhook
    let appUrl = process.env.APP_URL;
    if (!appUrl && process.env.REPLIT_SLUG && process.env.REPL_OWNER) {
      appUrl = `https://${process.env.REPLIT_SLUG}.${process.env.REPL_OWNER}.repl.co`;
      log(`Автоматично визначено APP_URL: ${appUrl}`);
    } else if (appUrl) {
      log(`Використовуємо APP_URL з налаштувань: ${appUrl}`);
    } else {
      log('⚠️ APP_URL не визначено, використовуємо значення за замовчуванням');
      // Для Replit потрібно коректно визначити URL
      const replitHost = process.env.REPL_SLUG ? 
        `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER || 'replit'}.repl.co` : 
        'https://uni-farm-connect-2.osadchukdmitro2.repl.co';
      appUrl = replitHost;
    }
    
    const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL || `${appUrl}/api/telegram/webhook`;
    log(`Використовуємо webhook URL: ${webhookUrl}`);
    
    // Перевіряємо доступність URL
    const isUrlAccessible = await checkWebhookUrl(webhookUrl);
    if (!isUrlAccessible) {
      log('⚠️ Webhook URL недоступний ззовні, але продовжуємо налаштування');
    }
    
    // Якщо вже встановлено webhook на потрібний URL, не змінюємо його
    if (currentWebhook && currentWebhook.url === webhookUrl) {
      log(`ℹ️ Webhook вже встановлено на ${webhookUrl}. Пропускаємо налаштування.`);
    } else {
      log(`Поточний webhook: ${currentWebhook?.url || 'не встановлено'}`);
      log(`Бажаний webhook: ${webhookUrl}`);
      
      // Спочатку видаляємо поточний webhook
      await deleteWebhook();
      
      // Потім встановлюємо новий
      const setResult = await setWebhook(webhookUrl);
      if (!setResult) {
        log('❌ Не вдалося встановити webhook. Перевірте URL та доступність сервера.', true);
        
        // Спробуємо альтернативний URL
        const altWebhookUrl = `${appUrl}/webhook`;
        log(`Спроба встановити альтернативний webhook URL: ${altWebhookUrl}`);
        
        const altResult = await setWebhook(altWebhookUrl);
        if (!altResult) {
          log('❌ Не вдалося встановити альтернативний webhook. Тестування завершено з помилками.', true);
          return;
        }
      }
    }
    
    // Отримуємо оновлену інформацію про webhook
    const updatedWebhook = await getWebhookInfo();
    
    if (!updatedWebhook || !updatedWebhook.url) {
      log('❌ Webhook не встановлено. Перевірте налаштування.', true);
      return;
    }
    
    log('✅ Webhook налаштовано успішно!');
    log('\nПідсумок тестування:');
    log(`✓ Бот: @${botInfo.result.username}`);
    log(`✓ Webhook URL: ${updatedWebhook.url}`);
    log(`✓ Очікуючі оновлення: ${updatedWebhook.pending_update_count || 0}`);
    
    // Додаткові перевірки
    log('\n🔍 Додаткові перевірки:');
    
    // Перевіряємо, чи коректно налаштовано webhook
    if (updatedWebhook.url !== webhookUrl) {
      log(`⚠️ Поточний webhook (${updatedWebhook.url}) відрізняється від бажаного (${webhookUrl})`, true);
    }
    
    // Перевіряємо наявність помилок webhook
    if (updatedWebhook.last_error_date) {
      const errorDate = new Date(updatedWebhook.last_error_date * 1000);
      log(`⚠️ Остання помилка webhook: ${updatedWebhook.last_error_message} (${errorDate.toISOString()})`, true);
      
      // Аналізуємо типові помилки
      if (updatedWebhook.last_error_message.includes('connection refused') || 
          updatedWebhook.last_error_message.includes('timeout')) {
        log('➡️ Причина: сервер недоступний або заблокований. Перевірте, чи запущено ваш сервер.', true);
      } else if (updatedWebhook.last_error_message.includes('HTTP error') || 
                updatedWebhook.last_error_message.includes('status code')) {
        log('➡️ Причина: сервер повернув помилку. Перевірте правильність обробки webhook запитів.', true);
      }
    }
    
    // Надаємо інструкції для ручного тестування
    log('\n📋 Для повного тестування webhook:');
    log('1. Відкрийте бота в Telegram: t.me/' + botInfo.result.username);
    log('2. Надішліть будь-яке повідомлення боту');
    log('3. Перевірте логи сервера на наявність вхідних повідомлень');
    log('4. Якщо повідомлення не з\'являються в логах:');
    log('   - Перевірте, чи запущено сервер');
    log('   - Переконайтеся, що сервер доступний ззовні');
    log('   - Перевірте правильність маршруту /api/telegram/webhook');
    
  } catch (error) {
    log(`❌ Помилка при тестуванні webhook: ${error.message}`, true);
    console.error(error);
  }
}

// Запускаємо тестування
testWebhook();