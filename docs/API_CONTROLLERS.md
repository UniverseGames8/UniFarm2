# Архитектура контроллеров API

## Обзор

В UniFarm используется многоуровневая архитектура API, которая обеспечивает чистый код, разделение ответственности и улучшает тестируемость. Архитектура состоит из следующих уровней:

1. **Контроллеры API** — Обрабатывают HTTP-запросы и ответы
2. **Сервисы** — Содержат бизнес-логику и работают с хранилищем данных
3. **Хранилище данных** — Взаимодействует с базой данных или предоставляет in-memory хранилище
4. **Модели данных** — Определяют структуру данных с помощью Drizzle ORM

## Уровни архитектуры

### 1. Контроллеры API

**Расположение:** `server/controllers/`

Контроллеры обрабатывают HTTP-запросы, валидируют входные данные и формируют ответы. Они не должны содержать бизнес-логику, а только делегировать выполнение операций сервисам.

Пример структуры контроллера:

```typescript
export async function getUserById(req: Request, res: Response) {
  try {
    const userId = parseInt(req.params.id, 10);
    
    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user ID'
      });
    }
    
    const user = await userService.getUserById(userId);
    
    return res.json({
      success: true,
      data: { user }
    });
  } catch (error: any) {
    // Обработка ошибок
  }
}
```

### 2. Сервисы

**Расположение:** `server/services/`

Сервисы содержат бизнес-логику приложения и предоставляют интерфейс для контроллеров. Они не должны напрямую взаимодействовать с HTTP-запросами или ответами.

```typescript
export class UserService {
  constructor(private storage: IStorage) {}
  
  async getUserById(id: number): Promise<User> {
    const user = await this.storage.getUser(id);
    
    if (!user) {
      throw StorageErrors.notFound('User', { id });
    }
    
    return user;
  }
  
  // Другие методы...
}
```

### 3. Хранилище данных

**Расположение:** `server/storage-standard.ts` и `server/storage-interface.ts`

Хранилище данных абстрагирует доступ к базе данных или другим источникам данных. Оно предоставляет интерфейс для сервисов и скрывает детали реализации хранения.

```typescript
export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  // Другие методы...
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }
  
  // Другие методы...
}
```

### 4. Модели данных

**Расположение:** `shared/schema.ts`

Модели данных определяют структуру данных, используемых в приложении. UniFarm использует Drizzle ORM для определения таблиц и их отношений.

```typescript
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username"),
  // Другие поля...
});

export type User = typeof users.$inferSelect;
```

## Маршруты API

Контроллеры подключаются к маршрутам Express для обработки HTTP-запросов:

```typescript
// Маршруты пользователей
app.get('/api/users/:id', UserController.getUserById);
app.get('/api/users/username/:username', UserController.getUserByUsername);
app.post('/api/users', UserController.createUser);
app.put('/api/users/:id/ref-code', UserController.updateRefCode);

// Маршруты транзакций
app.get('/api/users/:userId/transactions', TransactionController.getUserTransactions);
app.post('/api/users/:userId/deposit', TransactionController.depositFunds);
app.post('/api/users/:userId/withdraw', TransactionController.withdrawFunds);
app.post('/api/transactions', TransactionController.createTransaction);
```

## Обработка ошибок

В контроллерах используется стандартизированный подход к обработке ошибок:

```typescript
try {
  // Код операции...
} catch (error: any) {
  console.error('[ControllerName] Ошибка:', error);
  
  if (error.type === StorageErrorType.NOT_FOUND) {
    return res.status(404).json({
      success: false,
      error: 'Entity not found'
    });
  }
  
  if (error.type === StorageErrorType.VALIDATION) {
    return res.status(400).json({
      success: false,
      error: error.message || 'Invalid input data'
    });
  }
  
  return res.status(500).json({
    success: false,
    error: 'Failed to perform operation'
  });
}
```

## Типы ошибок

В приложении используются следующие типы ошибок:

- `NOT_FOUND` — Запрошенная сущность не найдена
- `DUPLICATE` — Попытка создать дубликат уникальной сущности
- `VALIDATION` — Неверные входные данные
- `DATABASE` — Ошибка базы данных
- `UNKNOWN` — Неизвестная ошибка

## Лучшие практики

### Контроллеры

- Контроллеры должны быть максимально тонкими
- Каждый контроллер должен отвечать только за одну операцию
- Валидация входных данных должна происходить в контроллере
- Обработка ошибок должна быть стандартизированной

### Сервисы

- Сервисы должны содержать всю бизнес-логику
- Сервисы не должны знать о деталях HTTP-запросов
- Для зависимостей сервисов используется внедрение зависимостей

### Хранилище данных

- Должно абстрагировать доступ к данным
- Должно предоставлять единый интерфейс для работы с данными
- Должно поддерживать переключение между разными источниками данных

### Общие рекомендации

- Использовать асинхронный код с async/await
- Регистрировать ошибки с достаточным контекстом
- Следовать принципу единой ответственности
- Избегать дублирования кода

## Примеры использования

### Получение данных

```typescript
const user = await userService.getUserById(userId);

return res.json({
  success: true,
  data: { user }
});
```

### Создание данных

```typescript
const user = await userService.createUser({
  username,
  telegramId,
  guestId,
  parentRefCode
});

return res.status(201).json({
  success: true,
  data: { user }
});
```

### Обновление данных

```typescript
const updatedUser = await userService.updateRefCode(userId, newRefCode);

return res.json({
  success: true,
  data: { user: updatedUser }
});
```

## Заключение

Многоуровневая архитектура API позволяет создавать поддерживаемый, тестируемый и расширяемый код. Следуя описанным принципам и практикам, можно создавать качественные и надежные API-эндпоинты для UniFarm.