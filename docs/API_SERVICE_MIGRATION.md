# Миграция на новый унифицированный API-сервис

## Обзор изменений

В проекте реализован новый унифицированный сервис для работы с API запросами - `apiService.ts`. Этот сервис предоставляет стандартизированный интерфейс для выполнения всех типов HTTP-запросов (GET, POST, PUT, DELETE) с улучшенной обработкой ошибок и типизацией.

## Преимущества нового подхода

- **Единый интерфейс**: Все API-запросы выполняются через один стандартизированный интерфейс
- **Улучшенная типизация**: Поддержка TypeScript-генериков для безопасной типизации ответов
- **Надежная обработка ошибок**: Централизованная обработка сетевых ошибок и ошибок API
- **Стандартизированный формат ответов**: Все ответы API имеют унифицированную структуру
- **Совместимость с существующими типами данных**: Работает со всеми существующими типами данных в проекте

## Как мигрировать с существующих методов

### С `correctApiRequest` на новый `apiService`

**Старый способ**:

```typescript
const response = await correctApiRequest<{success: boolean, data: UserData}>(
  '/api/user/profile',
  'GET'
);

if (!response.success) {
  throw new Error('Ошибка при получении профиля');
}

return response.data;
```

**Новый способ**:

```typescript
const response = await apiGet<UserData>('/api/user/profile');

if (!response.success) {
  throw new Error(response.error || 'Ошибка при получении профиля');
}

return response.data;
```

### С прямого `fetch` на новый `apiService`

**Старый способ**:

```typescript
const response = await fetch('/api/user/update', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ name: 'Новое имя' })
});

const data = await response.json();
if (!data.success) {
  throw new Error(data.error || 'Ошибка при обновлении профиля');
}

return data.data;
```

**Новый способ**:

```typescript
const response = await apiPost<UserData>('/api/user/update', { 
  name: 'Новое имя' 
});

if (!response.success) {
  throw new Error(response.error || 'Ошибка при обновлении профиля');
}

return response.data;
```

### С устаревшего формата `apiRequest` на новый `apiService`

**Старый способ**:

```typescript
const response = await apiRequest('POST', '/api/transaction/create', {
  amount: 100,
  type: 'deposit'
});

if (!response.success) {
  throw new Error(response.error || 'Ошибка при создании транзакции');
}

return response.data;
```

**Новый способ**:

```typescript
const response = await apiPost<TransactionData>('/api/transaction/create', {
  amount: 100,
  type: 'deposit'
});

if (!response.success) {
  throw new Error(response.error || 'Ошибка при создании транзакции');
}

return response.data;
```

## Доступные методы

- `apiGet<T>(endpoint, options)`: Выполняет GET-запрос
- `apiPost<T>(endpoint, body, options)`: Выполняет POST-запрос
- `apiPut<T>(endpoint, body, options)`: Выполняет PUT-запрос
- `apiDelete<T>(endpoint, options)`: Выполняет DELETE-запрос
- `apiService<T>(endpoint, options)`: Базовый метод, который используется внутри вышеперечисленных

Каждый метод возвращает стандартизированный объект ответа:

```typescript
interface ApiResponse<T> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
  [key: string]: any;
}
```

## Примеры использования

### Простой GET-запрос

```typescript
// Получение баланса пользователя
const response = await apiGet<{ uni_balance: string, ton_balance: string }>('/api/wallet/balance');
if (response.success) {
  console.log('UNI баланс:', response.data.uni_balance);
  console.log('TON баланс:', response.data.ton_balance);
}
```

### POST-запрос с обработкой ошибок

```typescript
// Создание депозита
try {
  const response = await apiPost<{ transaction_id: number }>('/api/uni-farming/deposit', {
    amount: '100',
    user_id: userId
  });
  
  if (response.success) {
    console.log('Депозит создан! ID транзакции:', response.data.transaction_id);
    return response.data;
  } else {
    console.error('Ошибка при создании депозита:', response.error);
    throw new Error(response.error || 'Неизвестная ошибка');
  }
} catch (error) {
  console.error('Сетевая ошибка:', error);
  throw error;
}
```

## Рекомендации по миграции

1. Начните с компонентов, которые наиболее часто используют API-запросы
2. Используйте правильные типы данных для корректной типизации ответов
3. Все новые компоненты сразу разрабатывайте с использованием нового API-сервиса
4. При обработке ошибок отдавайте предпочтение полю `error` из ответа API

## Заключение

Новый API-сервис значительно упрощает работу с HTTP-запросами в проекте, обеспечивая более надежную обработку ошибок и лучшую типизацию. Переход на новый сервис сделает код более понятным, поддерживаемым и устойчивым к ошибкам.