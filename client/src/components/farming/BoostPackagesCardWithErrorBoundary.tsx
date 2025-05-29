import React from 'react';
import QueryErrorBoundary from '@/components/common/QueryErrorBoundary';
import BoostPackagesCard from './BoostPackagesCard';
import { useUser } from '@/contexts/userContext';
import { useQueryClient } from '@tanstack/react-query';

interface BoostPackagesCardWithErrorBoundaryProps {
  userData: any;
}

/**
 * Компонент, оборачивающий BoostPackagesCard в ErrorBoundary
 * для обеспечения устойчивости к ошибкам
 */
const BoostPackagesCardWithErrorBoundary: React.FC<BoostPackagesCardWithErrorBoundaryProps> = ({ userData }) => {
  const queryClient = useQueryClient();
  const { userId } = useUser();
  
  // Обработчик сброса состояния ошибки и инвалидации данных
  const handleReset = () => {
    if (userId) {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/v2/boosts/packages'] 
      });
    }
  };
  
  return (
    <QueryErrorBoundary
      onReset={handleReset}
      queryKey={['/api/v2/boosts/packages']}
      errorTitle="Ошибка загрузки UNI бустов"
      errorDescription="Не удалось загрузить информацию о доступных UNI бустах. Пожалуйста, обновите страницу или повторите позже."
      resetButtonText="Обновить данные"
    >
      <BoostPackagesCard userData={userData} />
    </QueryErrorBoundary>
  );
};

export default BoostPackagesCardWithErrorBoundary;