import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Transaction, fetchTonTransactions } from '@/services/transactionService';
import { useUser } from '@/contexts/userContext';
import { formatAmount, formatDate } from '@/utils/formatters';
import TransactionItem from './TransactionItem';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowDown } from 'lucide-react';

/**
 * Компонент для отображения исключительно TON транзакций
 */
const TonTransactions: React.FC = () => {
  const { userId } = useUser();
  const [limit, setLimit] = useState(50); // Увеличенный лимит для TON транзакций
  
  // Используем специализированный запрос для TON транзакций
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['/api/transactions', 'ton', userId, limit],
    enabled: !!userId,
    queryFn: async () => {
      console.log('[TonTransactions] Запрос TON транзакций, userId:', userId, 'limit:', limit);
      try {
        const result = await fetchTonTransactions(userId as number, limit);
        console.log('[TonTransactions] Получены данные в queryFn:', result);
        return result;
      } catch (err) {
        console.error('[TonTransactions] Ошибка в queryFn:', err);
        throw err;
      }
    },
    staleTime: 1000 * 30 // Обновлять кэш каждые 30 секунд
  });

  useEffect(() => {
    // Логирование для отладки
    if (data && Array.isArray(data)) {
      console.log('[TonTransactions] Получены данные о TON транзакциях:', data.length);
      
      if (data.length > 0) {
        console.log('[TonTransactions] Пример TON транзакции:', data[0]);
      }
    }
  }, [data]);

  // Визуализация загрузки
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array(3).fill(0).map((_, i) => (
          <div key={i} className="flex items-center space-x-4 rounded-md border p-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-[250px]" />
              <Skeleton className="h-4 w-[200px]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Обработка ошибок
  if (isError) {
    console.error('[TonTransactions] Ошибка запроса TON транзакций:', error);
    return (
      <div className="text-center p-4 text-destructive">
        <p>Произошла ошибка при загрузке TON транзакций</p>
      </div>
    );
  }

  // Защита от неверного формата данных
  if (!data || !Array.isArray(data)) {
    console.error('[TonTransactions] Неверный формат данных:', data);
    return (
      <div className="text-center p-4 text-destructive">
        <p>Ошибка формата данных</p>
      </div>
    );
  }

  // Отображаем все транзакции (они уже отфильтрованы в fetchTonTransactions)
  const tonTransactions = data;
  
  // Применяем лимит отображения к транзакциям (если нужно)
  const displayLimit = Math.min(limit, tonTransactions.length);
  const limitedTransactions = tonTransactions.slice(0, displayLimit);

  // Обработчик для загрузки дополнительных транзакций
  const handleLoadMore = () => {
    setLimit(prev => prev + 10);
  };

  return (
    <div>
      {tonTransactions.length === 0 ? (
        <div className="text-center p-4 text-muted-foreground">
          <p>У вас пока нет TON транзакций</p>
          <p className="mt-2 text-sm">
            Приобретите TON Boost на вкладке "TON Фарминг", чтобы начать получать доход в TON
          </p>
          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              className="text-blue-500 hover:text-blue-600"
              onClick={() => window.location.href = '/farming'}
            >
              Перейти к TON Boost
            </Button>
          </div>
        </div>
      ) : (
        <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900/20 space-y-3 pr-1" style={{ height: '400px' }}>
          {limitedTransactions.map((transaction: Transaction) => (
            <TransactionItem
              key={transaction.id}
              transaction={transaction}
            />
          ))}

          {/* Кнопка "Загрузить еще" - показываем только если есть еще транзакции */}
          {tonTransactions.length > displayLimit && (
            <div className="flex justify-center pt-3 pb-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadMore}
                className="gap-2 text-xs"
              >
                <ArrowDown className="h-3 w-3" />
                Загрузить еще
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TonTransactions;