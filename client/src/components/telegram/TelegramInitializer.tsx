import { useEffect, useState } from 'react';
// ЭТАП 1: Импорт сервиса темы для интеграции
import { initializeTelegramThemeSystem } from '../../services/telegramThemeService';
// ЭТАП 2: Импорт сервиса кнопок для интеграции
import { initializeTelegramButtons } from '../../services/telegramButtonService';
// ЭТАП 3: Импорт объединенного сервиса улучшенных функций
import { initializeTelegramAdvancedFeatures } from '../../services/telegramAdvancedService';

const TelegramInitializer = () => {
  const [status, setStatus] = useState({
    initialized: false,
    error: null as string | null
  });

  useEffect(() => {
    async function initializeTelegramServices() {
      try {
        // Проверяем наличие Telegram WebApp
        if (!window.Telegram?.WebApp) {
          throw new Error('Telegram WebApp API не найден');
        }

        // Проверяем initData
        const initData = window.Telegram.WebApp.initData;
        console.log('[TelegramInitializer] InitData check:', {
          exists: !!initData,
          length: initData?.length || 0
        });

        // ОПТИМИЗАЦИЯ КЭШИРОВАНИЯ: Принудительное обновление URL для Telegram
        try {
          if (window.Telegram && window.Telegram.WebApp) {
            const url = new URL(window.location.href);
            url.searchParams.set('_t', Date.now().toString());
            url.searchParams.set('_v', Math.random().toString(36).substring(7));
            window.history.replaceState(null, '', url.toString());
            console.log('[CACHE BUST] URL обновлен для предотвращения кэширования:', url.toString());
          }
        } catch (error) {
          console.warn('[CACHE BUST] Не удалось обновить URL:', error);
        }

        // Подтверждаем готовность
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();

        // ЭТАП 1: Инициализация системы темы и событий
        console.log('[TelegramInitializer] 🎨 Запуск инициализации темы...');
        const themeInitialized = initializeTelegramThemeSystem();
        
        // ЭТАП 2: Инициализация системы кнопок
        console.log('[TelegramInitializer] 🔘 Запуск инициализации кнопок...');
        const buttonsInitialized = initializeTelegramButtons();
        
        // ЭТАП 3: Инициализация улучшенных функций (CloudStorage, SendData, Error Handling)
        console.log('[TelegramInitializer] ⚡ Запуск инициализации улучшенных функций...');
        const advancedFeatures = await initializeTelegramAdvancedFeatures();
        
        // Логируем успешную инициализацию
        console.log('[TelegramInitializer] Диагностика:', {
          version: window.Telegram.WebApp.version,
          platform: window.Telegram.WebApp.platform,
          viewportHeight: window.Telegram.WebApp.viewportHeight,
          viewportStableHeight: window.Telegram.WebApp.viewportStableHeight,
          colorScheme: window.Telegram.WebApp.colorScheme,
          // ЭТАП 1: Добавление статуса инициализации темы
          themeInitialized: themeInitialized,
          // ЭТАП 2: Добавление статуса инициализации кнопок
          buttonsInitialized: buttonsInitialized,
          // ЭТАП 3: Добавление статуса улучшенных функций
          advancedFeatures: advancedFeatures
        });

        setStatus({ initialized: true, error: null });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
        console.error('[TelegramInitializer] Ошибка:', errorMessage);
        setStatus({ initialized: false, error: errorMessage });
      }
    }

    initializeTelegramServices();
  }, []);

  // Возвращаем компонент с информацией о статусе
  return status.error ? (
    <div style={{ padding: '1rem', color: 'red' }}>
      Ошибка инициализации Telegram: {status.error}
    </div>
  ) : null;
}

export { TelegramInitializer };
export default TelegramInitializer;
