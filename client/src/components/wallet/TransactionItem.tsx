import React from 'react';
import { formatAmount, formatDate } from '@/utils/formatters';
import { ArrowUpRight, ArrowDownLeft, Clock, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Transaction } from '@/services/transactionService';

interface TransactionItemProps {
  transaction: Transaction;
}

const TransactionItem: React.FC<TransactionItemProps> = ({ transaction }) => {
  const { type, amount, tokenType, timestamp, status, title, description, source = '' } = transaction;
  
  // Определение класса для суммы (положительная/отрицательная)
  const amountClass = amount >= 0 
    ? 'text-green-500 dark:text-green-400' 
    : 'text-red-500 dark:text-red-400';
  
  // Проверяем, что транзакция связана с TON Boost
  const isTonBoostRelated = 
    source.toLowerCase().includes('ton boost') || 
    source.toLowerCase().includes('ton farming') ||
    (description && description.toLowerCase().includes('ton')) ||
    type.includes('ton_boost') ||
    type === 'boost_purchase' ||
    type === 'ton_farming_reward' ||
    type === 'boost_bonus';
    
  // Логирование для диагностики TON Boost транзакций
  if (isTonBoostRelated) {
    console.log('[TransactionItem] Отображение TON Boost транзакции:', {
      id: transaction.id,
      type,
      source,
      tokenType,
      amount,
      timestamp
    });
  }
  
  // Определение типа для иконки
  const isIncoming = type.includes('deposit') || 
                    type.includes('reward') || 
                    type.includes('bonus') ||
                    type.includes('harvest');
  
  // Форматирование суммы с префиксом + для входящих
  const formattedAmount = isIncoming
    ? `+${formatAmount(amount, tokenType)}`
    : formatAmount(amount, tokenType);
  
  // Выбор иконки в зависимости от типа
  let TransactionIcon = isIncoming ? ArrowDownLeft : ArrowUpRight;
  
  // Для TON Boost транзакций используем специальную иконку
  if (isTonBoostRelated) {
    TransactionIcon = Zap;
  }
  
  // Цвет иконки в зависимости от типа
  let iconColorClass = isIncoming 
    ? 'text-green-500 bg-green-500/10' 
    : 'text-red-500 bg-red-500/10';
    
  // Для TON Boost транзакций используем синий цвет
  if (isTonBoostRelated) {
    iconColorClass = 'text-blue-500 bg-blue-500/10';
  }

  // Определяем классы для карточки транзакции
  const cardClasses = `flex items-start space-x-4 rounded-md border p-4 bg-card/60 backdrop-blur-sm transition-all hover:bg-card
                      ${isTonBoostRelated ? 'border-blue-500/20 hover:border-blue-500/40' : ''}`;

  return (
    <div className={cardClasses}>
      <div className={`p-2 rounded-full ${iconColorClass}`}>
        <TransactionIcon className="h-4 w-4" />
      </div>
      
      <div className="flex-1 space-y-1">
        <div className="flex items-start justify-between">
          <div>
            {/* Показываем кастомные заголовки для TON Boost */}
            <p className="font-medium">
              {isTonBoostRelated ? (
                // Определяем тип TON Boost операции для заголовка
                type === 'boost_purchase' ? 'Покупка TON Boost' :
                (type === 'ton_farming_reward' || type.includes('ton_boost')) ? 'TON Boost доход' :
                type === 'boost_bonus' ? (tokenType === 'UNI' ? 'UNI бонус от TON Boost' : 'TON Boost доход') :
                title || 'TON Boost операция'
              ) : (
                // Для обычных транзакций показываем стандартный заголовок
                title || type
              )}
            </p>
            <p className="text-xs text-muted-foreground">{formatDate(timestamp)}</p>
            
            {/* Показываем источник для TON Boost транзакций */}
            {isTonBoostRelated && source && (
              <Badge variant="outline" className="mt-1 text-[10px] h-5">
                <Zap className="h-3 w-3 mr-1" />
                {source}
              </Badge>
            )}
          </div>
          
          <div className="text-right">
            <p className={`font-medium ${amountClass}`}>{formattedAmount}</p>
            
            {status && status !== 'completed' && (
              <Badge variant={status === 'pending' ? 'outline' : 'destructive'} className="text-[10px] h-5">
                {status === 'pending' ? (
                  <>
                    <Clock className="h-3 w-3 mr-1" />
                    в обработке
                  </>
                ) : (
                  'ошибка'
                )}
              </Badge>
            )}
          </div>
        </div>
        
        {/* Описание отображаем если оно есть */}
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
};

export default TransactionItem;