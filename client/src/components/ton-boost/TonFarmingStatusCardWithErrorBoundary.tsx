import React from 'react';
import QueryErrorBoundary from '@/components/common/QueryErrorBoundary';
import TonFarmingStatusCard from './TonFarmingStatusCard';
import { useQueryClient } from '@tanstack/react-query';
import { useUser } from '@/contexts/userContext';

/**
 * Компонент, оборачивающий TonFarmingStatusCard в ErrorBoundary
 * для обеспечения устойчивости к ошибкам
 */
const TonFarmingStatusCardWithErrorBoundary: React.FC = () => {
  const queryClient = useQueryClient();
  const { userId } = useUser();
  
  // Обработчик сброса состояния ошибки и инвалидации данных
  const handleReset = () => {
    if (userId) {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/ton-farming', userId] 
      });
      
      queryClient.invalidateQueries({ 
        queryKey: ['/api/users', userId] 
      });
    }
  };
  
  return (
    <QueryErrorBoundary
      onReset={handleReset}
      queryKey={userId ? ['/api/ton-farming', userId] : undefined}
      errorTitle="Ошибка загрузки данных о TON фарминге"
      errorDescription="Не удалось загрузить информацию о вашем TON фарминге. Пожалуйста, обновите страницу или повторите позже."
      resetButtonText="Обновить данные"
    >
      <TonFarmingStatusCard />
    </QueryErrorBoundary>
  );
};

export default TonFarmingStatusCardWithErrorBoundary;