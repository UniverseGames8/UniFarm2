import React, { useState } from 'react';
import { Link } from 'wouter';
import TelegramDiagnostics from '@/components/debug/TelegramDiagnostics';
import ReferralSystemDiagnostics from '@/components/debug/ReferralSystemDiagnostics';
import ApiAndWebSocketDiagnostics from '@/components/debug/ApiAndWebSocketDiagnostics';
import UiDiagnostics from '@/components/debug/UiDiagnostics';

/**
 * Страница полной диагностики и аудита UniFarming
 * Объединяет все диагностические компоненты в единую консоль
 */

const AuditPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('telegram');

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">UniFarm Полный Аудит</h1>
        <Link href="/" className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md text-sm">
          Вернуться в приложение
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden mb-6">
        <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          <button
            className={`px-4 py-3 text-sm font-medium ${
              activeTab === 'telegram'
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
            onClick={() => setActiveTab('telegram')}
          >
            Telegram
          </button>
          <button
            className={`px-4 py-3 text-sm font-medium ${
              activeTab === 'api'
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
            onClick={() => setActiveTab('api')}
          >
            API и WebSocket
          </button>
          <button
            className={`px-4 py-3 text-sm font-medium ${
              activeTab === 'referral'
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
            onClick={() => setActiveTab('referral')}
          >
            Реферальная система
          </button>
          <button
            className={`px-4 py-3 text-sm font-medium ${
              activeTab === 'ui'
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
            onClick={() => setActiveTab('ui')}
          >
            UI компоненты
          </button>
          <button
            className={`px-4 py-3 text-sm font-medium ${
              activeTab === 'summary'
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
            onClick={() => setActiveTab('summary')}
          >
            Итоговый отчет
          </button>
        </div>

        <div className="p-4">
          {activeTab === 'telegram' && (
            <div>
              <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Диагностика Telegram Mini App</h2>
              <TelegramDiagnostics />
            </div>
          )}

          {activeTab === 'api' && (
            <div>
              <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Проверка API и WebSocket соединений</h2>
              <ApiAndWebSocketDiagnostics />
            </div>
          )}

          {activeTab === 'referral' && (
            <div>
              <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Аудит реферальной системы</h2>
              <ReferralSystemDiagnostics />
            </div>
          )}

          {activeTab === 'ui' && (
            <div>
              <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Проверка UI компонентов</h2>
              <UiDiagnostics />
            </div>
          )}

          {activeTab === 'summary' && (
            <div>
              <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Итоговый отчет аудита</h2>
              
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md mb-4">
                <h3 className="text-lg font-medium text-gray-800 dark:text-white mb-2">Общий статус системы</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-gray-800 p-3 rounded-md shadow-sm">
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Telegram интеграция</div>
                    <div className="mt-1 flex items-center">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
                      <span className="text-yellow-700 dark:text-yellow-500 font-medium">Требует внимания</span>
                    </div>
                  </div>
                  
                  <div className="bg-white dark:bg-gray-800 p-3 rounded-md shadow-sm">
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400">API и WebSocket</div>
                    <div className="mt-1 flex items-center">
                      <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                      <span className="text-green-700 dark:text-green-500 font-medium">Работает</span>
                    </div>
                  </div>
                  
                  <div className="bg-white dark:bg-gray-800 p-3 rounded-md shadow-sm">
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Реферальная система</div>
                    <div className="mt-1 flex items-center">
                      <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                      <span className="text-green-700 dark:text-green-500 font-medium">Работает</span>
                    </div>
                  </div>
                  
                  <div className="bg-white dark:bg-gray-800 p-3 rounded-md shadow-sm">
                    <div className="text-sm font-medium text-gray-500 dark:text-gray-400">UI компоненты</div>
                    <div className="mt-1 flex items-center">
                      <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                      <span className="text-green-700 dark:text-green-500 font-medium">Работает</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-900/30 p-4 rounded-md mb-4">
                <h3 className="text-lg font-medium text-yellow-800 dark:text-yellow-500 mb-2">Выявленные проблемы</h3>
                <ul className="list-disc list-inside space-y-2 text-yellow-700 dark:text-yellow-500">
                  <li>Telegram WebApp API не доступен или не передает данные пользователя</li>
                  <li>Аутентификация через Telegram использует механизм обхода через заголовки разработки</li>
                  <li>Использование фиксированного ID пользователя (1) в режиме разработки</li>
                </ul>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/30 p-4 rounded-md">
                <h3 className="text-lg font-medium text-blue-800 dark:text-blue-500 mb-2">Рекомендации</h3>
                <ul className="list-disc list-inside space-y-2 text-blue-700 dark:text-blue-500">
                  <li>Проверить настройки домена в BotFather, убедиться что домен добавлен в список разрешенных</li>
                  <li>Выполнить настройку вебхука для улучшения взаимодействия с Telegram API</li>
                  <li>Обновить ключ бота, убедиться что у бота есть разрешения на использование Mini App</li>
                  <li>Проверить правильность установки meta-тега viewport для корректного отображения в Telegram</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md mb-4">
        <h2 className="text-lg font-semibold mb-2 text-gray-800 dark:text-white">Быстрые действия</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          <Link href="/telegram-setup" className="bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 py-2 px-3 rounded text-sm text-center font-medium text-blue-700 dark:text-blue-400">
            Настройка Telegram
          </Link>
          <Link href="/debug" className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 py-2 px-3 rounded text-sm text-center">
            Телеграм отладка
          </Link>
          <Link href="/referral-debug" className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 py-2 px-3 rounded text-sm text-center">
            Реферальная отладка
          </Link>
          <Link href="/webhook-setup" className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 py-2 px-3 rounded text-sm text-center">
            Настройка вебхука
          </Link>
          <Link href="/admin" className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 py-2 px-3 rounded text-sm text-center">
            Админ-панель
          </Link>
        </div>
      </div>

      <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
        UniFarm диагностический инструмент • {new Date().toLocaleDateString()}
      </div>
    </div>
  );
};

export default AuditPage;