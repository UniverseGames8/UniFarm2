import React, { useState, useEffect } from 'react';
import { useUser } from '@/contexts/userContext';
import { useNotification } from '@/contexts/notificationContext';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { withdrawalSchema, createWithdrawalSchema, WithdrawalFormData } from '@/schemas/withdrawalSchema';
import {
  submitWithdrawal,
  isWithdrawalError,
  type WithdrawalError
} from '@/services/withdrawalService';

// Состояния отправки формы
enum SubmitState {
  IDLE = 'idle',
  SUBMITTING = 'submitting',
  SUCCESS = 'success',
  ERROR = 'error'
}

/**
 * Компонент формы для вывода средств
 * Использует userContext для получения данных о пользователе
 * и его балансе
 */
const WithdrawalForm: React.FC = () => {
  // Получаем данные пользователя и баланса из контекста
  const { 
    userId, 
    uniBalance, 
    tonBalance, 
    refreshBalance,
    walletAddress 
  } = useUser();
  
  // Базовые состояния формы и UI
  const [selectedCurrency, setSelectedCurrency] = useState<'UNI' | 'TON'>('TON');
  const [submitState, setSubmitState] = useState<SubmitState>(SubmitState.IDLE);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [messageSent, setMessageSent] = useState(false);
  const [transactionId, setTransactionId] = useState<number | null>(null);
  
  // Состояния для анимаций и эффектов фокуса
  const [addressFocused, setAddressFocused] = useState(false);
  const [amountFocused, setAmountFocused] = useState(false);
  
  // Хук для отображения уведомлений
  const { showNotification } = useNotification();
  
  // Получаем текущий баланс в зависимости от выбранной валюты
  const currentBalance = selectedCurrency === 'UNI' ? uniBalance : tonBalance;
  
  // Формируем схему валидации с учетом текущего баланса
  const formSchema = createWithdrawalSchema(currentBalance, selectedCurrency);
  
  // Инициализируем форму с react-hook-form и zod для валидации
  const form = useForm<WithdrawalFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: '',
      wallet_address: walletAddress || '',
      currency: 'TON',
    },
  });
  
  // Обработчик изменения типа валюты
  const handleCurrencyChange = (currency: 'UNI' | 'TON') => {
    try {
      // Устанавливаем выбранную валюту
      setSelectedCurrency(currency);
      
      // Обновляем значение в форме и очищаем ошибки
      form.setValue('currency', currency);
      form.clearErrors('currency');
      
      // Показываем уведомление о смене валюты
      showNotification('info', {
        message: `Выбрана валюта ${currency} для вывода`,
        duration: 2000
      });
    } catch (error) {
      // Обрабатываем возможную ошибку
      console.error('Ошибка при изменении валюты:', error);
      
      // Показываем уведомление об ошибке
      showNotification('error', {
        message: 'Произошла ошибка при выборе валюты',
        duration: 3000
      });
    }
  };
  
  // Эффект для установки значения кошелька по умолчанию, когда оно доступно
  useEffect(() => {
    if (walletAddress) {
      form.setValue('wallet_address', walletAddress);
    }
  }, [walletAddress, form]);
  
  // Эффект для обновления схемы валидации при изменении баланса или валюты
  useEffect(() => {
    form.setValue('currency', selectedCurrency);
  }, [selectedCurrency, form]);
  
  /**
   * Расширенный обработчик отправки формы вывода средств с улучшенной обработкой ошибок
   */
  const handleSubmit = async (data: WithdrawalFormData) => {
    // Создаем уникальный идентификатор операции для логирования
    const operationId = `withdraw-form-${Date.now().toString(36).substring(2, 7)}`;
    
    try {
      // Проверка авторизации пользователя
      if (!userId) {
        console.warn(`[WithdrawalForm] [${operationId}] Попытка вывода средств без авторизации`);
        
        try {
          showNotification('error', {
            message: 'Для вывода средств необходимо авторизоваться',
            duration: 5000
          });
        } catch (notifyError) {
          console.error(`[WithdrawalForm] [${operationId}] Ошибка при показе уведомления:`, notifyError);
        }
        
        return;
      }
      
      // Проверяем данные формы перед отправкой
      if (!data) {
        console.error(`[WithdrawalForm] [${operationId}] Отсутствуют данные формы`);
        
        try {
          showNotification('error', {
            message: 'Ошибка: отсутствуют данные формы',
            duration: 5000
          });
        } catch (notifyError) {
          console.error(`[WithdrawalForm] [${operationId}] Ошибка при показе уведомления:`, notifyError);
        }
        
        return;
      }
      
      // Устанавливаем состояние отправки с защитой от ошибок
      try {
        setSubmitState(SubmitState.SUBMITTING);
        setErrorMessage(null);
      } catch (stateError) {
        console.error(`[WithdrawalForm] [${operationId}] Ошибка при установке состояния отправки:`, stateError);
      }
      
      // Показываем уведомление о начале процесса
      try {
        showNotification('loading', {
          message: 'Отправка заявки на вывод...',
          duration: 2000
        });
      } catch (notifyError) {
        console.error(`[WithdrawalForm] [${operationId}] Ошибка при показе загрузочного уведомления:`, notifyError);
      }
      
      // Логируем данные формы (без конфиденциальной информации)
      console.log(`[WithdrawalForm] [${operationId}] Начало вывода средств: ${data.amount} ${data.currency}`);
      
      // Преобразуем amount в число, если это строка, с проверкой на корректность значения
      let formattedAmount: number;
      try {
        if (typeof data.amount === 'string') {
          formattedAmount = parseFloat(data.amount);
          
          if (isNaN(formattedAmount)) {
            throw new Error('Некорректная сумма вывода');
          }
        } else if (typeof data.amount === 'number') {
          formattedAmount = data.amount;
        } else {
          throw new Error('Неверный тип данных для суммы');
        }
        
        if (formattedAmount <= 0) {
          throw new Error('Сумма вывода должна быть больше нуля');
        }
      } catch (amountError) {
        console.error(`[WithdrawalForm] [${operationId}] Ошибка при обработке суммы:`, amountError);
        
        try {
          setSubmitState(SubmitState.ERROR);
          setErrorMessage(amountError instanceof Error ? amountError.message : 'Ошибка в сумме вывода');
          
          showNotification('error', {
            message: amountError instanceof Error ? amountError.message : 'Ошибка в сумме вывода',
            duration: 5000
          });
        } catch (stateError) {
          console.error(`[WithdrawalForm] [${operationId}] Ошибка при установке состояния ошибки:`, stateError);
        }
        
        return;
      }
      
      // Формируем данные для отправки
      const formattedData = {
        ...data,
        amount: formattedAmount,
      };
      
      let result;
      try {
        // Отправляем запрос на сервер с использованием сервиса
        console.log(`[WithdrawalForm] [${operationId}] Отправка запроса на вывод средств...`);
        result = await submitWithdrawal(userId, formattedData);
        console.log(`[WithdrawalForm] [${operationId}] Получен результат запроса:`, result);
      } catch (submitError) {
        console.error(`[WithdrawalForm] [${operationId}] Критическая ошибка при вызове submitWithdrawal:`, submitError);
        
        // В случае непредвиденной ошибки в самой функции submitWithdrawal
        try {
          setSubmitState(SubmitState.ERROR);
          const errorMsg = submitError instanceof Error 
            ? submitError.message 
            : 'Произошла непредвиденная ошибка при отправке заявки';
          setErrorMessage(errorMsg);
          
          showNotification('error', {
            message: errorMsg,
            duration: 5000
          });
        } catch (stateError) {
          console.error(`[WithdrawalForm] [${operationId}] Ошибка при установке состояния ошибки:`, stateError);
        }
        
        return;
      }
      
      // Проверяем результат на наличие ошибок
      if (isWithdrawalError(result)) {
        console.warn(`[WithdrawalForm] [${operationId}] Ошибка при выводе средств: ${result.message}`);
        
        try {
          setSubmitState(SubmitState.ERROR);
          setErrorMessage(result.message);
          
          showNotification('error', {
            message: result.message,
            duration: 5000
          });
          
          // Если ошибка связана с конкретным полем, устанавливаем ошибку в форме
          if (result.field && result.field in form.formState.errors) {
            form.setError(result.field as any, {
              type: 'manual',
              message: result.message
            });
          }
        } catch (stateError) {
          console.error(`[WithdrawalForm] [${operationId}] Ошибка при установке состояния ошибки:`, stateError);
        }
      } else {
        // При успехе устанавливаем статус и отображаем сообщение
        console.log(`[WithdrawalForm] [${operationId}] Успешно создана заявка на вывод. ID транзакции: ${result}`);
        
        try {
          setSubmitState(SubmitState.SUCCESS);
          setMessageSent(true);
          setTransactionId(result);
          
          // Обновляем баланс пользователя с защитой от ошибок
          try {
            refreshBalance();
          } catch (refreshError) {
            console.error(`[WithdrawalForm] [${operationId}] Ошибка при обновлении баланса:`, refreshError);
            // Продолжаем выполнение, так как это некритическая ошибка
          }
          
          showNotification('success', {
            message: `Заявка на вывод ${formattedData.amount} ${formattedData.currency} успешно создана`,
            duration: 5000
          });
          
          // Сбрасываем данные формы
          try {
            form.reset({
              amount: '',
              wallet_address: walletAddress || '',
              currency: selectedCurrency,
            });
          } catch (resetError) {
            console.error(`[WithdrawalForm] [${operationId}] Ошибка при сбросе формы:`, resetError);
          }
        } catch (successStateError) {
          console.error(`[WithdrawalForm] [${operationId}] Ошибка при установке состояния успеха:`, successStateError);
        }
      }
    } catch (error) {
      // Обрабатываем непредвиденные ошибки в основном блоке try
      console.error(`[WithdrawalForm] [${operationId}] Критическая ошибка:`, error);
      
      try {
        setSubmitState(SubmitState.ERROR);
        const errorMessage = error instanceof Error 
          ? error.message 
          : 'Произошла критическая ошибка при отправке заявки';
        setErrorMessage(errorMessage);
        
        showNotification('error', {
          message: errorMessage,
          duration: 5000
        });
      } catch (stateError) {
        console.error(`[WithdrawalForm] [${operationId}] Ошибка при установке состояния критической ошибки:`, stateError);
      }
    }
  };
  
  // Обработчик для подсказки
  const toggleTooltip = () => {
    try {
      setShowTooltip(!showTooltip);
    } catch (error) {
      console.error('Ошибка при переключении подсказки:', error);
      // В случае ошибки пытаемся вернуть состояние в безопасное положение
      setShowTooltip(false);
    }
  };
  
  // Эффект для анимации "печатающейся" подсказки при успешной отправке
  const [typedMessage, setTypedMessage] = useState('');
  const successMessage = `Заявка успешно отправлена! Номер заявки: ${transactionId || ''}.`;
  
  useEffect(() => {
    if (submitState === SubmitState.SUCCESS) {
      setTypedMessage(''); // Сбрасываем текст при каждой отправке
      
      // Анимируем печатание текста по символам
      const typeMessage = async () => {
        try {
          for (let i = 0; i < successMessage.length; i++) {
            await new Promise(resolve => setTimeout(resolve, 30)); // Задержка между символами
            setTypedMessage(successMessage.substring(0, i + 1));
          }
        } catch (error) {
          // В случае ошибки отображаем весь текст сразу
          console.error('Ошибка анимации текста:', error);
          setTypedMessage(successMessage);
        }
      };
      
      // Запускаем анимацию
      typeMessage().catch(error => {
        console.error('Ошибка при анимации текста:', error);
        // Показываем полное сообщение без анимации
        setTypedMessage(successMessage);
      });
    }
  }, [submitState, successMessage]);
  
  // Создаем новую заявку (сбрасываем форму)
  const handleNewRequest = () => {
    try {
      // Сбрасываем состояния
      setMessageSent(false);
      setSubmitState(SubmitState.IDLE);
      setErrorMessage(null);
      
      // Сбрасываем значения формы
      form.reset({
        amount: '',
        wallet_address: walletAddress || '',
        currency: selectedCurrency,
      });
      
      // Показываем уведомление о создании новой заявки
      showNotification('info', {
        message: 'Форма очищена. Вы можете создать новую заявку на вывод',
        duration: 3000
      });
    } catch (error) {
      // Логируем ошибку
      console.error('Ошибка при создании новой заявки:', error);
      
      // Показываем уведомление об ошибке
      showNotification('error', {
        message: 'Произошла ошибка при сбросе формы',
        duration: 3000
      });
      
      // Сбрасываем состояние на начальное
      setSubmitState(SubmitState.IDLE);
    }
  };
  
  return (
    <div className="bg-card rounded-xl p-4 shadow-lg card-hover-effect relative overflow-hidden">
      {/* Декоративные элементы фона */}
      <div className="absolute -right-16 -bottom-16 w-32 h-32 bg-primary/5 rounded-full blur-xl"></div>
      
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-md font-medium">Вывод средств</h2>
        
        {/* Иконка вопроса с всплывающей подсказкой */}
        <div className="relative">
          <div 
            className="w-5 h-5 rounded-full bg-muted flex items-center justify-center cursor-pointer text-xs"
            onMouseEnter={toggleTooltip}
            onMouseLeave={toggleTooltip}
          >
            <i className="fas fa-question"></i>
          </div>
          
          {showTooltip && (
            <div className="absolute right-0 top-6 w-64 bg-card p-3 rounded-md shadow-lg text-xs z-20">
              <p className="mb-2">
                <span className="font-medium">Зачем указывать TON-адрес?</span>
              </p>
              <p>TON-адрес нужен для вывода TON напрямую в ваш кошелек через блокчейн TON.</p>
            </div>
          )}
        </div>
      </div>
      
      {messageSent ? (
        // Сообщение об успешной отправке
        <div className="py-10 flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
            <i className="fas fa-check text-green-500 text-2xl"></i>
          </div>
          
          <div className="text-sm text-center relative">
            <span className="inline-block min-h-[3em]">{typedMessage}</span>
            <span 
              className={`absolute -right-2 top-0 animate-pulse h-4 w-0.5 bg-primary ${
                typedMessage.length === successMessage.length ? 'opacity-0' : 'opacity-100'
              }`}
            ></span>
          </div>
          
          <button 
            className="mt-6 px-4 py-2 bg-muted rounded-lg text-sm hover:bg-primary/10 transition-colors"
            onClick={handleNewRequest}
          >
            Создать новую заявку
          </button>
        </div>
      ) : (
        // Форма вывода средств
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-3">
          {/* Выбор типа валюты */}
          <div className="mb-4">
            <label className="block text-sm text-foreground opacity-70 mb-2">
              Валюта для вывода
            </label>
            <div className="flex space-x-2">
              <button
                type="button"
                className={`px-4 py-2 rounded-md text-sm transition-colors ${
                  selectedCurrency === 'TON'
                    ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-600/30'
                    : 'bg-muted/40 text-foreground hover:bg-muted'
                }`}
                onClick={() => handleCurrencyChange('TON')}
              >
                TON
              </button>
              <button
                type="button"
                className={`px-4 py-2 rounded-md text-sm transition-colors ${
                  selectedCurrency === 'UNI'
                    ? 'bg-green-600/20 text-green-400 border border-green-600/30'
                    : 'bg-muted/40 text-foreground hover:bg-muted'
                }`}
                onClick={() => handleCurrencyChange('UNI')}
              >
                UNI
              </button>
            </div>
            {/* Отображаем доступный баланс */}
            <p className="text-xs text-foreground opacity-70 mt-1">
              Доступно: <span className="font-medium">{currentBalance} {selectedCurrency}</span>
            </p>
          </div>
          
          {/* Адрес кошелька (только для TON) */}
          {selectedCurrency === 'TON' && (
            <div>
              <label className="block text-sm text-foreground opacity-70 mb-1">
                TON-адрес получателя
              </label>
              <div className="relative">
                <input 
                  {...form.register('wallet_address')}
                  type="text" 
                  placeholder="Введите TON-адрес (начинается с EQ или UQ)" 
                  className={`
                    w-full bg-muted text-foreground rounded-lg px-3 py-2 text-sm 
                    transition-all duration-300
                    ${addressFocused ? 'ring-2 ring-primary/30 bg-muted/80' : ''}
                    ${form.formState.errors.wallet_address ? 'border-red-500 ring-2 ring-red-500/30' : ''}
                  `}
                  onFocus={() => {
                    try {
                      setAddressFocused(true);
                    } catch (error) {
                      console.error('Ошибка при установке фокуса на поле адреса:', error);
                    }
                  }}
                  onBlur={() => {
                    try {
                      setAddressFocused(false);
                    } catch (error) {
                      console.error('Ошибка при снятии фокуса с поля адреса:', error);
                    }
                  }}
                />
                
                {/* Анимация фокуса */}
                {addressFocused && !form.formState.errors.wallet_address && (
                  <div 
                    className="absolute inset-0 rounded-lg pointer-events-none overflow-hidden opacity-20"
                    style={{
                      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                      animation: 'shimmer 2s infinite'
                    }}
                  ></div>
                )}
                
                {/* Отображение ошибки валидации */}
                {form.formState.errors.wallet_address && (
                  <p className="text-red-500 text-xs mt-1">{form.formState.errors.wallet_address.message}</p>
                )}
              </div>
            </div>
          )}
          
          {/* Сумма для вывода */}
          <div>
            <label className="block text-sm text-foreground opacity-70 mb-1">
              Сумма для вывода
            </label>
            <div className="relative">
              <div className="flex">
                <input 
                  {...form.register('amount')}
                  type="number" 
                  step="0.01"
                  min="0.01"
                  max={currentBalance.toString()}
                  placeholder="0.00" 
                  className={`
                    flex-grow bg-muted text-foreground rounded-l-lg px-3 py-2 text-sm
                    transition-all duration-300
                    ${amountFocused ? 'ring-2 ring-primary/30 bg-muted/80' : ''}
                    ${form.formState.errors.amount ? 'border-red-500 ring-2 ring-red-500/30' : ''}
                  `}
                  onFocus={() => {
                    try {
                      setAmountFocused(true);
                    } catch (error) {
                      console.error('Ошибка при установке фокуса на поле суммы:', error);
                    }
                  }}
                  onBlur={() => {
                    try {
                      setAmountFocused(false);
                    } catch (error) {
                      console.error('Ошибка при снятии фокуса с поля суммы:', error);
                    }
                  }}
                />
                <div className={`
                  bg-muted rounded-r-lg px-3 py-2 text-sm flex items-center
                  transition-all duration-300
                  ${amountFocused && !form.formState.errors.amount ? 'bg-muted/80 border-r-2 border-t-2 border-b-2 border-primary/30' : ''}
                  ${form.formState.errors.amount ? 'bg-red-500/10 border-r-2 border-t-2 border-b-2 border-red-500/30' : ''}
                `}>
                  {selectedCurrency}
                </div>
              </div>
              
              {/* Анимация фокуса */}
              {amountFocused && !form.formState.errors.amount && (
                <div 
                  className="absolute inset-0 rounded-lg pointer-events-none overflow-hidden opacity-20"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                    animation: 'shimmer 2s infinite'
                  }}
                ></div>
              )}
              
              {/* Отображение ошибки валидации */}
              {form.formState.errors.amount && (
                <p className="text-red-500 text-xs mt-1">{form.formState.errors.amount.message}</p>
              )}
            </div>
          </div>
          
          {/* Отображение общей ошибки формы */}
          {errorMessage && (
            <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-md text-red-400 text-sm">
              {errorMessage}
            </div>
          )}
          
          {/* Кнопка отправки */}
          <button 
            type="submit"
            className={`
              w-full py-3 rounded-lg font-medium mt-4
              relative overflow-hidden
              ${submitState === SubmitState.SUBMITTING ? 'cursor-not-allowed' : 'cursor-pointer'}
              ${submitState === SubmitState.SUBMITTING ? 'bg-primary/70' : 'gradient-button'}
              text-white
            `}
            disabled={submitState === SubmitState.SUBMITTING || !userId}
          >
            {/* Анимация загрузки при отправке */}
            {submitState === SubmitState.SUBMITTING ? (
              <div className="flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                <span>Отправка...</span>
              </div>
            ) : (
              // Эффект пульсации кнопки при наведении
              <>
                <div className="absolute inset-0 w-full h-full opacity-0 hover:opacity-100" 
                  style={{
                    background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0) 100%)',
                    transform: 'translateX(-100%)',
                    animation: 'shimmer 2s infinite'
                  }}
                ></div>
                <span className="relative z-10">Отправить заявку</span>
              </>
            )}
          </button>
          
          <p className="text-xs text-foreground opacity-70 text-center mt-1">
            Заявка будет передана администратору
          </p>
        </form>
      )}
    </div>
  );
};

export default WithdrawalForm;
