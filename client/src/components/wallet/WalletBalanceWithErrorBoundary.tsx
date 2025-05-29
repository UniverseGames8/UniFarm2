import React from 'react';
import QueryErrorBoundary from '@/components/common/QueryErrorBoundary';
import BalanceCard from './BalanceCard';
import { useUser } from '@/contexts/userContext';
import { useQueryClient } from '@tanstack/react-query';

interface WalletBalanceWithErrorBoundaryProps {
  userId?: number;
}

/**
 * Компонент, оборачивающий BalanceCard в ErrorBoundary
 * для обеспечения устойчивости к ошибкам
 */
const WalletBalanceWithErrorBoundary: React.FC<WalletBalanceWithErrorBoundaryProps> = ({ userId }) => {
  const queryClient = useQueryClient();
  const { userId: contextUserId } = useUser();
  
  // Используем ID из пропсов или из контекста
  const actualUserId = userId || contextUserId;
  
  // Обработчик сброса состояния ошибки и инвалидации данных
  const handleReset = () => {
    if (actualUserId) {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/v2/users', actualUserId] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['/api/v2/wallet/balance', actualUserId] 
      });
    }
  };
  
  return (
    <QueryErrorBoundary
      onReset={handleReset}
      queryKey={actualUserId ? ['/api/v2/users', actualUserId] : undefined}
      errorTitle="Ошибка загрузки баланса"
      errorDescription="Не удалось загрузить информацию о вашем балансе. Пожалуйста, обновите страницу или повторите позже."
      resetButtonText="Обновить баланс"
    >
      <BalanceCard />
    </QueryErrorBoundary>
  );
};

export default WalletBalanceWithErrorBoundary;