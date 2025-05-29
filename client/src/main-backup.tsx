// Резервная копия оригинального main.tsx
// Импортируем основные модули React
import React, { createElement } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Импортируем полифиллы перед взаимодействием с API
import installAllPolyfills from './lib/polyfills';

// Импортируем утилиту для подавления ненужных логов
import { setupLogSuppression } from './utils/suppressLogs';

// Устанавливаем полифиллы в самом начале для исправления проблем с Map и Array.prototype.map
installAllPolyfills();

// Устанавливаем фильтрацию логов для подавления ненужных сообщений
setupLogSuppression();

// Импортируем функции из telegramService
import { 
  initTelegramWebApp, 
  isTelegramWebApp 
} from './services/telegramService';

// Импортируем компонент блокировки
import NotInTelegramWarning from "./components/ui/NotInTelegramWarning";

// Обеспечиваем глобальный процесс для приложения
interface ProcessEnv {
  env: Record<string, string | undefined>
}

// Устанавливаем глобальный процесс, который требуется некоторым библиотекам
window.process = { env: {} } as any;

// ЭТАП 1.1: СТРОГАЯ ПРОВЕРКА ЗАПУСКА ИЗ TELEGRAM
// Проверяем, запущено ли приложение в Telegram до рендеринга
const isTelegramEnvironment = isTelegramWebApp();

// Отладочная проверка состояния Telegram объекта (Этап 10.3: больше не зависим от window.Telegram)
console.log('[TG INIT] Этап 10.3: Проверка среды выполнения:', {
  isTelegramEnvironment,
  isDevelopment: process.env.NODE_ENV === 'development',
  hasLocalStorage: typeof localStorage !== 'undefined',
  hasSessionStorage: typeof sessionStorage !== 'undefined',
  savedGuestId: localStorage.getItem('unifarm_guest_id') || 'отсутствует',
  timestamp: new Date().toISOString()
});

// ЭТАП 1.2: Инициализируем Telegram WebApp до рендеринга React-приложения
// Вызываем, даже если не прошла проверка, чтобы получить хотя бы логи
initTelegramWebApp();

// Для гарантии инициализации также добавим слушатель DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
  console.log('[main] DOMContentLoaded event, повторная проверка инициализации Telegram WebApp');
  // Повторно вызываем функцию после полной загрузки DOM
  initTelegramWebApp();
});

// ВИПРАВЛЕННЯ: Завжди рендеримо основний додаток для усунення чорного екрану
console.log('[RENDER] Запуск React додатку...');

// Для отладки записываем информацию о среде
if (isTelegramEnvironment) {
  console.log('[TG CHECK] Приложение запущено из Telegram');
} else {
  console.log('[TG CHECK] Приложение запущено не из Telegram');
}

// Рендеринг основного компонента завжди
try {
  const rootElement = document.getElementById("root");
  if (rootElement) {
    const root = createRoot(rootElement);
    root.render(<App />);
    console.log('[RENDER] ✅ React додаток успішно змонтовано');
  } else {
    console.error('[RENDER] ❌ Елемент #root не знайдено');
  }
} catch (error) {
  console.error('[RENDER] ❌ Помилка рендерингу:', error);
}