import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

// Импортируем полифиллы перед взаимодействием с API
import installAllPolyfills from './lib/polyfills';

// Импортируем утилиту для подавления ненужных логов
import { setupLogSuppression } from './utils/suppressLogs';

// Устанавливаем полифиллы в самом начале
installAllPolyfills();

// Устанавливаем фильтрацию логов
setupLogSuppression();

// Импортируем функции из telegramService
import { 
  initTelegramWebApp, 
  isTelegramWebApp 
} from './services/telegramService';

// Обеспечиваем глобальный процесс для приложения
window.process = { 
  env: { 
    NODE_ENV: 'production',
    VITE_APP_ENV: 'production'
  } 
} as any;

// Безопасная инициализация DOM
function ensureDOMReady() {
  if (typeof document === 'undefined') {
    console.warn('[DOM] Document недоступен');
    return false;
  }
  
  // Создаём body если его нет
  if (!document.body) {
    try {
      const body = document.createElement('body');
      if (document.documentElement) {
        document.documentElement.appendChild(body);
        console.log('[DOM] ✅ Создали body элемент');
      } else {
        console.error('[DOM] ❌ documentElement недоступен');
        return false;
      }
    } catch (error) {
      console.error('[DOM] ❌ Ошибка создания body:', error);
      return false;
    }
  }
  
  return true;
}

// Проверяем DOM готовность
if (!ensureDOMReady()) {
  console.error('[DOM] ❌ Не удалось подготовить DOM');
}

// Проверяем, запущено ли приложение в Telegram
const isTelegramEnvironment = isTelegramWebApp();

console.log('[TG INIT] Проверка среды выполнения:', {
  isTelegramEnvironment,
  isDevelopment: process.env.NODE_ENV === 'development',
  hasLocalStorage: typeof localStorage !== 'undefined',
  hasSessionStorage: typeof sessionStorage !== 'undefined',
  savedGuestId: localStorage.getItem('unifarm_guest_id') || 'отсутствует',
  timestamp: new Date().toISOString()
});

// Инициализируем Telegram WebApp один раз
console.log('[main] Запуск инициализации Telegram WebApp...');
const initResult = initTelegramWebApp();
console.log('[main] Результат инициализации Telegram WebApp:', initResult ? 'успешно' : 'ошибка');

console.log('[RENDER] Запуск React приложения UniFarm...');

// Для отладки записываем информацию о среде
if (isTelegramEnvironment) {
  console.log('[TG CHECK] Приложение запущено из Telegram');
} else {
  console.log('[TG CHECK] Приложение запущено не из Telegram');
}

// Функция для безопасного рендеринга React приложения
function renderApp() {
  console.log('[RENDER] 🔄 Начинаем рендеринг React приложения...');
  
  try {
    // Проверяем готовность DOM
    if (!document.body) {
      console.log('[DOM] ⏳ DOM ещё не готов, ждём...');
      setTimeout(renderApp, 50);
      return;
    }
    
    console.log('[DOM] ✅ DOM готов');

    const rootElement = document.getElementById("root");
    if (rootElement) {
      console.log('[RENDER] ✅ Элемент #root найден, создаём React root...');
      const root = createRoot(rootElement);
      
      console.log('[RENDER] 🚀 Запускаем рендеринг App компонента...');
      root.render(<App />);
      
      console.log('[RENDER] ✅ App - UniFarm React приложение успешно смонтировано');
      console.log('[TG INIT] Статус инициализации Telegram:', (window as any).__telegram_initialized ? '✅ ГОТОВО' : '⏳ В процессе');
    } else {
      console.error('[RENDER] ❌ Элемент #root не найден в DOM');
      // Пробуем создать root элемент
      const rootDiv = document.createElement('div');
      rootDiv.id = 'root';
      document.body.appendChild(rootDiv);
      console.log('[RENDER] 🔧 Создали элемент #root, повторяем рендеринг...');
      setTimeout(renderApp, 100);
    }
  } catch (error) {
    console.error('[RENDER] ❌ Критическая ошибка рендеринга UniFarm:', error);
    console.error('[RENDER] ❌ Стек ошибки:', (error as Error).stack);
  }
}

// Безопасный запуск рендеринга
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderApp);
} else {
  renderApp();
}
