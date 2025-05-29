import React from 'react';
import WalletBalanceWithErrorBoundary from '@/components/wallet/WalletBalanceWithErrorBoundary';
import TransactionHistoryWithErrorBoundary from '@/components/wallet/TransactionHistoryWithErrorBoundary';
import WithdrawalFormWithErrorBoundary from '@/components/wallet/WithdrawalFormWithErrorBoundary';

/**
 * Страница кошелька с информацией о балансе, формой вывода средств и историей транзакций
 */
const Wallet: React.FC = () => {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-semibold text-white">Ваш TON-кошелёк</h1>
      </div>
      
      {/* Отображаем карточку с балансом с ErrorBoundary */}
      <WalletBalanceWithErrorBoundary />
      
      {/* Отображаем форму вывода с ErrorBoundary */}
      <WithdrawalFormWithErrorBoundary />
      
      {/* Отображаем историю всех транзакций с ErrorBoundary */}
      <div className="mt-4">
        <h2 className="text-lg font-semibold text-white mb-4">История транзакций</h2>
        <TransactionHistoryWithErrorBoundary />
      </div>
    </div>
  );
};

export default Wallet;
