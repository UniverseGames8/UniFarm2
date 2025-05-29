import React from 'react';
import QueryErrorBoundary from '@/components/common/QueryErrorBoundary';
import WithdrawalForm from './WithdrawalForm';
import { useUser } from '@/contexts/userContext';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Компонент, оборачивающий WithdrawalForm в ErrorBoundary
 * для обеспечения устойчивости к ошибкам
 */
const WithdrawalFormWithErrorBoundary: React.FC = () => {
  const queryClient = useQueryClient();
  const { userId } = useUser();
  
  // Обработчик сброса состояния ошибки и инвалидации данных
  const handleReset = () => {
    if (userId) {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/v2/users', userId] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['/api/v2/wallet', userId] 
      });
    }
  };
  
  return (
    <QueryErrorBoundary
      onReset={handleReset}
      queryKey={userId ? ['/api/v2/wallet', userId] : undefined}
      errorTitle="Ошибка загрузки формы вывода"
      errorDescription="Не удалось загрузить форму вывода средств. Пожалуйста, обновите страницу или повторите позже."
      resetButtonText="Обновить форму"
    >
      <WithdrawalForm />
    </QueryErrorBoundary>
  );
};

export default WithdrawalFormWithErrorBoundary;