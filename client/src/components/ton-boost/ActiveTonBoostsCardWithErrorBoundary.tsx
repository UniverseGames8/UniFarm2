import React from 'react';
import QueryErrorBoundary from '@/components/common/QueryErrorBoundary';
import ActiveTonBoostsCard from './ActiveTonBoostsCard';
import { useQueryClient } from '@tanstack/react-query';
import { useUser } from '@/contexts/userContext';

/**
 * Компонент, оборачивающий ActiveTonBoostsCard в ErrorBoundary
 * для обеспечения устойчивости к ошибкам
 */
const ActiveTonBoostsCardWithErrorBoundary: React.FC = () => {
  const queryClient = useQueryClient();
  const { userId } = useUser();
  
  // Обработчик сброса состояния ошибки и инвалидации данных
  const handleReset = () => {
    queryClient.invalidateQueries({ 
      queryKey: ['/api/ton-boosts/active', userId] 
    });
  };
  
  return (
    <QueryErrorBoundary
      onReset={handleReset}
      queryKey={['/api/ton-boosts/active', userId]}
      errorTitle="Ошибка загрузки активных TON бустов"
      errorDescription="Не удалось загрузить информацию о ваших активных TON бустах. Пожалуйста, обновите страницу или повторите позже."
      resetButtonText="Обновить данные"
    >
      <ActiveTonBoostsCard />
    </QueryErrorBoundary>
  );
};

export default ActiveTonBoostsCardWithErrorBoundary;