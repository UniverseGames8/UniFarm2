# Тестирование нового API-сервиса

Этот документ содержит рекомендации по тестированию компонентов, которые были мигрированы с использованием нового унифицированного API-сервиса.

## Базовые тесты

### 1. Проверка успешного GET-запроса

```typescript
// Тестируем получение данных с использованием apiGet
const response = await apiGet<YourDataType>('/api/your-endpoint');

// Проверяем успешность запроса
console.log('Запрос успешен:', response.success);

// Проверяем наличие данных
console.log('Получены данные:', response.data);

// Проверяем тип данных
console.log('Тип полученных данных:', typeof response.data);
```

### 2. Проверка успешного POST-запроса

```typescript
// Тестируем отправку данных с использованием apiPost
const requestData = {
  field1: 'value1',
  field2: 123
};

const response = await apiPost<YourResponseType>('/api/your-endpoint', requestData);

// Проверяем успешность запроса
console.log('Запрос успешен:', response.success);

// Проверяем сообщение об успехе
console.log('Сообщение сервера:', response.message);

// Проверяем полученные данные
console.log('Ответ сервера:', response.data);
```

### 3. Проверка обработки ошибок

```typescript
// Тестируем обработку ошибок при запросе к несуществующему эндпоинту
try {
  const response = await apiGet('/api/non-existent-endpoint');
  console.log('Ответ:', response);
} catch (error) {
  console.error('Перехваченная ошибка:', error);
}

// Альтернативно, с использованием проверки success
const response = await apiGet('/api/non-existent-endpoint');
if (!response.success) {
  console.error('Ошибка API:', response.error);
} else {
  console.log('Данные:', response.data);
}
```

## Проверка специфических сценариев

### Обработка сетевых ошибок

```typescript
// Мы можем симулировать отсутствие сети, выключив сетевое соединение
// или указав недоступный хост
try {
  const response = await apiGet('https://non-existent-server.example/api');
  console.log('Ответ:', response);
} catch (error) {
  console.error('Ошибка сети:', error);
}
```

### Проверка преобразования типов

```typescript
// Тестирование автоматического преобразования типов для API
// Например, если backend ожидает, что amount будет строкой, но мы отправляем число

const response = await apiPost('/api/transaction', {
  amount: 100, // Отправляем как число
  type: 'deposit'
});

// API-сервис должен автоматически преобразовать amount в строку
console.log('Запрос успешен:', response.success);
```

### Проверка обработки некорректных JSON-ответов

```typescript
// Этот тест сложнее провести, но вы можете перехватить ответ с помощью
// браузерных инструментов разработчика и проверить, как API-сервис
// обрабатывает некорректные JSON-ответы
```

## Тестирование в разных компонентах

### React Query компоненты

```typescript
// Для компонентов, использующих React Query, проверьте, что:
// 1. queryFn правильно вызывает apiGet
// 2. Данные правильно типизированы
// 3. Обработка ошибок работает как ожидается

const { data, isLoading, error } = useQuery({
  queryKey: ['your-query-key'],
  queryFn: async () => {
    const response = await apiGet<YourDataType>('/api/your-endpoint');
    if (!response.success) {
      throw new Error(response.error || 'Ошибка при получении данных');
    }
    return response.data;
  }
});
```

### Обычные функциональные компоненты

```typescript
// Для обычных функциональных компонентов проверьте:
// 1. useState используется для хранения данных с правильными типами
// 2. Обработка ошибок и состояний загрузки работает корректно
// 3. useEffect правильно вызывает API-методы

const [data, setData] = useState<YourDataType | null>(null);
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  async function fetchData() {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await apiGet<YourDataType>('/api/your-endpoint');
      
      if (!response.success) {
        setError(response.error || 'Ошибка при получении данных');
        return;
      }
      
      setData(response.data);
    } catch (err: any) {
      setError(err.message || 'Произошла ошибка');
    } finally {
      setIsLoading(false);
    }
  }
  
  fetchData();
}, []);
```

## Чек-лист для проверки миграции

✅ Все вызовы `correctApiRequest` заменены на соответствующие методы из apiService  
✅ Все прямые вызовы `fetch` в компонентах заменены на методы apiService  
✅ Проверены все сценарии успешных ответов API  
✅ Проверены все сценарии ошибок API  
✅ Все типы данных правильно определены и используются  
✅ Логирование ошибок работает корректно  
✅ Пользовательские уведомления об ошибках работают как ожидается  
✅ UI корректно отображает состояния загрузки, успеха и ошибки