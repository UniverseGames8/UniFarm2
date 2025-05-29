import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UniFarmingCardWithErrorBoundary from '../components/farming/UniFarmingCardWithErrorBoundary';
import BoostPackagesCardWithErrorBoundary from '../components/farming/BoostPackagesCardWithErrorBoundary';
import TonBoostPackagesCardWithErrorBoundary from '../components/ton-boost/TonBoostPackagesCardWithErrorBoundary';
import TonFarmingStatusCardWithErrorBoundary from '../components/ton-boost/TonFarmingStatusCardWithErrorBoundary';
import ActiveTonBoostsCardWithErrorBoundary from '../components/ton-boost/ActiveTonBoostsCardWithErrorBoundary';
// ЭТАП 2: Импорт хука для управления кнопками фарминга
import { useFarmingButtons } from '../hooks/useTelegramButtons';

const Farming: React.FC = () => {
  // Хардкод ID=1 для демонстрации
  const userId = 1;
  
  // ЭТАП 2: Инициализация кнопок фарминга с обработчиками
  const farmingButtons = useFarmingButtons();
  
  // Получаем информацию о пользователе для отображения баланса
  const { data: userResponse } = useQuery({
    queryKey: [`/api/users/${userId}`],
  });
  
  // Извлекаем userData из ответа API
  const userData = (userResponse as any)?.data || null;

  // ЭТАП 2: Обработчики для действий фарминга
  const handleStartFarming = () => {
    console.log('[FARMING PAGE] 🌱 Начало фарминга для пользователя:', userId);
    // Здесь будет интеграция с API фарминга
  };

  const handleHarvestFarming = () => {
    console.log('[FARMING PAGE] 🌾 Сбор урожая для пользователя:', userId);
    // Здесь будет интеграция с API сбора урожая
  };

  // УБРАНА КНОПКА ФАРМИНГА - больше не показываем никаких кнопок внизу
  React.useEffect(() => {
    console.log('[FARMING PAGE] 🔘 Скрываем все кнопки Telegram...');
    
    // ПОЛНОСТЬЮ УБИРАЕМ ВСЕ КНОПКИ - чистый интерфейс без кнопок внизу
    farmingButtons.hideMainButton();
    farmingButtons.hideBackButton();
    
    // [FIX: REMOVE FARMING BUTTON] Очистка кнопок при выходе со страницы
    return () => {
      console.log('[FARMING PAGE] 🧹 Очистка кнопок при выходе со страницы фарминга');
      farmingButtons.hideMainButton();
      farmingButtons.hideBackButton();
    };
  }, []);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Фарминг</h1>
      
      <Tabs defaultValue="uni" className="w-full mb-6">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="uni" className="text-lg">UNI Фарминг</TabsTrigger>
          <TabsTrigger value="ton" className="text-lg">TON Фарминг</TabsTrigger>
        </TabsList>
        
        <TabsContent value="uni">
          {/* Основной UNI пакет */}
          <UniFarmingCardWithErrorBoundary userData={userData} />
          
          {/* UNI Boost Пакеты */}
          <BoostPackagesCardWithErrorBoundary userData={userData} />
        </TabsContent>
        
        <TabsContent value="ton">
          {/* Статус TON фарминга - с ErrorBoundary */}
          <TonFarmingStatusCardWithErrorBoundary />
          
          {/* Активные TON Boost-пакеты - с ErrorBoundary */}
          <ActiveTonBoostsCardWithErrorBoundary />
          
          {/* TON Boost-пакеты - с ErrorBoundary */}
          <div className="mb-6">
            <TonBoostPackagesCardWithErrorBoundary />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Farming;