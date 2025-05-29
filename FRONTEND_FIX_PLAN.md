# План исправления проблем клиентской части UniFarm

## Приоритизация задач

| Приоритет | Проблема | Сложность | Влияние на пользователя |
|-----------|----------|-----------|-------------------------|
| 1 | Кнопка "Пополнить" и обработка депозитов | Высокая | Критическое - влияет на основной функционал |
| 2 | Отображение реферального кода | Средняя | Высокое - влияет на привлечение новых пользователей |
| 3 | Отображение баланса и статуса фарминга | Средняя | Высокое - влияет на основной пользовательский опыт |
| 4 | Избыточные запросы к API | Низкая | Среднее - влияет на производительность |
| 5 | Обработка ошибок | Средняя | Среднее - влияет на понимание проблем пользователем |
| 6 | Инициализация приложения | Высокая | Низкое - преимущественно внутренняя проблема |

## План исправления по приоритетам

### 1. Исправление работы кнопки "Пополнить" и процесса депозита

**Цель:** Обеспечить стабильную работу функционала пополнения, предотвратить ошибки типа "Invalid JSON".

**Конкретные шаги:**

1. **Упростить компонент UniFarmingCard.tsx:**
   - Удалить дублирующуюся логику преобразования типов
   - Заменить прямые fetch запросы на useMutation из React Query
   - Добавить единую и понятную обработку ошибок

2. **Стандартизировать работу с типами данных:**
   - Создать централизованную функцию для преобразования числовых amount в строки
   - Добавить строгую валидацию через zod перед отправкой запроса

3. **Улучшить UX при отправке депозита:**
   - Блокировать кнопку во время отправки запроса
   - Добавить четкие сообщения об ошибках
   - Предотвратить множественные отправки одной и той же формы

4. **Проверить обработку ответов API:**
   - Проверить обработку всех возможных форматов ответа
   - Добавить обработку неожиданных ошибок
   - Обеспечить корректное обновление UI после успешного депозита

**Пример исправления:**
```jsx
// Компонент UniFarmingCard.tsx
const { mutate: depositMutation, isPending } = useMutation({
  mutationFn: async (amount) => {
    // Подготовка данных с правильными типами
    const requestBody = {
      amount: String(amount),
      user_id: user.id
    };
    
    return apiRequest('/api/uni-farming/deposit', {
      method: 'POST',
      body: JSON.stringify(requestBody)
    });
  },
  onSuccess: (data) => {
    setDepositAmount('');
    setError(null);
    // Инвалидация нужных запросов для обновления UI
    queryClient.invalidateQueries({ queryKey: ['/api/uni-farming/info'] });
    queryClient.invalidateQueries({ queryKey: ['/api/wallet/balance'] });
  },
  onError: (error) => {
    setError(`Не удалось выполнить депозит: ${error.message}`);
  }
});

// В обработчике формы
const handleSubmit = (e) => {
  e.preventDefault();
  
  // Валидация
  if (!depositAmount || depositAmount === '0') {
    return setError('Пожалуйста, введите сумму депозита');
  }
  
  try {
    const amount = new BigNumber(depositAmount);
    if (amount.isNaN() || amount.isLessThanOrEqualTo(0)) {
      return setError('Сумма должна быть положительным числом');
    }
    
    if (amount.isGreaterThan(balance)) {
      return setError('Недостаточно средств на балансе');
    }
    
    // Запуск мутации с правильным значением
    depositMutation(amount.toString());
  } catch (err) {
    setError('Некорректный формат суммы');
  }
};
```

### 2. Исправление отображения реферального кода

**Цель:** Обеспечить стабильное и корректное отображение реферального кода при первой загрузке.

**Конкретные шаги:**

1. **Упростить компонент UniFarmReferralLink.tsx:**
   - Уменьшить количество условных рендеров
   - Упростить логику получения данных пользователя
   - Оптимизировать обработку отсутствующего реферального кода

2. **Исправить получение данных:**
   - Использовать более консистентный подход к получению данных
   - Добавить кэширование данных для уменьшения количества запросов
   - Заменить автоматическую генерацию кода на генерацию по запросу пользователя

3. **Улучшить UX при загрузке и ошибках:**
   - Добавить информативные состояния загрузки
   - Улучшить обработку ошибок
   - Добавить кнопку для ручной генерации кода при его отсутствии

**Пример исправления:**
```jsx
// Компонент UniFarmReferralLink.tsx
// Упрощенный запрос данных
const { data: userData, isLoading, isError, refetch } = useQuery({
  queryKey: ['/api/me'],
  staleTime: 60000, // Кэшировать данные на 1 минуту
  refetchOnWindowFocus: false // Не обновлять при фокусе окна
});

// Мутация для генерации ref_code
const { mutate: generateRefCode, isPending: isGeneratingCode } = useMutation({
  mutationFn: () => userService.generateRefCode(),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/me'] });
  },
  onError: (error) => console.error('Ошибка при генерации кода:', error)
});

// Упрощенный рендеринг с минимумом условий
return (
  <div className="bg-card rounded-xl p-5 mb-5 shadow-lg relative">
    <h3 className="text-lg font-medium mb-3">Ваша реферальная ссылка</h3>
    
    {isLoading ? (
      <LoadingState message="Загрузка данных..." />
    ) : isError ? (
      <ErrorState 
        message="Не удалось загрузить реферальную ссылку" 
        onRetry={refetch} 
      />
    ) : !userData?.ref_code ? (
      <div className="text-center py-3">
        <p className="text-sm text-muted-foreground mb-3">
          У вас еще нет реферальной ссылки
        </p>
        <button 
          onClick={() => generateRefCode()}
          disabled={isGeneratingCode}
          className="px-4 py-2 bg-primary text-white rounded-md text-sm"
        >
          {isGeneratingCode ? 'Создание...' : 'Создать ссылку'}
        </button>
      </div>
    ) : (
      <div className="flex flex-col space-y-3">
        <div className="relative">
          <input
            type="text"
            value={linkType === 'app' ? referralLink : directBotLink}
            readOnly
            className="w-full p-2 bg-muted rounded-md pr-10 text-sm"
          />
          <button
            onClick={() => copyToClipboard()}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-primary"
          >
            {isCopied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
          </button>
        </div>
        
        <div className="flex space-x-2 text-xs">
          <button
            onClick={() => setLinkType('app')}
            className={`px-3 py-1 rounded-md ${
              linkType === 'app' ? 'bg-primary text-white' : 'bg-muted'
            }`}
          >
            Ссылка на приложение
          </button>
          <button
            onClick={() => setLinkType('bot')}
            className={`px-3 py-1 rounded-md ${
              linkType === 'bot' ? 'bg-primary text-white' : 'bg-muted'
            }`}
          >
            Прямая ссылка на бота
          </button>
        </div>
      </div>
    )}
  </div>
);
```

### 3. Исправление отображения баланса и статуса фарминга

**Цель:** Обеспечить корректное и синхронизированное отображение баланса и статуса фарминга.

**Конкретные шаги:**

1. **Исправить запросы к API:**
   - Заменить захардкоженный user_id=1 на динамический ID из контекста пользователя
   - Синхронизировать обновление данных между разными компонентами
   - Оптимизировать интервалы обновления данных

2. **Улучшить компоненты отображения данных:**
   - Добавить индикаторы обновления данных
   - Улучшить обработку ошибок и пустых данных
   - Унифицировать форматирование чисел

3. **Оптимизировать обновление UI:**
   - Использовать invalidateQueries с правильными ключами
   - Добавить оптимистичные обновления для улучшения UX
   - Уменьшить количество перерисовок компонентов

**Пример исправления:**
```jsx
// Получение данных пользователя из контекста
const { user } = useUser();

// Запрос информации о фарминге с динамическим ID
const { data: farmingResponse, isLoading, isFetching } = useQuery({
  queryKey: ['/api/uni-farming/info', user?.id], // Динамический ID
  refetchInterval: 30000, // Реже обновляем (30 сек вместо 10)
  enabled: !!user?.id, // Запрос активен только при наличии ID
  select: (data) => {
    // Преобразование и валидация данных
    if (!data || !data.success || !data.data) {
      return null;
    }
    return data.data;
  }
});

// Оптимизированное отображение в UI
return (
  <div className="relative bg-card rounded-xl p-4 mb-5 shadow-md">
    {/* Индикатор обновления данных */}
    {isFetching && !isLoading && (
      <div className="absolute top-2 right-2">
        <div className="animate-spin h-3 w-3 border border-primary border-t-transparent rounded-full" />
      </div>
    )}
    
    <h2 className="text-xl font-semibold mb-3 purple-gradient-text">
      Основной UNI пакет
    </h2>
    
    {isLoading ? (
      <LoadingState message="Загрузка данных о фарминге..." />
    ) : !farmingResponse ? (
      <ErrorState 
        message="Не удалось загрузить данные" 
        onRetry={() => queryClient.invalidateQueries(['/api/uni-farming/info', user?.id])} 
      />
    ) : (
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-foreground opacity-70">
            Текущий депозит
          </p>
          <p className="text-lg font-medium">
            {formatNumber(farmingResponse.totalDepositAmount || '0')} UNI
          </p>
        </div>
        <div>
          <p className="text-sm text-foreground opacity-70">
            Дата активации
          </p>
          <p className="text-md font-medium">
            {formatStartDate(farmingResponse)}
          </p>
        </div>
        {/* Остальные данные... */}
      </div>
    )}
  </div>
);
```

### 4. Оптимизация запросов к API

**Цель:** Уменьшить количество избыточных запросов к API и улучшить кэширование данных.

**Конкретные шаги:**

1. **Стандартизировать использование React Query:**
   - Настроить дефолтные опции для оптимального кэширования
   - Создать кастомные хуки для общих запросов
   - Оптимизировать invalidateQueries для минимального обновления кэша

2. **Оптимизировать параметры запросов:**
   - Увеличить staleTime для уменьшения количества запросов
   - Настроить refetchInterval только для часто меняющихся данных
   - Использовать enabled для условного выполнения запросов

3. **Централизовать управление запросами:**
   - Создать утилиты для общих запросов
   - Заменить прямые fetch на централизованные методы
   - Добавить логирование запросов только в режиме разработки

**Пример исправления:**
```jsx
// Настройка queryClient с оптимальными параметрами
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 минут по умолчанию
      cacheTime: 10 * 60 * 1000, // 10 минут хранения в кэше
      refetchOnWindowFocus: process.env.NODE_ENV === 'production', // Только в продакшне
      retry: 1, // Только одна повторная попытка
      refetchOnMount: true,
    },
  },
});

// Кастомный хук для получения данных пользователя
export function useUserData() {
  const { user } = useUser();
  
  return useQuery({
    queryKey: ['/api/me'],
    staleTime: 2 * 60 * 1000, // 2 минуты
    refetchInterval: false, // Не обновлять автоматически
    select: (data) => {
      if (!data || !data.success) return null;
      return data.data;
    }
  });
}

// Кастомный хук для получения информации о фарминге
export function useFarmingInfo(userId) {
  return useQuery({
    queryKey: ['/api/uni-farming/info', userId],
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 секунд
    refetchInterval: 60 * 1000, // 1 минута
    select: (data) => {
      if (!data || !data.success) return null;
      return data.data;
    }
  });
}

// Функция для централизованного обновления связанных данных
export function invalidateUserRelatedData(userId) {
  return queryClient.invalidateQueries({
    predicate: (query) => {
      const queryKey = query.queryKey;
      return (
        queryKey[0] === '/api/me' ||
        queryKey[0] === '/api/wallet/balance' ||
        (queryKey[0] === '/api/uni-farming/info' && queryKey[1] === userId) ||
        (queryKey[0] === '/api/transactions' && queryKey[1] === userId)
      );
    },
  });
}
```

### 5. Улучшение обработки ошибок

**Цель:** Создать единую систему обработки и отображения ошибок для улучшения UX.

**Конкретные шаги:**

1. **Создать централизованную систему обработки ошибок:**
   - Добавить контекст для ошибок и уведомлений
   - Создать хуки для удобного использования в компонентах
   - Стандартизировать форматы ошибок

2. **Улучшить отображение ошибок в UI:**
   - Создать компоненты для разных типов ошибок
   - Добавить информативные сообщения
   - Предоставить возможность повторить запрос при ошибке

3. **Отлавливать и обрабатывать все типы ошибок:**
   - Сетевые ошибки
   - Ошибки валидации форм
   - Ошибки API
   - Неожиданные исключения

**Пример исправления:**
```jsx
// Контекст для ошибок и уведомлений
const ErrorContext = createContext(null);

export const ErrorProvider = ({ children }) => {
  const [errors, setErrors] = useState([]);
  
  const addError = (error) => {
    const id = Date.now();
    const newError = {
      id,
      message: error.message || 'Произошла неизвестная ошибка',
      type: error.type || 'error',
      timestamp: new Date(),
    };
    
    setErrors((prev) => [...prev, newError]);
    
    // Автоматическое удаление ошибки через 5 секунд
    setTimeout(() => {
      removeError(id);
    }, 5000);
    
    return id;
  };
  
  const removeError = (id) => {
    setErrors((prev) => prev.filter(error => error.id !== id));
  };
  
  return (
    <ErrorContext.Provider value={{ errors, addError, removeError }}>
      {children}
      <ErrorDisplay />
    </ErrorContext.Provider>
  );
};

// Компонент для отображения ошибок
const ErrorDisplay = () => {
  const { errors, removeError } = useContext(ErrorContext);
  
  if (errors.length === 0) return null;
  
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col space-y-2">
      {errors.map((error) => (
        <div 
          key={error.id}
          className="bg-destructive text-white p-3 rounded-md shadow-lg flex items-start max-w-md"
        >
          <div className="mr-2">
            <i className="fas fa-exclamation-circle" />
          </div>
          <div className="flex-1">
            <p className="text-sm">{error.message}</p>
          </div>
          <button 
            onClick={() => removeError(error.id)}
            className="text-white opacity-70 hover:opacity-100"
          >
            <i className="fas fa-times" />
          </button>
        </div>
      ))}
    </div>
  );
};

// Хук для использования в компонентах
export const useError = () => {
  const context = useContext(ErrorContext);
  
  if (!context) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  
  return context;
};

// Использование в компонентах
const MyComponent = () => {
  const { addError } = useError();
  
  const handleClick = () => {
    try {
      // Какой-то код, который может вызвать ошибку
    } catch (error) {
      addError({
        message: `Не удалось выполнить операцию: ${error.message}`,
        type: 'error'
      });
    }
  };
  
  return <button onClick={handleClick}>Выполнить</button>;
};
```

### 6. Упрощение инициализации приложения

**Цель:** Сделать процесс инициализации приложения более надежным и понятным.

**Конкретные шаги:**

1. **Упростить логику инициализации в App.tsx:**
   - Объединить несколько useEffect в один с четким порядком действий
   - Уменьшить количество отладочных сообщений
   - Создать последовательный процесс инициализации

2. **Улучшить восстановление сессии:**
   - Упростить логику восстановления сессии
   - Добавить более четкую обработку ошибок
   - Улучшить отображение состояния загрузки для пользователя

3. **Улучшить управление состоянием:**
   - Создать кастомные хуки для часто используемой логики
   - Централизовать управление состоянием через контексты
   - Уменьшить объем состояния в компонентах

**Пример исправления:**
```jsx
// Создаем кастомный хук для инициализации
function useAppInitialization() {
  const [status, setStatus] = useState({
    isLoading: true,
    isError: false,
    errorMessage: null,
    userId: null
  });
  
  const queryClient = useQueryClient();
  
  useEffect(() => {
    const initialize = async () => {
      try {
        // 1. Очистка устаревших данных
        clearTelegramCache();
        
        // 2. Проверка возможности восстановления сессии
        const canRestoreSession = sessionRestoreService.shouldAttemptRestore();
        
        if (canRestoreSession) {
          // 3a. Восстановление существующей сессии
          const guestId = sessionRestoreService.getGuestId();
          const result = await sessionRestoreService.restoreSession(guestId);
          
          if (result.success && result.data) {
            setStatus({
              isLoading: false,
              isError: false,
              errorMessage: null,
              userId: result.data.user_id
            });
            
            // Обновляем кэш запросов
            queryClient.invalidateQueries({ queryKey: ['/api/wallet/balance'] });
            queryClient.invalidateQueries({ queryKey: ['/api/me'] });
          } else {
            throw new Error('Не удалось восстановить сессию');
          }
        } else {
          // 3b. Создание новой сессии
          const guestId = sessionRestoreService.getOrCreateGuestId();
          
          // Получаем реферальный код из URL
          const urlParams = new URLSearchParams(window.location.search);
          const refCode = urlParams.get('ref_code') || urlParams.get('refCode');
          
          // Регистрируем пользователя
          const registrationResult = await registerUserWithTelegram(guestId, refCode);
          
          if (registrationResult && registrationResult.success) {
            setStatus({
              isLoading: false,
              isError: false,
              errorMessage: null,
              userId: registrationResult.data.user_id
            });
            
            // Сохраняем guest_id для будущего восстановления
            sessionRestoreService.saveGuestId(guestId);
          } else {
            throw new Error('Не удалось зарегистрировать пользователя');
          }
        }
      } catch (error) {
        console.error('[App] Ошибка инициализации:', error);
        
        setStatus({
          isLoading: false,
          isError: true,
          errorMessage: error.message || 'Неизвестная ошибка инициализации',
          userId: null
        });
      }
    };
    
    initialize();
  }, [queryClient]);
  
  return status;
}

// Использование в App.tsx
function App() {
  const { isLoading, isError, errorMessage, userId } = useAppInitialization();
  
  // Отображение состояния загрузки
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center p-4">
          <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-foreground">Загрузка приложения...</p>
        </div>
      </div>
    );
  }
  
  // Отображение ошибки
  if (isError) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center p-4 max-w-md">
          <div className="text-destructive text-5xl mb-4">
            <i className="fas fa-exclamation-circle"></i>
          </div>
          <h1 className="text-xl font-semibold mb-2">Ошибка запуска</h1>
          <p className="text-muted-foreground mb-4">{errorMessage}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-white rounded-md"
          >
            Перезагрузить приложение
          </button>
        </div>
      </div>
    );
  }
  
  // Основной рендер приложения
  return (
    <QueryClientProvider client={queryClient}>
      <TonConnectUIProvider manifestUrl="...">
        <TelegramInitializer />
        <NotificationProvider>
          <NotificationContainer />
          <UserProvider userId={userId}>
            {/* Основной контент */}
          </UserProvider>
        </NotificationProvider>
      </TonConnectUIProvider>
    </QueryClientProvider>
  );
}
```

## Следующие шаги после исправления основных проблем

1. **Написание автоматизированных тестов:**
   - Unit-тесты для критических компонентов
   - Интеграционные тесты для проверки взаимодействия компонентов
   - End-to-end тесты для проверки основных пользовательских сценариев

2. **Оптимизация производительности:**
   - Анализ и улучшение времени загрузки
   - Профилирование и оптимизация ререндеров
   - Ленивая загрузка компонентов

3. **Улучшение доступности:**
   - Добавление aria-атрибутов
   - Проверка контрастности и соответствия WCAG
   - Проверка доступности с клавиатуры