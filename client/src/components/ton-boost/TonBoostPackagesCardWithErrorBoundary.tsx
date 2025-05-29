import React from 'react';
import QueryErrorBoundary from '@/components/common/QueryErrorBoundary';
import TonBoostPackagesCard from './BoostPackagesCard';
import { useQueryClient } from '@tanstack/react-query';
import { useUser } from '@/contexts/userContext';

/**
 * Компонент, оборачивающий TonBoostPackagesCard в ErrorBoundary
 * для обеспечения устойчивости к ошибкам
 */
const TonBoostPackagesCardWithErrorBoundary: React.FC = () => {
  const queryClient = useQueryClient();
  const { userId } = useUser();
  
  // Обработчик сброса состояния ошибки и инвалидации данных
  const handleReset = () => {
    queryClient.invalidateQueries({ 
      queryKey: ['/api/ton-boost-packages'] 
    });
    
    if (userId) {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/users', userId] 
      });
    }
  };
  
  return (
    <QueryErrorBoundary
      onReset={handleReset}
      queryKey={['/api/ton-boost-packages']}
      errorTitle="Ошибка загрузки TON бустов"
      errorDescription="Не удалось загрузить информацию о доступных TON бустах. Пожалуйста, обновите страницу или повторите позже."
      resetButtonText="Обновить данные"
    >
      <TonBoostPackagesCard />
    </QueryErrorBoundary>
  );
};

export default TonBoostPackagesCardWithErrorBoundary;