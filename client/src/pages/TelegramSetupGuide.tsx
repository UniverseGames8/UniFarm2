import React, { useState, useEffect } from 'react';
import { Link } from 'wouter';

/**
 * Страница руководства по настройке Telegram Mini App
 * Предоставляет пошаговые инструкции и диагностику
 */

// Шаги настройки
interface SetupStep {
  id: string;
  title: string;
  description: string;
  isCompleted: boolean;
  instructions: string[];
}

const TelegramSetupGuide: React.FC = () => {
  const [activeStepId, setActiveStepId] = useState<string>('bot-creation');
  const [telegramPresent, setTelegramPresent] = useState<boolean>(false);
  const [webAppPresent, setWebAppPresent] = useState<boolean>(false);
  const [initDataPresent, setInitDataPresent] = useState<boolean>(false);
  const [currentDomain, setCurrentDomain] = useState<string>('');
  
  useEffect(() => {
    // Проверяем наличие Telegram API при загрузке
    const checkTelegramApi = () => {
      const hasTelegram = !!window.Telegram;
      const hasWebApp = !!window.Telegram?.WebApp;
      const hasInitData = hasWebApp && 
                         !!window.Telegram?.WebApp?.initData && 
                         (window.Telegram?.WebApp?.initData?.length || 0) > 0;
      
      setTelegramPresent(hasTelegram);
      setWebAppPresent(hasWebApp);
      setInitDataPresent(hasInitData);
      setCurrentDomain(window.location.origin);
      
      // Выводим подробную информацию в консоль
      console.log('[TelegramSetupGuide] Telegram API присутствует:', hasTelegram);
      console.log('[TelegramSetupGuide] WebApp API присутствует:', hasWebApp);
      console.log('[TelegramSetupGuide] InitData присутствует:', hasInitData);
      
      if (hasWebApp && window.Telegram?.WebApp) {
        console.log('[TelegramSetupGuide] WebApp version:', window.Telegram?.WebApp?.version);
        console.log('[TelegramSetupGuide] Platform:', window.Telegram?.WebApp?.platform);
        console.log('[TelegramSetupGuide] InitData length:', window.Telegram?.WebApp?.initData?.length || 0);
      }
    };
    
    checkTelegramApi();
  }, []);
  
  // Определяем шаги настройки
  const setupSteps: SetupStep[] = [
    {
      id: 'bot-creation',
      title: 'Создание бота',
      description: 'Создайте бота в BotFather и получите токен',
      isCompleted: true, // Предполагаем, что бот уже создан
      instructions: [
        'Откройте Telegram и найдите @BotFather',
        'Отправьте команду /newbot',
        'Следуйте инструкциям, чтобы создать бота',
        'Сохраните полученный токен бота'
      ]
    },
    {
      id: 'web-app-setup',
      title: 'Настройка Web App',
      description: 'Включите и настройте Mini App для вашего бота',
      isCompleted: webAppPresent,
      instructions: [
        'В @BotFather выберите своего бота',
        'Отправьте команду /mybots',
        'Выберите "Bot Settings" > "Menu Button" или просто используйте команду /setmenubutton',
        'Установите команду для кнопки (например, /start)',
        'Включите Web App через опцию "Bot Settings" > "Web App Info"',
        `Укажите URL вашего приложения: ${currentDomain}`
      ]
    },
    {
      id: 'domains-setup',
      title: 'Настройка доменов',
      description: 'Добавьте домен приложения в список разрешенных',
      isCompleted: initDataPresent,
      instructions: [
        'В @BotFather отправьте команду /setdomain для вашего бота',
        `Укажите домен вашего приложения: ${currentDomain.replace('https://', '')}`,
        'Добавьте домен в список разрешенных доменов',
        'После добавления домена, Mini App начнет передавать данные через initData'
      ]
    },
    {
      id: 'webhook-setup',
      title: 'Настройка webhook',
      description: 'Настройте webhook для получения обновлений от Telegram',
      isCompleted: false, // Требует ручной проверки
      instructions: [
        'Используйте нашу страницу "/webhook-setup" для настройки вебхука',
        `Убедитесь, что URL вебхука указан как ${currentDomain}/api/telegram/webhook`,
        'Проверьте статус вебхука, чтобы убедиться, что он настроен правильно',
        'Webhook необходим для получения обновлений и команд от пользователей через Telegram'
      ]
    },
    {
      id: 'test-mini-app',
      title: 'Тестирование Mini App',
      description: 'Протестируйте работу Mini App в Telegram',
      isCompleted: false, // Требует ручной проверки
      instructions: [
        'Откройте своего бота в Telegram',
        'Нажмите кнопку меню (если настроена) или отправьте команду /start',
        'Проверьте, что Mini App открывается и данные пользователя передаются',
        'Проверьте нашу страницу "/audit" для полной диагностики работы приложения в Telegram'
      ]
    }
  ];
  
  // Находим активный шаг
  const activeStep = setupSteps.find(step => step.id === activeStepId) || setupSteps[0];
  
  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Настройка Telegram Mini App</h1>
        <Link href="/" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md text-sm">
          Вернуться в приложение
        </Link>
      </div>
      
      {/* Статус Telegram API */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md mb-6">
        <h2 className="text-lg font-semibold mb-3 text-gray-800 dark:text-white">Статус интеграции Telegram</h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
            <span className="font-medium">Telegram API</span>
            <div className={`flex items-center ${telegramPresent ? 'text-green-600' : 'text-red-600'}`}>
              {telegramPresent ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Доступен
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  Недоступен
                </>
              )}
            </div>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
            <span className="font-medium">WebApp API</span>
            <div className={`flex items-center ${webAppPresent ? 'text-green-600' : 'text-red-600'}`}>
              {webAppPresent ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Доступен
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  Недоступен
                </>
              )}
            </div>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
            <span className="font-medium">Telegram initData</span>
            <div className={`flex items-center ${initDataPresent ? 'text-green-600' : 'text-red-600'}`}>
              {initDataPresent ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Получены
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  Отсутствуют
                </>
              )}
            </div>
          </div>
          
          <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/30 p-3 rounded-md">
            <p className="text-sm text-blue-700 dark:text-blue-400">
              Текущий домен: <strong>{currentDomain}</strong>
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
              {telegramPresent ? 'Приложение запущено в Telegram.' : 'Приложение запущено вне Telegram.'}
            </p>
          </div>
        </div>
      </div>
      
      {/* Шаги настройки */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Левая панель - список шагов */}
        <div className="md:w-1/3">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <h2 className="text-lg font-semibold p-4 border-b border-gray-200 dark:border-gray-700 text-gray-800 dark:text-white">
              Шаги настройки
            </h2>
            <div className="p-2">
              {setupSteps.map((step, index) => (
                <button
                  key={step.id}
                  className={`w-full text-left p-3 rounded-md flex items-center mb-1 ${
                    activeStepId === step.id
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                  onClick={() => setActiveStepId(step.id)}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-3 ${
                    step.isCompleted
                      ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  }`}>
                    {step.isCompleted ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </div>
                  <div>
                    <div className="font-medium">{step.title}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{step.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
        
        {/* Правая панель - детали шага */}
        <div className="md:w-2/3">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center mb-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                activeStep.isCompleted
                  ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400'
                  : 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400'
              }`}>
                {activeStep.isCompleted ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white">{activeStep.title}</h2>
            </div>
            
            <p className="text-gray-600 dark:text-gray-300 mb-6">{activeStep.description}</p>
            
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-800 dark:text-white">Инструкции:</h3>
              <ol className="space-y-3">
                {activeStep.instructions.map((instruction, index) => (
                  <li key={index} className="flex items-start">
                    <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mr-3 flex-shrink-0 mt-0.5">
                      {index + 1}
                    </div>
                    <span className="text-gray-700 dark:text-gray-300">{instruction}</span>
                  </li>
                ))}
              </ol>
            </div>
            
            {activeStep.id === 'webhook-setup' && (
              <div className="mt-6">
                <Link href="/webhook-setup" className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90">
                  Перейти к настройке webhook
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </Link>
              </div>
            )}
            
            {activeStep.id === 'test-mini-app' && (
              <div className="mt-6">
                <Link href="/audit" className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90">
                  Запустить диагностику
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </Link>
              </div>
            )}
            
            {/* Статус шага */}
            <div className={`mt-6 p-3 rounded-md ${
              activeStep.isCompleted
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/30'
                : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/30'
            }`}>
              <div className="flex items-center">
                {activeStep.isCompleted ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                )}
                <p className={`text-sm ${
                  activeStep.isCompleted
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-yellow-600 dark:text-yellow-400'
                }`}>
                  {activeStep.isCompleted
                    ? 'Шаг выполнен успешно'
                    : 'Этот шаг требует вашего внимания'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Дополнительные ресурсы */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mt-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">Полезные ресурсы</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a
            href="https://core.telegram.org/bots/webapps"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div>
              <div className="font-medium text-gray-800 dark:text-white">Документация Telegram Mini Apps</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Официальная документация по Mini Apps</div>
            </div>
          </a>
          
          <a
            href="https://t.me/BotFather"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <div>
              <div className="font-medium text-gray-800 dark:text-white">BotFather</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Создание и настройка ботов в Telegram</div>
            </div>
          </a>
          
          <Link href="/debug" className="flex items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <div>
              <div className="font-medium text-gray-800 dark:text-white">Страница отладки</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Подробная отладка Telegram интеграции</div>
            </div>
          </Link>
          
          <Link href="/audit" className="flex items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-md hover:bg-gray-100 dark:hover:bg-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <div>
              <div className="font-medium text-gray-800 dark:text-white">Полный аудит</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Комплексная диагностика всех систем</div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default TelegramSetupGuide;