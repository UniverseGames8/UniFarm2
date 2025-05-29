/**
 * Скрипт для применения исправлений в UniFarm
 * 
 * Этот скрипт необходимо импортировать в начале server/index.ts
 * Он применяет все необходимые исправления без изменения оригинального кода
 * 
 * Порядок применения:
 * 1. В server/index.ts добавить в самом начале:
 *    import './apply-fixes';
 * 
 * 2. В server/routes.ts добавить перед registerRoutes:
 *    import { setupAdapter } from './adapter';
 *    app = setupAdapter(app);
 */

// Включаем фикс для базы данных в первую очередь
require('./db-selector-fix');

// Проверяем наличие всех необходимых переменных окружения
// и устанавливаем значения по умолчанию для отсутствующих
function setupEnvironmentVariables() {
  // Необходимые переменные окружения
  const requiredVars = [
    { name: 'DATABASE_URL', message: 'URL подключения к базе данных' },
    { name: 'TELEGRAM_BOT_TOKEN', message: 'Токен бота Telegram' }
  ];
  
  // Проверка наличия необходимых переменных
  let missingVars = [];
  
  for (const reqVar of requiredVars) {
    if (!process.env[reqVar.name]) {
      missingVars.push(`${reqVar.name} (${reqVar.message})`);
    }
  }
  
  if (missingVars.length > 0) {
    console.warn(`[ВНИМАНИЕ] Отсутствуют следующие переменные окружения:`);
    missingVars.forEach(v => console.warn(`- ${v}`));
    console.warn(`Некоторые функции могут работать некорректно.`);
  }
  
  // Переменные с значениями по умолчанию
  const defaultVars = [
    { name: 'NODE_ENV', value: 'development' },
    { name: 'PORT', value: '3000' },
    { name: 'SESSION_SECRET', value: 'uni-farm-telegram-mini-app-secret' }
  ];
  
  // Устанавливаем значения по умолчанию для отсутствующих переменных
  for (const defVar of defaultVars) {
    if (!process.env[defVar.name]) {
      process.env[defVar.name] = defVar.value;
      console.log(`[ENV] Установлено значение по умолчанию для ${defVar.name}: ${defVar.value}`);
    }
  }
}

// Устанавливаем переменные окружения
setupEnvironmentVariables();

// Проверяем наличие зависимостей и устанавливаем их при необходимости
async function installDependenciesIfNeeded() {
  const dependencies = [
    'cookie-parser',
    'connect-pg-simple'
  ];
  
  try {
    // Пробуем импортировать зависимости
    dependencies.forEach(dep => {
      try {
        require(dep);
      } catch (error) {
        // Если зависимость не установлена, записываем это в список
        console.error(`[ЗАВИСИМОСТИ] Отсутствует пакет: ${dep}`);
        console.error(`Установите его командой: npm install ${dep}`);
      }
    });
  } catch (error) {
    console.error('[ЗАВИСИМОСТИ] Ошибка при проверке зависимостей:', error.message);
  }
}

// Устанавливаем зависимости
installDependenciesIfNeeded();

console.log(`
=======================================================
✅ УЛУЧШЕНИЯ UniFarm ПОДГОТОВЛЕНЫ К ПРИМЕНЕНИЮ

Для завершения интеграции необходимо:

1. В server/index.ts добавить в самом начале:
   import './apply-fixes';

2. В server/routes.ts добавить перед registerRoutes:
   import { setupAdapter } from './adapter';
   app = setupAdapter(app);

После применения исправлений будут доступны:
- Стабильное подключение к Neon DB
- Корректная работа CORS для Telegram Mini App
- Правильная настройка сессий с поддержкой cookies
- Проверка и обработка данных авторизации Telegram

Диагностические эндпоинты:
- GET /api/diag/session-check - проверка работы сессий
- GET /api/diag/cors-check - проверка настроек CORS
- POST /api/diag/telegram-auth-check - проверка Telegram Auth
- GET /api/diag/db-check - проверка подключения к БД
=======================================================
`);

// Экспортируем пустой объект для совместимости с ESM и CommonJS
module.exports = {};