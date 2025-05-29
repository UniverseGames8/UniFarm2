import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';

// Типы для Telegram WebApp API определены в telegramService.ts
// Здесь не нужно их дублировать

/**
 * Компонент для обработки URL с завершающим слэшем в Telegram Mini App
 * Когда BotFather автоматически добавляет слэш в конце URL, этот компонент
 * корректно перенаправляет пользователя на основной URL и инициирует Telegram WebApp
 */
export default function TelegramSlashHandler() {
  const [, setLocation] = useLocation();
  const [details, setDetails] = useState<string | null>(null);
  const [telegramAvailable, setTelegramAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    // Анализируем URL с отладочной информацией
    const currentPath = window.location.pathname;
    const currentUrl = window.location.href;
    const hasRefCodeParam = window.location.search.includes('ref_code') || window.location.search.includes('startapp');
    const userAgent = navigator.userAgent;
    
    // Устанавливаем отладочную информацию
    setDetails(`URL: ${currentUrl}, refCodeParam: ${hasRefCodeParam ? 'есть' : 'нет'}, user-agent: ${userAgent.substr(0, 50)}...`);

    // Функция для обработки параметров URL и минимальной инициализации Telegram 
    const handleUrlParameters = () => {
      console.log('[TelegramSlashHandler] 🔄 Обработка URL параметров', {
        url: currentUrl,
        path: currentPath,
        hasRefCodeParam,
        userAgent
      });
      
      try {
        // Этап 11.1 с обновлением: Минимальная интеграция с Telegram WebApp
        // Проверяем наличие Telegram WebApp, но используем только технические методы
        const isWebAppAvailable = typeof window !== 'undefined' && 
                                 !!window.Telegram && 
                                 !!window.Telegram.WebApp;
        
        setTelegramAvailable(isWebAppAvailable);
        
        if (isWebAppAvailable) {
          console.log('[TelegramSlashHandler] 📱 Обнаружен Telegram WebApp, выполняем минимальную инициализацию...');
          
          // Выполняем минимальную инициализацию для работы в Telegram
          try {
            // Сигнализируем Telegram о готовности приложения
            if (window.Telegram && window.Telegram.WebApp) {
              window.Telegram.WebApp.ready();
              console.log('[TelegramSlashHandler] ✅ Метод ready() вызван успешно');
              
              // Расширяем окно до максимальной высоты
              window.Telegram.WebApp.expand();
              console.log('[TelegramSlashHandler] ✅ Метод expand() вызван успешно');
            }
          } catch (telegramError) {
            console.error('[TelegramSlashHandler] ⚠️ Ошибка при инициализации Telegram WebApp:', telegramError);
          }
        } else {
          console.log('[TelegramSlashHandler] 📝 Telegram WebApp не обнаружен, работаем в стандартном режиме');
        }
        
        // Проверяем наличие параметров реферальной ссылки в URL
        const urlParams = new URLSearchParams(window.location.search);
        
        // Сначала проверяем новый формат с параметром ref_code
        const refCodeParam = urlParams.get('ref_code');
        if (refCodeParam) {
          console.log('[TelegramSlashHandler] 🔍 Обнаружен параметр ref_code:', refCodeParam);
          // Сохраняем параметр в localStorage для последующего использования
          localStorage.setItem('referralCode', refCodeParam);
        }
        
        // Для обратной совместимости также проверяем старый формат startapp
        const startParam = urlParams.get('startapp');
        if (startParam) {
          console.log('[TelegramSlashHandler] 🔍 Обнаружен устаревший параметр startapp:', startParam);
          // Сохраняем параметр startapp в localStorage для последующего использования
          localStorage.setItem('telegramStartParam', startParam);
        }
      } catch (error) {
        console.error('[TelegramSlashHandler] ❌ Ошибка при обработке URL параметров:', error);
      }
      
      // Ждем небольшую задержку, чтобы все методы initData были выполнены
      setTimeout(() => {
        // Перенаправляем на корневой URL с сохранением параметров запроса
        console.log('[TelegramSlashHandler] 🔄 Перенаправление на корневой URL...');
        
        // Сохраняем параметры запроса
        const urlParams = new URLSearchParams(window.location.search);
        const redirectUrl = urlParams.toString() ? `/?${urlParams.toString()}` : '/';
        
        setLocation(redirectUrl);
      }, 500);
    };

    // Выполняем обработку URL параметров с небольшой задержкой
    const initTimeout = setTimeout(handleUrlParameters, 100);
    
    return () => clearTimeout(initTimeout);
  }, [setLocation]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-2xl font-bold mb-2">Инициализация UniFarm</h1>
      <p className="text-lg mb-6 text-center">Приложение запускается, пожалуйста, подождите...</p>
      
      <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mb-6"></div>
      
      {telegramAvailable !== null && (
        <div className="text-sm p-3 mb-2 rounded-md text-center bg-blue-100 text-blue-800">
          📱 Этап 11.1: Работа без зависимости от Telegram WebApp API
        </div>
      )}
      
      {details && (
        <div className="text-xs bg-gray-100 p-2 rounded max-w-full overflow-auto mt-4 text-gray-700">
          <p className="font-mono break-all">{details}</p>
        </div>
      )}
    </div>
  );
}