import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import TelegramInitializer from '@/components/telegram/TelegramInitializer';

/**
 * Специальная страница для запуска приложения в режиме Telegram Mini App
 * Эта страница является точкой входа для всех запросов от Telegram,
 * вне зависимости от конкретного пути (например /UniFarm/, /app/ и т.д.)
 */
export default function TelegramMiniApp() {
  const [, setLocation] = useLocation();
  const [initComplete, setInitComplete] = useState(false);
  const [details, setDetails] = useState<string>('');

  useEffect(() => {
    // Анализируем URL и параметры
    const fullUrl = window.location.href;
    const path = window.location.pathname;
    const search = window.location.search;
    const userAgent = navigator.userAgent;
    
    // Добавляем диагностическую информацию
    setDetails(`📱 Запуск Telegram Mini App
    URL: ${fullUrl}
    Path: ${path}
    Search: ${search}
    User-Agent: ${userAgent.substring(0, 100)}...`);
    
    console.log('[TelegramMiniApp] 🚀 Инициализация Telegram Mini App', {
      url: fullUrl,
      path,
      search,
      userAgent: userAgent.substring(0, 100)
    });

    // Обрабатываем параметры URL
    try {
      const urlParams = new URLSearchParams(window.location.search);
      
      // 1. Проверяем наличие реферального кода в URL
      const refCode = urlParams.get('ref_code');
      if (refCode) {
        console.log('[TelegramMiniApp] 🔗 Обнаружен реферальный код:', refCode);
        localStorage.setItem('referralCode', refCode);
      }
      
      // 2. Проверяем устаревший формат параметра startapp
      const startParam = urlParams.get('startapp');
      if (startParam) {
        console.log('[TelegramMiniApp] 🔍 Обнаружен параметр startapp:', startParam);
        localStorage.setItem('telegramStartParam', startParam);
      }
      
      // 3. Сохраняем все параметры запроса для перенаправления
      const queryParams = urlParams.toString() ? `?${urlParams.toString()}` : '';
      
      // 4. Устанавливаем флаг инициализации
      setInitComplete(true);
      
      // 5. Перенаправляем на главную страницу с сохранением параметров
      const redirectTimeout = setTimeout(() => {
        console.log('[TelegramMiniApp] 🔄 Перенаправление на главную страницу');
        setLocation(`/${queryParams}`);
      }, 1000);
      
      return () => {
        clearTimeout(redirectTimeout);
      };
    } catch (error) {
      console.error('[TelegramMiniApp] ❌ Ошибка при обработке URL:', error);
    }
  }, [setLocation]);

  return (
    <>
      {/* Включаем компонент инициализации официального Telegram WebApp API */}
      <TelegramInitializer />
      
      {/* Отображаем страницу загрузки */}
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
        <h1 className="text-xl font-bold mb-4">
          UniFarm
        </h1>
        
        <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
        
        <p className="text-lg mb-4 text-center">
          Загрузка приложения...
        </p>
        
        {details && (
          <div className="p-2 mt-4 bg-muted rounded-md w-full max-w-md text-xs font-mono whitespace-pre-wrap overflow-auto">
            {details}
          </div>
        )}
      </div>
    </>
  );
}