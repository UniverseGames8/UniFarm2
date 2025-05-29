# Детальный анализ проблем взаимодействия с API

## 1. Проблема: Неконсистентная передача типов данных в amount

### Пример из кода:
```javascript
// UniFarmingCard.tsx, строки 156-178
const requestBody = {
  amount: amount.toString(),  // Передаем amount как строку
  user_id: 1  // ID пользователя как число
};

// Явная проверка типа amount для отладки
console.log('Тип:', typeof requestBody.amount, requestBody.amount);

// Гарантированное преобразуем number в string если amount число
if (typeof requestBody.amount === 'number') {
  console.log(`📤 [ОТЛАДКА ДЕПОЗИТА] amount конвертирован из числа в строку`);
  requestBody.amount = String(requestBody.amount);
}
```

### Проблема:
1. Избыточная проверка и преобразование типов
2. Несколько участков кода выполняют одну и ту же задачу
3. При использовании BigNumber.toString() уже возвращается строка, но дополнительно выполняется проверка на number

### Решение:
```javascript
// Упрощенная версия
const requestBody = {
  amount: String(amount), // Единое преобразование в строку
  user_id: 1
};

console.log('Данные запроса:', requestBody);
```

---

## 2. Проблема: Использование захардкоженного user_id

### Пример из кода:
```javascript
// UniFarmingCard.tsx, строка 31
const { data: farmingResponse, isLoading } = useQuery<{ success: boolean; data: FarmingInfo }>({
  queryKey: ['/api/uni-farming/info?user_id=1'], // Добавляем user_id в запрос
  refetchInterval: 10000, // Обновляем данные каждые 10 секунд чтобы видеть текущий баланс
});
```

### Проблема:
1. Захардкоженный user_id=1 вместо динамического получения из контекста пользователя
2. Обновление данных каждые 10 секунд создает избыточную нагрузку на сервер
3. Нет возможности использовать актуальный ID пользователя

### Решение:
```javascript
const { user } = useUser(); // Получаем данные пользователя из контекста

const { data: farmingResponse, isLoading } = useQuery<{ success: boolean; data: FarmingInfo }>({
  queryKey: [`/api/uni-farming/info`, user?.id], // Динамический user_id
  refetchInterval: 30000, // Уменьшаем частоту обновлений
  enabled: !!user?.id, // Запрос выполняется только при наличии ID пользователя
});
```

---

## 3. Проблема: Несогласованное обновление кэша

### Пример из кода:
```javascript
// Обновляем кэш запросов для получения актуальных данных пользователя
queryClient.invalidateQueries({ queryKey: ['/api/wallet/balance'] });
queryClient.invalidateQueries({ queryKey: ['/api/me'] });

// В другом месте
queryClient.invalidateQueries({ queryKey: ['/api/uni-farming/info'] });
queryClient.invalidateQueries({ queryKey: ['/api/users/1'] });
queryClient.invalidateQueries({ queryKey: ['/api/wallet/balance'] });
queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
```

### Проблема:
1. Разные места в коде обновляют разные наборы запросов
2. Некоторые ключи содержат захардкоженные ID (/api/users/1)
3. Отсутствует централизованный механизм обновления связанных данных

### Решение:
```javascript
// Создать функцию для централизованного обновления данных
const refreshUserData = (userId) => {
  queryClient.invalidateQueries({ queryKey: ['/api/me'] });
  queryClient.invalidateQueries({ queryKey: ['/api/wallet/balance'] });
  queryClient.invalidateQueries({ queryKey: ['/api/uni-farming/info', userId] });
  queryClient.invalidateQueries({ queryKey: ['/api/users', userId] });
  queryClient.invalidateQueries({ queryKey: ['/api/transactions', userId] });
};

// Использовать эту функцию во всех местах обновления данных
refreshUserData(user.id);
```

---

## 4. Проблема: Избыточная обработка ошибок

### Пример из кода:
```javascript
try {
  // Первый уровень try/catch
  try {
    // Второй уровень try/catch
    try {
      // Третий уровень try/catch
      const fetchResponse = await fetch(url, fetchOptions);
      
      // Получаем текст ответа
      const responseText = await fetchResponse.text();
      
      let response;
      try {
        // Четвертый уровень try/catch
        response = JSON.parse(responseText);
      } catch (parseError) {
        console.error(`Ошибка парсинга JSON:`, parseError);
        throw new Error(`Неверный формат JSON в ответе: ${parseError.message}`);
      }
      
    } catch (fetchError) {
      console.error('Ошибка при выполнении запроса:', fetchError);
      setError(`Не удалось выполнить депозит: ${fetchError.message}`);
    }
  } catch (err) {
    console.error('Ошибка при подготовке запроса:', err);
    setError(`Ошибка при подготовке запроса: ${err instanceof Error ? err.message : 'Неизвестная ошибка'}`);
  }
} catch (err) {
  console.error('Ошибка валидации формы:', err);
  setError('Некорректный формат суммы');
}
```

### Проблема:
1. Избыточное количество вложенных try/catch блоков
2. Разные уровни обработки ошибок устанавливают разные сообщения
3. Затруднено отслеживание реального источника ошибки

### Решение:
```javascript
try {
  // Валидация формы
  if (!depositAmount || depositAmount === '0') {
    return setError('Пожалуйста, введите сумму депозита');
  }
  
  const amount = new BigNumber(depositAmount);
  if (amount.isNaN() || amount.isLessThanOrEqualTo(0)) {
    return setError('Сумма должна быть положительным числом');
  }
  
  if (amount.isGreaterThan(balance)) {
    return setError('Недостаточно средств на балансе');
  }
  
  // Подготовка запроса
  const requestBody = {
    amount: String(amount),
    user_id: user.id
  };
  
  // Выполнение запроса через централизованный метод
  const response = await apiRequest('/api/uni-farming/deposit', {
    method: 'POST',
    body: JSON.stringify(requestBody)
  });
  
  // Обработка успешного ответа
  if (response.success) {
    setDepositAmount('');
    refreshUserData(user.id);
  } else {
    setError(response.error || 'Ошибка при выполнении депозита');
  }
} catch (error) {
  // Единая обработка всех ошибок
  console.error('Ошибка при выполнении депозита:', error);
  setError(`Ошибка: ${error.message || 'Неизвестная ошибка'}`);
} finally {
  setIsSubmitting(false);
}
```

---

## 5. Проблема: Непоследовательная инициализация приложения

### Пример из кода (App.tsx):
```javascript
// Проверка инициализации приложения (без Telegram WebApp по требованиям фазы 10.3)
useEffect(() => {
  console.log('==[ App Init Check (No Telegram WebApp) ]==');
  console.log('Running in environment:', process.env.NODE_ENV);
  console.log('Window available:', typeof window !== 'undefined');
  
  // Шаг 1.2 — Проверка initData в Telegram WebApp
  console.log('==[ Guest ID Check ]==', 
    sessionRestoreService.getGuestId() || 'not found'
  );
  
  // Отладочная информация для проверки наличия реферального кода
  const urlParams = new URLSearchParams(window.location.search);
  console.log('==[ Ref Code Check ]==', {
    inUrl: urlParams.has('ref_code') || urlParams.has('refCode'),
    refCode: urlParams.get('ref_code') || urlParams.get('refCode') || 'not found',
    inSession: !!sessionStorage.getItem('referrer_code'),
    sessionRefCode: sessionStorage.getItem('referrer_code') || 'not found'
  });
}, []);

// Очистка кэша Telegram при старте приложения
useEffect(() => {
  // Принудительная очистка всех кэшированных данных Telegram при загрузке приложения
  // Это необходимо для удаления устаревших данных от старого бота
  console.log('[App] 🧹 Очистка кэша Telegram при старте приложения...');
  clearTelegramCache();
  console.log('[App] ✅ Кэш Telegram очищен, обновляем локальные данные...');
}, []);

// Обновленная инициализация приложения без зависимости от Telegram WebApp
useEffect(() => {
  console.log('[App] Этап 10.3: Инициализация без зависимости от Telegram WebApp');
  
  // Отображаем информацию о среде выполнения для диагностики
  console.log('[App] Детали среды выполнения:', {
    userAgent: navigator.userAgent,
    isIframe: window.self !== window.top,
    documentURL: window.location.href
  });
  
  // Проверяем, можно ли восстановить сессию из локального хранилища
  if (sessionRestoreService.shouldAttemptRestore()) {
    console.log('[App] 🔄 Пытаемся восстановить сессию по guest_id из локального хранилища...');
    restoreSessionFromStorage();
  } else {
    // Если нет сохраненной сессии, продолжаем обычную авторизацию
    console.log('[App] ⚙️ Нет сохраненной сессии, продолжаем авторизацию через guest_id...');
    authenticateWithTelegram();
  }
}, []);
```

### Проблема:
1. Несколько useEffect выполняют действия при инициализации без четкого порядка
2. Много отладочных сообщений затрудняют поиск реальных проблем
3. Сложный процесс восстановления сессии и авторизации

### Решение:
```javascript
// Единый эффект для инициализации приложения
useEffect(() => {
  const initializeApp = async () => {
    setIsLoading(true);
    
    try {
      // 1. Очистка устаревших данных
      clearTelegramCache();
      
      // 2. Проверка наличия реферального кода в URL
      const refCode = getReferrerCodeFromUrl();
      if (refCode) {
        sessionStorage.setItem('referrer_code', refCode);
        sessionStorage.setItem('referrer_code_timestamp', Date.now().toString());
      }
      
      // 3. Проверка возможности восстановления сессии
      if (sessionRestoreService.shouldAttemptRestore()) {
        await restoreSessionFromStorage();
      } else {
        await authenticateWithTelegram();
      }
      
      // 4. Финальные действия после успешной инициализации
      queryClient.invalidateQueries({ queryKey: ['/api/wallet/balance'] });
      queryClient.invalidateQueries({ queryKey: ['/api/me'] });
    } catch (error) {
      console.error('[App] Ошибка при инициализации:', error);
      setTelegramAuthError('Ошибка при инициализации приложения');
    } finally {
      setIsLoading(false);
    }
  };
  
  initializeApp();
}, []);
```

## 6. Дополнительные замеченные проблемы:

1. **Автоматическая генерация реферального кода:**
   - В компоненте UniFarmReferralLink.tsx автоматически запускается генерация реферального кода при его отсутствии
   - Это может привести к неожиданным запросам API и изменениям состояния

2. **Отсутствие блокировки UI во время загрузки:**
   - Во многих компонентах статус isLoading не используется для блокировки UI
   - Это может привести к множественным нажатиям на кнопки и дублированию запросов

3. **Нестандартное использование queryClient:**
   - Смешанное использование прямых запросов fetch и React Query
   - Ручное управление кэшем с частой инвалидацией запросов