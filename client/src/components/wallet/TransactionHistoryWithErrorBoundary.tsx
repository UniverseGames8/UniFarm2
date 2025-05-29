import React from 'react';
import QueryErrorBoundary from '@/components/common/QueryErrorBoundary';
import TransactionHistory from './TransactionHistory';
import { useUser } from '@/contexts/userContext';
import { useQueryClient } from '@tanstack/react-query';

interface TransactionHistoryWithErrorBoundaryProps {
  userId?: number;
  limit?: number;
}

/**
 * Компонент, оборачивающий TransactionHistory в ErrorBoundary
 * для обеспечения устойчивости к ошибкам
 */
const TransactionHistoryWithErrorBoundary: React.FC<TransactionHistoryWithErrorBoundaryProps> = ({
  userId,
  limit = 10
}) => {
  const queryClient = useQueryClient();
  const { userId: contextUserId } = useUser();
  
  // Используем ID из пропсов или из контекста
  const actualUserId = userId || contextUserId;
  
  // Обработчик сброса состояния ошибки и инвалидации данных
  const handleReset = () => {
    if (actualUserId) {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/v2/transactions', actualUserId] 
      });
    }
  };
  
  return (
    <QueryErrorBoundary
      onReset={handleReset}
      queryKey={actualUserId ? ['/api/v2/transactions', actualUserId] : undefined}
      errorTitle="Ошибка загрузки транзакций"
      errorDescription="Не удалось загрузить историю ваших транзакций. Пожалуйста, обновите страницу или повторите позже."
      resetButtonText="Обновить историю"
    >
      {/* Здесь явно не передаем параметр, чтобы он использовал внутренний limit из компонента */}
      <TransactionHistory />
    </QueryErrorBoundary>
  );
};

export default TransactionHistoryWithErrorBoundary;