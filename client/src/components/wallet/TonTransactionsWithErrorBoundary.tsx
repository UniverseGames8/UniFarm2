import React from 'react';
import QueryErrorBoundary from '@/components/common/QueryErrorBoundary';
import TonTransactions from './TonTransactions';
import { useUser } from '@/contexts/userContext';
import { useQueryClient } from '@tanstack/react-query';

interface TonTransactionsWithErrorBoundaryProps {
  userId?: number;
  limit?: number;
}

/**
 * Компонент, оборачивающий TonTransactions в ErrorBoundary
 * для обеспечения устойчивости к ошибкам
 */
const TonTransactionsWithErrorBoundary: React.FC<TonTransactionsWithErrorBoundaryProps> = ({
  userId,
  limit = 50
}) => {
  const queryClient = useQueryClient();
  const { userId: contextUserId } = useUser();
  
  // Используем ID из пропсов или из контекста
  const actualUserId = userId || contextUserId;
  
  // Обработчик сброса состояния ошибки и инвалидации данных
  const handleReset = () => {
    if (actualUserId) {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/v2/transactions/ton', actualUserId] 
      });
    }
  };
  
  return (
    <QueryErrorBoundary
      onReset={handleReset}
      queryKey={actualUserId ? ['/api/v2/transactions/ton', actualUserId] : undefined}
      errorTitle="Ошибка загрузки TON транзакций"
      errorDescription="Не удалось загрузить историю ваших TON транзакций. Пожалуйста, обновите страницу или повторите позже."
      resetButtonText="Обновить историю"
    >
      {/* Передаем компонент без параметров, т.к. он сам использует контекст */}
      <TonTransactions />
    </QueryErrorBoundary>
  );
};

export default TonTransactionsWithErrorBoundary;