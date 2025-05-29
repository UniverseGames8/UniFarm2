/**
 * Скрипт для открытия задеплоенного приложения в браузере
 * Определяет URL на основе REPL_SLUG и REPL_OWNER
 */

const https = require('https');
const { exec } = require('child_process');

// Определяем URL Replit приложения
function getReplitAppUrl() {
  const replSlug = process.env.REPL_SLUG;
  const replOwner = process.env.REPL_OWNER;
  
  if (!replSlug || !replOwner) {
    console.error('❌ Не удалось определить REPL_SLUG или REPL_OWNER из переменных среды');
    return null;
  }
  
  return `https://${replSlug}-${replOwner.toLowerCase()}.replit.app`;
}

// Проверяем доступность URL
function checkUrl(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      console.log(`✅ Приложение доступно по URL: ${url}`);
      console.log(`✅ Статус: ${res.statusCode}`);
      resolve(true);
    }).on('error', (err) => {
      console.error(`❌ Ошибка при проверке URL ${url}:`, err.message);
      resolve(false);
    });
  });
}

// Открываем URL в браузере
function openUrlInBrowser(url) {
  const command = process.platform === 'win32'
    ? `start ${url}`
    : process.platform === 'darwin'
      ? `open ${url}`
      : `xdg-open ${url}`;
      
  exec(command, (error) => {
    if (error) {
      console.error('❌ Не удалось открыть браузер:', error);
      console.log(`📌 Пожалуйста, вручную откройте URL: ${url}`);
    } else {
      console.log(`✅ Браузер открыт с URL: ${url}`);
    }
  });
}

// Выполняем основную функцию
async function main() {
  console.log('🔍 Определение URL развернутого приложения...');
  
  const appUrl = getReplitAppUrl();
  if (!appUrl) {
    console.log('ℹ️ Адрес приложения: https://uni-farm-connect-2-osadchukdmitro2.replit.app');
    console.log('📌 Пожалуйста, откройте URL вручную в браузере');
    return;
  }
  
  console.log(`🔗 URL приложения: ${appUrl}`);
  
  console.log('🔍 Проверка доступности приложения...');
  const isAvailable = await checkUrl(appUrl);
  
  if (isAvailable) {
    console.log('🚀 Открытие приложения в браузере...');
    openUrlInBrowser(appUrl);
  } else {
    console.log('⚠️ Приложение еще недоступно, возможно, процесс развертывания не завершен');
    console.log('⏳ Пожалуйста, подождите несколько минут и попробуйте снова');
    console.log('📌 URL для ручного открытия:', appUrl);
  }
}

// Запускаем скрипт
main().catch((err) => {
  console.error('❌ Произошла ошибка:', err);
});