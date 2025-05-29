import React from 'react';
import QueryErrorBoundary from '@/components/common/QueryErrorBoundary';
import UniFarmingCard from './UniFarmingCard';
import { useUser } from '@/contexts/userContext';
import { useQueryClient } from '@tanstack/react-query';

interface UniFarmingCardWithErrorBoundaryProps {
  userData: any;
}

/**
 * Компонент, оборачивающий UniFarmingCard в ErrorBoundary
 * для обеспечения устойчивости к ошибкам
 */
const UniFarmingCardWithErrorBoundary: React.FC<UniFarmingCardWithErrorBoundaryProps> = ({ userData }) => {
  const queryClient = useQueryClient();
  const { userId } = useUser();
  
  // Обработчик сброса состояния ошибки и инвалидации данных
  const handleReset = () => {
    if (userId) {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/v2/uni-farming/info', userId] 
      });
    }
  };
  
  return (
    <QueryErrorBoundary
      onReset={handleReset}
      queryKey={['/api/v2/uni-farming/info', userId]}
      errorTitle="Ошибка загрузки UNI фарминга"
      errorDescription="Не удалось загрузить информацию о вашем UNI фарминге. Пожалуйста, обновите страницу или повторите позже."
      resetButtonText="Обновить данные"
    >
      <UniFarmingCard userData={userData} />
    </QueryErrorBoundary>
  );
};

export default UniFarmingCardWithErrorBoundary;