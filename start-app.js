/**
 * Уніфікований скрипт запуску сервера UniFarm
 * 
 * Цей скрипт ініціалізує всі необхідні компоненти для правильної роботи UniFarm:
 * - Підключення до бази даних (з підтримкою резервного варіанту)
 * - Налаштування Telegram webhook
 * - Запуск Express сервера
 */

const path = require('path');
require('dotenv').config();

// Налаштування змінних середовища для SSL
process.env.PGSSLMODE = 'require';

// Встановлюємо флаг, що ми використовуємо уніфікований режим запуску
process.env.UNIFIED_STARTUP = 'true';

// Задаємо шлях до файлів сервера
const serverPath = path.join(__dirname, 'server');

console.log('[Unified Startup] 🚀 Запуск UniFarm в уніфікованому режимі');
console.log('[Unified Startup] 📂 Шлях до сервера:', serverPath);

// Конфігуруємо змінні середовища для правильної роботи з БД
setupEnvironmentVariables();

// Запускаємо сервер
try {
  console.log('[Unified Startup] 🔄 Імпортуємо та запускаємо сервер...');
  
  // Динамічно імпортуємо сервер
  import('./server/index.js')
    .then(() => {
      console.log('[Unified Startup] ✅ Сервер успішно запущено');
    })
    .catch(error => {
      console.error('[Unified Startup] ❌ Помилка при запуску сервера:', error);
      console.error('[Unified Startup] 🔄 Спробуйте альтернативний метод запуску: node server/index.js');
    });
} catch (error) {
  console.error('[Unified Startup] ❌ Критична помилка при запуску сервера:', error);
  console.error('[Unified Startup] 🔄 Спробуйте альтернативний метод запуску: node server/index.js');
}

/**
 * Налаштовує змінні середовища в залежності від конфігурації
 */
function setupEnvironmentVariables() {
  console.log('[Unified Startup] 🔄 Налаштування змінних середовища...');
  
  // Визначаємо, який метод доступу до БД використовувати
  const useLocalDb = process.env.USE_LOCAL_DB === 'true';
  const useNeonDb = process.env.USE_NEON_DB === 'true' || process.env.FORCE_NEON_DB === 'true';
  const useInMemory = process.env.USE_MEMORY_STORAGE === 'true';
  
  // Пріоритет: Neon DB > Local DB > In-Memory
  if (useNeonDb) {
    console.log('[Unified Startup] 📊 Використовуємо Neon DB');
    process.env.DATABASE_PROVIDER = 'neon';
    process.env.OVERRIDE_DB_PROVIDER = 'neon';
  } else if (useLocalDb) {
    console.log('[Unified Startup] 📊 Використовуємо локальну БД');
    process.env.DATABASE_PROVIDER = 'local';
    process.env.OVERRIDE_DB_PROVIDER = 'local';
  } else if (useInMemory) {
    console.log('[Unified Startup] 📊 Використовуємо in-memory сховище');
    process.env.DATABASE_PROVIDER = 'memory';
    process.env.OVERRIDE_DB_PROVIDER = 'memory';
    process.env.USE_MEMORY_STORAGE = 'true';
    process.env.USE_MEMORY_SESSION = 'true';
  } else {
    console.log('[Unified Startup] 📊 Автоматичне визначення провайдера БД (з автофолбеком)');
  }
  
  // Налаштування URL додатку
  if (!process.env.APP_URL) {
    // Визначаємо URL додатку на основі Replit
    const replitSlug = process.env.REPL_SLUG;
    const replitOwner = process.env.REPL_OWNER;
    
    if (replitSlug && replitOwner) {
      process.env.APP_URL = `https://${replitSlug}.${replitOwner}.repl.co`;
      console.log('[Unified Startup] 🌐 Налаштовано APP_URL:', process.env.APP_URL);
    } else {
      console.warn('[Unified Startup] ⚠️ Неможливо автоматично визначити APP_URL');
    }
  }
  
  // Налаштування webhook URL для Telegram
  if (!process.env.TELEGRAM_WEBHOOK_URL && process.env.APP_URL) {
    process.env.TELEGRAM_WEBHOOK_URL = `${process.env.APP_URL}/api/telegram/webhook`;
    console.log('[Unified Startup] 🤖 Налаштовано TELEGRAM_WEBHOOK_URL:', process.env.TELEGRAM_WEBHOOK_URL);
  }
  
  // Налаштування URL для Telegram Mini App
  if (!process.env.MINI_APP_URL && process.env.APP_URL) {
    process.env.MINI_APP_URL = process.env.APP_URL;
    console.log('[Unified Startup] 📱 Налаштовано MINI_APP_URL:', process.env.MINI_APP_URL);
  }
  
  console.log('[Unified Startup] ✅ Змінні середовища успішно налаштовані');
}