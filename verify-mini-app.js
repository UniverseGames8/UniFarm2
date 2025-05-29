/**
 * Скрипт для проверки настроек Mini App и предоставления рекомендаций
 */

import fetch from 'node-fetch';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const botToken = process.env.TELEGRAM_BOT_TOKEN;

async function callTelegramApi(method, data = {}) {
  try {
    const url = `https://api.telegram.org/bot${botToken}/${method}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error(`Error calling Telegram API (${method}):`, error);
    return { ok: false, error: error.message };
  }
}

async function getWebhookInfo() {
  return await callTelegramApi('getWebhookInfo');
}

async function getMenuButton() {
  return await callTelegramApi('getMyCommands');
}

async function checkDomain() {
  try {
    const domainUrl = 'https://uni-farm-connect-2-misterxuniverse.replit.app';
    console.log(`\nПроверка основного домена: ${domainUrl}`);
    
    const response = await fetch(domainUrl);
    console.log(`- Статус ответа: ${response.status} ${response.statusText}`);
    console.log(`- Домен доступен: ${response.ok ? 'ДА ✅' : 'НЕТ ❌'}`);
    
    // Проверка заголовков CORS и Content-Security-Policy
    const headers = response.headers;
    console.log('\nПроверка заголовков безопасности:');
    
    // Анализ заголовков CORS
    const corsHeaders = [
      'Access-Control-Allow-Origin',
      'Access-Control-Allow-Methods',
      'Access-Control-Allow-Headers'
    ];
    
    corsHeaders.forEach(header => {
      const value = headers.get(header);
      console.log(`- ${header}: ${value || 'не установлен'}`);
    });
    
    // Проверка CSP
    const csp = headers.get('Content-Security-Policy');
    console.log(`- Content-Security-Policy: ${csp ? 'установлен' : 'не установлен'}`);
    
    return response.ok;
  } catch (error) {
    console.error(`Ошибка при проверке домена: ${error.message}`);
    return false;
  }
}

async function validateTelegramURL() {
  const correctURL = 'https://uni-farm-connect-2-misterxuniverse.replit.app';
  const correctTMEURL = 'https://t.me/UniFarming_Bot/UniFarm';
  
  console.log('\nПроверка URL для Telegram Mini App:');
  console.log(`- Текущая ссылка t.me: ${correctTMEURL}`);
  console.log(`- Ожидаемый URL веб-приложения: ${correctURL}`);
  
  console.log('\nРекомендации для BotFather:');
  console.log('1. Откройте BotFather, выберите @UniFarming_Bot');
  console.log('2. Перейдите в "Bot Settings" → "Menu Button"');
  console.log('   - Убедитесь, что там указан точный URL без слэша в конце:');
  console.log(`   ${correctURL}`);
  console.log('3. Перейдите в "Bot Settings" → "Mini Apps"');
  console.log('   - Проверьте URL мини-приложения (он должен быть точно таким же)');
  
  console.log('\nПроверьте, что в Mini App используется короткое имя "unifarm" (без кавычек)');
}

async function checkAppMetaTags() {
  try {
    const domainUrl = 'https://uni-farm-connect-2-misterxuniverse.replit.app';
    console.log(`\nПроверка мета-тегов для Telegram Mini App:`);
    
    const { stdout } = await execAsync(`curl -s ${domainUrl} | grep -i "viewport\\|telegram"`, { shell: '/bin/bash' });
    
    if (stdout.includes('viewport') || stdout.includes('Telegram')) {
      console.log('- Найдены релевантные мета-теги:');
      stdout.split('\n').filter(line => line.trim()).forEach(line => {
        console.log(`  ${line.trim()}`);
      });
    } else {
      console.log('- Не найдены специфичные мета-теги для Telegram Mini App');
      console.log('  Рекомендуется добавить:');
      console.log('  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />');
      console.log('  <meta name="telegram-web-app-ready" content="true" />');
    }
  } catch (error) {
    console.log('- Не удалось проверить мета-теги:', error.message);
  }
}

async function testWebAppAvailability() {
  console.log('\nИнструкции по тестированию Mini App:');
  console.log('1. Используйте официальный клиент Telegram для тестирования');
  console.log('2. Откройте бота @UniFarming_Bot');
  console.log('3. Нажмите на кнопку меню или используйте команду /app');
  console.log('4. При открытии приложения через Telegram, проверьте консоль на наличие');
  console.log('   объекта window.Telegram.WebApp');
  console.log('\nЕсли window.Telegram отсутствует, перепроверьте настройки в BotFather:');
  console.log('- Внимательно проверьте URL (https://uni-farm-connect-2-misterxuniverse.replit.app)');
  console.log('- Нет ли опечаток или лишних символов (например, слэша "/" в конце)?');
  console.log('- Правильно ли установлен тип кнопки "web_app" (а не обычная ссылка)?');
}

async function main() {
  try {
    console.log('🔍 Проверка настроек Telegram Mini App\n');
    
    const webhookInfo = await getWebhookInfo();
    if (webhookInfo.ok) {
      console.log('Webhook настройки:');
      console.log(`- URL: ${webhookInfo.result.url}`);
      console.log(`- Активен: ${webhookInfo.result.hasCustomCertificate ? 'ДА ✅' : 'НЕТ ❌'}`);
      console.log(`- Ожидающие обновления: ${webhookInfo.result.pending_update_count}`);
    } else {
      console.log('Не удалось получить информацию о webhook:', webhookInfo.description);
    }
    
    const domainAvailable = await checkDomain();
    if (!domainAvailable) {
      console.log('\n⚠️ Внимание! Домен недоступен. Это может быть причиной проблем.');
    }
    
    await validateTelegramURL();
    await checkAppMetaTags();
    await testWebAppAvailability();
    
    console.log('\n✅ Проверка завершена');
    console.log('📋 Для исправления проблемы следуйте рекомендациям выше');
  } catch (error) {
    console.error('Неожиданная ошибка при выполнении скрипта:', error);
  }
}

main();