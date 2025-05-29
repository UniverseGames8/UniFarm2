/**
 * ЭТАП 2: Демонстрационная страница для интеграции кнопок Boost
 * 
 * Этот компонент показывает:
 * 1. Практическое использование useBoostButtons
 * 2. Динамическое управление MainButton и BackButton
 * 3. Интеграцию с действиями пользователя
 * 4. Логирование всех действий для отладки
 */

import React, { useState } from 'react';
import { useBoostButtons } from '../hooks/useTelegramButtons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const BoostDemo: React.FC = () => {
  // ЭТАП 2: Инициализация кнопок для страницы бустов
  const boostButtons = useBoostButtons();
  
  // ЭТАП 2: Состояние для демонстрации
  const [boostCount, setBoostCount] = useState(0);
  const [boostActive, setBoostActive] = useState(false);
  const [lastAction, setLastAction] = useState<string>('');

  // ЭТАП 2: Обработчики для различных действий с бустами
  const handleOpenBoost = () => {
    console.log('[BOOST DEMO] 🚀 Открытие нового буста...');
    setBoostCount(prev => prev + 1);
    setBoostActive(true);
    setLastAction(`Открыт буст #${boostCount + 1}`);
    
    // ЭТАП 2: Меняем кнопку на "Купить Boost" после открытия
    setTimeout(() => {
      boostButtons.showPurchaseBoost(handlePurchaseBoost);
    }, 1000);
  };

  const handlePurchaseBoost = () => {
    console.log('[BOOST DEMO] 💎 Покупка буста...');
    setLastAction('Буст успешно куплен!');
    
    // ЭТАП 2: Возвращаем кнопку "Открыть Boost" для следующего буста
    setTimeout(() => {
      boostButtons.showOpenBoost(handleOpenBoost);
    }, 2000);
  };

  // ЭТАП 2: Настройка кнопок при загрузке страницы
  React.useEffect(() => {
    console.log('[BOOST DEMO] 🔘 Настройка кнопок для демо бустов...');
    
    // Показываем кнопку открытия буста
    boostButtons.showOpenBoost(handleOpenBoost);
    
    // Показываем кнопку возврата на главную
    boostButtons.showBackToHome();
    
    return () => {
      // ЭТАП 2: Очистка кнопок при размонтировании
      console.log('[BOOST DEMO] 🧹 Очистка кнопок...');
      boostButtons.hideMainButton();
      boostButtons.hideBackButton();
    };
  }, []);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Boost Demo - Telegram кнопки</h1>
      
      {/* ЭТАП 2: Информационная карточка */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>🚀 Telegram WebApp Button Integration</CardTitle>
          <CardDescription>
            Демонстрация работы MainButton и BackButton в реальном времени
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">📊 Статистика:</h3>
              <p className="text-sm text-muted-foreground">
                Открыто бустов: <span className="font-bold text-primary">{boostCount}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Статус: <span className={`font-bold ${boostActive ? 'text-green-500' : 'text-gray-500'}`}>
                  {boostActive ? 'Активен' : 'Неактивен'}
                </span>
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">🎯 Последнее действие:</h3>
              <p className="text-sm text-muted-foreground">
                {lastAction || 'Нет действий'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ЭТАП 2: Карточка с инструкциями */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>🔘 Управление через Telegram кнопки</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">🔵</span>
              <div>
                <p className="font-semibold">MainButton (Синяя кнопка внизу)</p>
                <p className="text-sm text-muted-foreground">
                  Нажмите для выполнения основного действия: "Открыть Boost" или "Купить Boost"
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-2xl">⬅️</span>
              <div>
                <p className="font-semibold">BackButton (Стрелка назад)</p>
                <p className="text-sm text-muted-foreground">
                  Нажмите для возврата на главную страницу
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ЭТАП 2: Логи для отладки */}
      <Card>
        <CardHeader>
          <CardTitle>📝 Отладочная информация</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md">
            <p className="text-xs font-mono">
              Все действия логируются в консоль браузера
            </p>
            <p className="text-xs font-mono mt-1">
              Статус кнопок: {JSON.stringify(boostButtons.getState().mainButton.isVisible ? 'Видимы' : 'Скрыты')}
            </p>
          </div>
          
          {/* ЭТАП 2: Резервная кнопка для тестирования без Telegram */}
          <div className="mt-4">
            <p className="text-sm text-muted-foreground mb-2">
              Резервное управление (если Telegram недоступен):
            </p>
            <div className="flex space-x-2">
              <Button 
                onClick={handleOpenBoost}
                variant="outline"
                size="sm"
              >
                🚀 Открыть Boost
              </Button>
              <Button 
                onClick={handlePurchaseBoost}
                variant="outline"
                size="sm"
              >
                💎 Купить Boost
              </Button>
              <Button 
                onClick={() => boostButtons.navigate('/')}
                variant="outline"
                size="sm"
              >
                🏠 На главную
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BoostDemo;