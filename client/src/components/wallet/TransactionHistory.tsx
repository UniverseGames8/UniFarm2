import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser } from '@/contexts/userContext';
import { useNotification } from '@/contexts/notificationContext';
import useErrorBoundary from '@/hooks/useErrorBoundary';
import {
  fetchTransactions,
  Transaction
} from '@/services/transactionService';
import {
  formatDateTime,
  formatTransactionAmount,
  getTransactionColorClass,
  getTransactionIcon
} from '@/utils/formatters';

/**
 * Компонент для отображения истории транзакций пользователя
 */
const TransactionHistory: React.FC = () => {
  // Состояние для активного фильтра
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'UNI' | 'TON'>('ALL');
  
  // Состояние для пагинации
  const [page, setPage] = useState(1);
  const [limit] = useState(50); // Количество записей на странице
  
  // Получаем данные пользователя из контекста
  const { userId } = useUser();
  
  // Получаем доступ к системе уведомлений
  const { showNotification } = useNotification();
  
  // Запрос транзакций через React Query с использованием transactionService
  const {
    data: transactions = [],
    isLoading,
    error,
    isFetching,
    refetch
  } = useQuery<Transaction[]>({
    queryKey: ['/api/transactions', userId, page, limit],
    queryFn: async () => {
      if (!userId) return Promise.resolve([]);
      
      try {
        return await fetchTransactions(userId, limit, (page - 1) * limit);
      } catch (err) {
        console.error('[TransactionHistory] Ошибка загрузки транзакций:', err);
        return [];
      }
    },
    enabled: !!userId, // Запрос активен только если есть userId
    staleTime: 300000, // 5 минут до устаревания данных
    refetchOnWindowFocus: false, // Не обновлять при фокусе окна
    refetchOnMount: true, // Обновлять только при монтировании компонента
    refetchOnReconnect: false, // Не обновлять при восстановлении соединения
    refetchInterval: false, // Отключаем автоматическое обновление по интервалу
  });
  
  // Обновляем данные при изменении userId или страницы, но только один раз при изменении
  useEffect(() => {
    // Создаем флаг, чтобы избежать повторных вызовов
    let isMounted = true;
    
    if (userId && isMounted) {
      console.log('[TransactionHistory] Однократное обновление транзакций при изменении userId или страницы');
      
      // Используем setTimeout, чтобы избежать повторных вызовов
      const timer = setTimeout(() => {
        if (isMounted) {
          refetch()
            .catch(err => {
              // Показываем уведомление об ошибке загрузки только если компонент еще смонтирован
              if (isMounted) {
                showNotification('error', {
                  message: 'Не удалось загрузить историю транзакций',
                  duration: 3000
                });
              }
            });
        }
      }, 300);
      
      // Очистка при размонтировании
      return () => {
        isMounted = false;
        clearTimeout(timer);
      };
    }
  }, [userId, page]); // Убираем refetch и showNotification из зависимостей
  
  // Логгирование транзакций TON для отладки
  const tonTransactions = transactions.filter(tx => tx.tokenType === 'TON');
  console.log('[TransactionHistory] TON транзакции:', tonTransactions);
  
  // Фильтрация транзакций по выбранному токену
  const filteredTransactions = transactions.filter(transaction => {
    if (activeFilter === 'ALL') return true;
    // Нормализуем tokenType для сравнения
    const normalizedTokenType = transaction.tokenType?.toUpperCase();
    return normalizedTokenType === activeFilter;
  });
  
  // Статусы для отображения в UI
  const isEmpty = !isLoading && !error && filteredTransactions.length === 0 && transactions.length === 0;
  const isEmptyFiltered = !isLoading && !error && filteredTransactions.length === 0 && transactions.length > 0;
  const hasTransactions = !isLoading && !error && filteredTransactions.length > 0;
  
  // Однократные уведомления о пустом списке транзакций и успешной загрузке
  useEffect(() => {
    // Создаем флаг первого запуска для предотвращения повторных показов уведомлений
    let firstLoad = true;
    let timer: number | undefined;
    
    if (!isLoading && !isFetching && userId && firstLoad) {
      firstLoad = false; // Выполняем только один раз после загрузки
      
      if (isEmpty) {
        // Показываем уведомление при полностью пустом списке
        showNotification('info', {
          message: 'У вас пока нет операций',
          duration: 4000
        });
      } else if (hasTransactions && transactions.length > 0) {
        // Показываем уведомление при успешной загрузке транзакций
        // Используем setTimeout чтобы не показывать уведомление при каждом рендере
        timer = window.setTimeout(() => {
          showNotification('success', {
            message: `Загружено ${transactions.length} транзакций`,
            duration: 2000
          });
        }, 1000);
      }
    }
    
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [isEmpty]); // Реагируем только на изменение флага isEmpty
  
  // Используем Error Boundary для обработки ошибок в React Query
  const withErrorBoundary = useErrorBoundary({
    queryKey: ['/api/transactions', userId],
    errorTitle: 'Ошибка загрузки истории транзакций',
    errorDescription: 'Не удалось загрузить историю ваших транзакций. Попробуйте обновить страницу или повторите позже.',
    resetButtonText: 'Обновить историю'
  });

  // Оборачиваем весь компонент в Error Boundary
  return withErrorBoundary(
    <div className="bg-card rounded-xl p-5 mb-5 shadow-lg overflow-hidden relative">
      {/* Декоративный градиентный фон */}
      <div 
        className="absolute inset-0 opacity-20 z-0" 
        style={{
          background: 'radial-gradient(circle at 10% 20%, rgba(162, 89, 255, 0.2) 0%, transparent 70%), radial-gradient(circle at 80% 70%, rgba(92, 120, 255, 0.2) 0%, transparent 70%)'
        }}
      ></div>
      
      {/* Неоновая рамка */}
      <div className="absolute inset-0 rounded-xl border border-primary/30"></div>
      
      {/* Заголовок и фильтры */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 relative z-10">
        <h2 className="text-lg font-semibold text-white flex items-center mb-3 md:mb-0">
          <i className="fas fa-history text-primary mr-2"></i>
          История транзакций
        </h2>
        
        {/* Фильтры */}
        <div className="flex rounded-lg bg-black/30 p-0.5">
          <button 
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${activeFilter === 'ALL' ? 'bg-primary/80 text-white' : 'text-gray-400 hover:text-white'}`}
            onClick={() => {
              setActiveFilter('ALL');
              showNotification('info', {
                message: 'Показаны все транзакции',
                duration: 1500
              });
            }}
          >
            Все
          </button>
          <button 
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${activeFilter === 'UNI' ? 'bg-green-600/80 text-white' : 'text-gray-400 hover:text-white'}`}
            onClick={() => {
              setActiveFilter('UNI');
              showNotification('info', {
                message: 'Отфильтрованы транзакции в UNI',
                duration: 1500
              });
            }}
          >
            UNI
          </button>
          <button 
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${activeFilter === 'TON' ? 'bg-cyan-600/80 text-white' : 'text-gray-400 hover:text-white'}`}
            onClick={() => {
              setActiveFilter('TON');
              showNotification('info', {
                message: 'Отфильтрованы транзакции в TON',
                duration: 1500
              });
            }}
          >
            TON
          </button>
        </div>
      </div>
      
      {/* Скролл контейнер с эффектами затухания */}
      <div className="relative overflow-hidden">
        {/* Эффект затухания вверху */}
        <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-card to-transparent z-10 pointer-events-none"></div>
        
        {/* Эффект затухания внизу */}
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-card to-transparent z-10 pointer-events-none"></div>
        
        {/* Скроллируемый контейнер с настраиваемым скроллбаром */}
        <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900/20 relative z-0 pr-1">
          {isLoading || isFetching ? (
            // Скелетон загрузки
            Array(5).fill(0).map((_, index) => (
              <div key={`skeleton-${index}`} className="flex items-center justify-between py-3 border-b border-gray-800/50 px-2">
                <div className="flex items-center">
                  <Skeleton className="w-9 h-9 rounded-full bg-gray-800/50 mr-3" />
                  <div>
                    <Skeleton className="w-32 h-4 bg-gray-800/50 mb-2" />
                    <Skeleton className="w-24 h-3 bg-gray-800/50" />
                  </div>
                </div>
                <Skeleton className="w-20 h-7 bg-gray-800/50" />
              </div>
            ))
          ) : error ? (
            // Отображение ошибки при сбое запроса
            <div className="py-6 text-center text-red-500">
              <i className="fas fa-exclamation-triangle mb-2 text-2xl"></i>
              <p>Ошибка загрузки транзакций</p>
              <button 
                onClick={() => {
                  // Показываем уведомление о попытке перезагрузки
                  showNotification('loading', {
                    message: 'Загрузка транзакций...',
                    duration: 2000
                  });
                  
                  // Перезагружаем транзакции
                  refetch()
                    .then(() => {
                      // Показываем уведомление об успешной загрузке
                      showNotification('success', {
                        message: 'Транзакции успешно обновлены',
                        duration: 3000
                      });
                    })
                    .catch(err => {
                      // Показываем уведомление об ошибке
                      showNotification('error', {
                        message: 'Не удалось загрузить транзакции',
                        duration: 3000
                      });
                    });
                }} 
                className="mt-3 px-4 py-1.5 bg-red-500/20 text-red-400 rounded-md text-sm hover:bg-red-500/30 transition-colors"
              >
                Повторить
              </button>
            </div>
          ) : isEmpty ? (
            // Отображение пустого результата
            <div className="py-8 text-center text-gray-500">
              <i className="fas fa-wallet mb-3 text-3xl"></i>
              <p className="text-lg">У вас пока нет транзакций</p>
            </div>
          ) : isEmptyFiltered ? (
            // Пустое состояние для выбранного фильтра
            <div className="py-6 text-center text-gray-500">
              <i className="fas fa-search mb-2 text-2xl"></i>
              <p>Транзакции типа {activeFilter} не найдены</p>
              <button 
                className="mt-3 px-4 py-1.5 bg-primary/20 text-primary rounded-md text-sm hover:bg-primary/30 transition-colors"
                onClick={() => {
                  setActiveFilter('ALL');
                  showNotification('info', {
                    message: 'Фильтры сброшены, показаны все транзакции',
                    duration: 2000
                  });
                }}
              >
                Показать все транзакции
              </button>
            </div>
          ) : hasTransactions ? (
            // Отображение транзакций
            filteredTransactions.map((transaction, index) => (
              <div 
                key={`transaction-${transaction.id}`}
                className="flex items-center justify-between py-3 border-b border-gray-800/50 hover:bg-black/20 transition-all duration-300 px-2 rounded-md animate-fadeIn"
              >
                <div className="flex items-center">
                  {/* Иконка транзакции в зависимости от типа токена и типа транзакции */}
                  <div className={`w-9 h-9 rounded-full ${
                    transaction.tokenType === 'UNI' 
                      ? 'bg-green-500/20' 
                      : transaction.type === 'ton_boost' || transaction.type === 'boost'
                        ? 'bg-indigo-500/20'
                        : transaction.type === 'ton_farming_reward'
                          ? 'bg-amber-500/20'
                          : 'bg-cyan-500/20'
                    } flex items-center justify-center mr-3 transition-all duration-300`}>
                    <i className={`fas ${getTransactionIcon(transaction.type, transaction.tokenType)} ${
                      transaction.tokenType === 'UNI' 
                        ? 'text-green-400' 
                        : transaction.type === 'ton_boost' || transaction.type === 'boost'
                          ? 'text-indigo-400'
                          : transaction.type === 'ton_farming_reward'
                            ? 'text-amber-400'
                            : 'text-cyan-400'
                    }`}></i>
                  </div>
                  
                  <div>
                    {/* Название и тип транзакции */}
                    <div className="flex items-center">
                      <p className="text-white text-sm font-medium">{transaction.title || 'Транзакция'}</p>
                      {/* Индикатор новых транзакций (для первых двух) */}
                      {index < 2 && (
                        <span className="ml-2 text-[10px] bg-purple-600/80 text-white px-1.5 py-0.5 rounded animate-pulseGlow">Новая</span>
                      )}
                    </div>
                    <div className="flex items-center mt-0.5">
                      <span className="text-xs text-gray-500 mr-2">{formatDateTime(transaction.timestamp)}</span>
                      <span className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded-sm">
                        {transaction.source || transaction.type}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Сумма транзакции */}
                <div className={`px-2 py-1 rounded ${getTransactionColorClass(transaction.tokenType, transaction.type)} font-medium text-sm`}>
                  {formatTransactionAmount(transaction.amount, transaction.tokenType, transaction.type)}
                </div>
              </div>
            ))
          ) : (
            // Этот блок не должен выполниться, но оставляем для безопасности
            <div className="py-6 text-center text-gray-500">
              <i className="fas fa-search mb-2 text-2xl"></i>
              <p>Непредвиденная ошибка отображения</p>
              <button 
                className="mt-3 px-4 py-1.5 bg-red-500/20 text-red-400 rounded-md text-sm hover:bg-red-500/30 transition-colors"
                onClick={() => refetch()}
              >
                Обновить
              </button>
            </div>
          )}
          
          {/* Индикатор загрузки при подгрузке следующей страницы */}
          {isFetching && !isLoading && (
            <div className="py-2 text-center text-primary">
              <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransactionHistory;