# План стандартизации API UniFarm

## Цель документа

Определить конкретные шаги по стандартизации API, контроллеров и их взаимодействия с базой данных на основе проведенного аудита API-цепочки UniFarm.

## Приоритеты работ

1. **Высокий приоритет** - исправления, критичные для стабильной работы приложения
2. **Средний приоритет** - улучшения, повышающие качество и поддерживаемость кода
3. **Низкий приоритет** - задачи оптимизации и рефакторинга на будущее

## 1. Стандартизация формата API-ответов

### Задача 1.1: Создание middleware для стандартизации ответов API (Высокий приоритет)

**Шаги:**
1. Создать файл `server/middleware/responseFormatter.ts` с функцией для стандартизации ответов:
```typescript
import { Request, Response, NextFunction } from 'express';

// Расширяем тип Response для добавления новых методов
declare module 'express' {
  interface Response {
    success: (data: any) => Response;
    error: (message: string, errors?: any, statusCode?: number) => Response;
  }
}

/**
 * Middleware для стандартизации ответов API
 */
export function responseFormatter(req: Request, res: Response, next: NextFunction): void {
  // Успешный ответ
  res.success = function(data: any): Response {
    return this.status(200).json({
      success: true,
      data
    });
  };

  // Ответ с ошибкой
  res.error = function(message: string, errors = null, statusCode = 400): Response {
    const response: any = {
      success: false,
      message
    };

    if (errors) {
      response.errors = errors;
    }

    return this.status(statusCode).json(response);
  };

  next();
}
```

2. Добавить middleware в `server/index.ts`:
```typescript
import { responseFormatter } from './middleware/responseFormatter';

// ...

app.use(responseFormatter);
```

3. Обновить все контроллеры для использования новых методов `res.success()` и `res.error()`.

### Задача 1.2: Обновление контроллеров для использования стандартного формата (Средний приоритет)

**Шаги:**
1. Обновить `authController.ts`, пример:
```typescript
// До
res.status(200).json({
  message: "Пользователь успешно создан",
  user: newUser
});

// После
res.success({
  message: "Пользователь успешно создан",
  user: newUser
});
```

2. Обновить `uniFarmingController.ts`, пример:
```typescript
// До
res.status(400).json({
  message: "Недостаточно средств для операции"
});

// После
res.error("Недостаточно средств для операции");
```

3. Последовательно обновить все остальные контроллеры.

## 2. Централизованная валидация входных данных

### Задача 2.1: Создание утилиты для стандартизированной валидации (Высокий приоритет)

**Шаги:**
1. Создать файл `server/utils/validation.ts`:
```typescript
import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

/**
 * Валидирует входные данные запроса с помощью Zod-схемы
 * @param schema Zod-схема для валидации
 * @param source Источник данных ('body', 'query', 'params')
 */
export function validateRequest(schema: z.ZodType<any>, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    
    if (!result.success) {
      return res.error(
        "Некорректные параметры запроса",
        result.error.format(),
        400
      );
    }
    
    // Обновляем объект req данными после валидации и преобразования
    req[source] = result.data;
    next();
  };
}

/**
 * Валидатор для числовых ID
 */
export const idValidator = z.object({
  user_id: z.string()
    .refine(val => !isNaN(parseInt(val)), {
      message: "user_id должен быть числом"
    })
    .transform(val => parseInt(val))
    .refine(val => val > 0, {
      message: "user_id должен быть положительным числом"
    })
});

/**
 * Валидатор для денежных операций
 */
export const moneyValidator = z.object({
  amount: z.string().or(z.number())
    .refine(val => {
      const num = typeof val === "string" ? parseFloat(val) : val;
      return !isNaN(num) && num > 0;
    }, { 
      message: "Сумма должна быть положительным числом" 
    })
    .transform(val => typeof val === "string" ? parseFloat(val) : val)
});

/**
 * Валидатор для адреса TON-кошелька
 */
export const tonAddressValidator = z.object({
  wallet_address: z.string()
    .min(1, "Адрес кошелька не может быть пустым")
    .refine(val => /^(?:UQ|EQ)[A-Za-z0-9_-]{46,48}$/.test(val), {
      message: "Некорректный формат TON-адреса"
    })
});
```

2. Обновить маршруты для использования валидаторов, например `server/routes.ts`:
```typescript
import { validateRequest, idValidator, moneyValidator } from './utils/validation';
import { z } from 'zod';

// ...

// Валидация для endpoint /uni-farming/deposit
const depositSchema = z.object({
  user_id: z.number().int().positive(),
  amount: z.string().or(z.number()).refine(val => {
    const num = typeof val === "string" ? parseFloat(val) : val;
    return !isNaN(num) && num > 0;
  }, { message: "Сумма должна быть положительным числом" })
});

app.post(
  '/api/uni-farming/deposit',
  validateRequest(depositSchema),
  UniFarmingController.depositFarming
);

// Пример валидации для GET-запроса
app.get(
  '/api/users/me',
  validateRequest(idValidator, 'query'),
  UserController.getUser
);
```

### Задача 2.2: Применение централизованной валидации во всех контроллерах (Средний приоритет)

**Шаги:**
1. Определить схемы Zod для всех API-эндпоинтов
2. Обновить все маршруты для использования middleware валидации
3. Удалить дублирующую валидацию из контроллеров

## 3. Улучшение работы с базой данных

### Задача 3.1: Реализация транзакционного сервиса (Высокий приоритет)

**Шаги:**
1. Создать файл `server/services/databaseService.ts`:
```typescript
import { db } from '../db';
import { pool } from '../db';

/**
 * Сервис для транзакционной работы с базой данных
 */
export class DatabaseService {
  /**
   * Выполняет группу операций в одной транзакции
   * @param callback Функция с операциями базы данных
   */
  static async withTransaction<T>(callback: (db: any) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    
    try {
      // Начинаем транзакцию
      await client.query('BEGIN');
      
      // Создаем инстанс drizzle с клиентом транзакции
      const txDb = drizzle(client);
      
      // Вызываем callback с контекстом транзакции
      const result = await callback(txDb);
      
      // Фиксируем транзакцию
      await client.query('COMMIT');
      
      return result;
    } catch (error) {
      // Откатываем транзакцию в случае ошибки
      await client.query('ROLLBACK');
      console.error('[DatabaseService] Ошибка транзакции:', error);
      throw error;
    } finally {
      // Освобождаем клиента
      client.release();
    }
  }
}
```

2. Обновить сервис транзакций для использования транзакций:
```typescript
import { DatabaseService } from './databaseService';
import { transactions } from '@shared/schema';

// ...

/**
 * Обновляет баланс пользователя и создает транзакцию
 */
static async updateBalanceWithTransaction(userId: number, amount: number, 
  currency: string, type: string, category: string): Promise<any> {
  
  return await DatabaseService.withTransaction(async (txDb) => {
    // 1. Получаем текущего пользователя
    const [user] = await txDb.select().from(users).where(eq(users.id, userId));
    
    if (!user) {
      throw new Error(`Пользователь не найден: ${userId}`);
    }
    
    // 2. Обновляем баланс
    const balanceField = currency.toUpperCase() === 'UNI' ? 'balance_uni' : 'balance_ton';
    const currentBalance = parseFloat(user[balanceField] || '0');
    const newBalance = currentBalance + amount;
    
    // Проверка на отрицательный баланс
    if (newBalance < 0) {
      throw new Error(`Недостаточно средств для операции. Текущий баланс: ${currentBalance} ${currency}`);
    }
    
    // 3. Обновляем пользователя
    const [updatedUser] = await txDb
      .update(users)
      .set({ [balanceField]: newBalance.toString() })
      .where(eq(users.id, userId))
      .returning();
    
    // 4. Создаем запись о транзакции
    const [transaction] = await txDb
      .insert(transactions)
      .values({
        user_id: userId,
        type,
        currency: currency.toUpperCase(),
        amount: Math.abs(amount).toString(),
        status: 'confirmed',
        category,
        created_at: new Date()
      })
      .returning();
    
    return {
      user: updatedUser,
      transaction
    };
  });
}
```

3. Обновить контроллеры для использования транзакционного сервиса.

## 4. Обработка ошибок и логирование

### Задача 4.1: Создание централизованной системы обработки ошибок (Средний приоритет)

**Шаги:**
1. Создать файл `server/middleware/errorHandler.ts`:
```typescript
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware для централизованной обработки ошибок
 */
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  console.error(`[ErrorHandler] ${err.message}`, {
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query,
    params: req.params,
    stack: err.stack
  });
  
  // Определяем HTTP-код ответа на основе типа ошибки
  let statusCode = 500;
  let errorMessage = 'Внутренняя ошибка сервера';
  
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorMessage = err.message;
  } else if (err.name === 'NotFoundError') {
    statusCode = 404;
    errorMessage = err.message;
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    errorMessage = 'Не авторизован';
  } else if (err.name === 'ForbiddenError') {
    statusCode = 403;
    errorMessage = 'Доступ запрещен';
  }
  
  // Формируем ответ
  res.status(statusCode).json({
    success: false,
    message: errorMessage,
    errors: err.errors || null
  });
}

/**
 * Пользовательские классы ошибок
 */
export class ValidationError extends Error {
  name = 'ValidationError';
  errors: any;
  
  constructor(message: string, errors?: any) {
    super(message);
    this.errors = errors;
  }
}

export class NotFoundError extends Error {
  name = 'NotFoundError';
  
  constructor(message: string) {
    super(message);
  }
}

export class UnauthorizedError extends Error {
  name = 'UnauthorizedError';
  
  constructor(message: string = 'Не авторизован') {
    super(message);
  }
}

export class ForbiddenError extends Error {
  name = 'ForbiddenError';
  
  constructor(message: string = 'Доступ запрещен') {
    super(message);
  }
}
```

2. Добавить middleware в `server/index.ts`:
```typescript
import { errorHandler } from './middleware/errorHandler';

// ...

// Регистрируем в самом конце, после всех маршрутов
app.use(errorHandler);
```

3. Обновить контроллеры для использования новых классов ошибок:
```typescript
import { NotFoundError, ValidationError } from '../middleware/errorHandler';

// ...

// Использование в контроллере
const user = await storage.getUserById(userId);
if (!user) {
  throw new NotFoundError(`Пользователь с ID=${userId} не найден`);
}

// Валидация в контроллере
if (isNaN(amount) || amount <= 0) {
  throw new ValidationError('Сумма должна быть положительным числом');
}
```

### Задача 4.2: Централизованное логирование (Низкий приоритет)

**Шаги:**
1. Создать файл `server/utils/logger.ts`:
```typescript
/**
 * Централизованный логгер
 */
export class Logger {
  private static formatMessage(level: string, module: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] [${module}] ${message}`;
  }
  
  static debug(module: string, message: string, data?: any): void {
    console.debug(this.formatMessage('DEBUG', module, message), data || '');
  }
  
  static info(module: string, message: string, data?: any): void {
    console.info(this.formatMessage('INFO', module, message), data || '');
  }
  
  static warn(module: string, message: string, data?: any): void {
    console.warn(this.formatMessage('WARN', module, message), data || '');
  }
  
  static error(module: string, message: string, error?: any): void {
    console.error(this.formatMessage('ERROR', module, message), error || '');
    if (error && error.stack) {
      console.error(error.stack);
    }
  }
}
```

2. Обновить контроллеры для использования централизованного логгера.

## 5. Дополнительные улучшения

### Задача 5.1: Идемпотентность операций (Средний приоритет)

**Шаги:**
1. Добавить в схему транзакций поле `request_id`:
```typescript
// В shared/schema.ts
export const transactions = pgTable("transactions", {
  // ...существующие поля...
  request_id: text("request_id"), // Уникальный ID запроса для идемпотентности
});
```

2. Создать middleware для обработки идемпотентных запросов:
```typescript
import { v4 as uuidv4 } from 'uuid';
import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { transactions } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Middleware для обеспечения идемпотентности операций
 * Требует HTTP-заголовок 'X-Request-ID'
 */
export async function idempotencyMiddleware(req: Request, res: Response, next: NextFunction) {
  // Применяем только для критичных операций (POST и PUT запросы к API)
  if (req.method !== 'POST' && req.method !== 'PUT') {
    return next();
  }
  
  // Получаем ID запроса из заголовка или генерируем новый
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  
  // Сохраняем ID запроса для использования в контроллерах
  req.headers['x-request-id'] = requestId;
  
  // Проверяем, был ли уже такой запрос
  const existingTransactions = await db
    .select()
    .from(transactions)
    .where(eq(transactions.request_id, requestId));
  
  if (existingTransactions.length > 0) {
    // Запрос уже был обработан, возвращаем сохраненный результат
    return res.status(200).json({
      success: true,
      data: {
        message: "Операция уже была выполнена",
        transaction: existingTransactions[0]
      }
    });
  }
  
  // Продолжаем обработку запроса
  next();
}
```

3. Обновить сервис транзакций для поддержки идемпотентности:
```typescript
static async logTransaction(data: any): Promise<any> {
  // Проверяем, есть ли request_id
  const requestId = data.requestId || null;
  
  // Если есть request_id, проверяем существование транзакции
  if (requestId) {
    const existingTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.request_id, requestId));
    
    if (existingTransactions.length > 0) {
      // Транзакция уже существует, возвращаем её
      return existingTransactions[0];
    }
  }
  
  // Добавляем request_id к данным транзакции
  const transactionData = {
    ...data,
    request_id: requestId
  };
  
  // Создаем транзакцию
  const [transaction] = await db
    .insert(transactions)
    .values(transactionData)
    .returning();
  
  return transaction;
}
```

### Задача 5.2: Управление конфликтами в ресурсах (Низкий приоритет)

**Шаги:**
1. Реализовать механизм блокировки для критических ресурсов:
```typescript
/**
 * Сервис для управления блокировками ресурсов
 */
export class LockService {
  // Map для хранения блокировок: ключ - идентификатор ресурса, значение - время блокировки
  private static locks = new Map<string, number>();
  
  // Время жизни блокировки (30 секунд)
  private static LOCK_TTL = 30000;
  
  /**
   * Пытается заблокировать ресурс
   * @param resourceId Идентификатор ресурса (например, 'user-123')
   * @returns true если блокировка успешна, false если ресурс уже заблокирован
   */
  static acquireLock(resourceId: string): boolean {
    const now = Date.now();
    
    // Проверяем существующую блокировку
    if (this.locks.has(resourceId)) {
      const lockTime = this.locks.get(resourceId);
      
      // Если блокировка устарела, удаляем её
      if (now - lockTime > this.LOCK_TTL) {
        this.locks.delete(resourceId);
      } else {
        return false; // Ресурс уже заблокирован
      }
    }
    
    // Создаем блокировку
    this.locks.set(resourceId, now);
    return true;
  }
  
  /**
   * Освобождает блокировку ресурса
   * @param resourceId Идентификатор ресурса
   */
  static releaseLock(resourceId: string): void {
    this.locks.delete(resourceId);
  }
}
```

2. Использовать сервис блокировок в критических операциях:
```typescript
// Пример использования в контроллере
static async withdrawFunds(req: Request, res: Response): Promise<void> {
  const { user_id } = req.body;
  const resourceId = `user-balance-${user_id}`;
  
  // Пытаемся заблокировать ресурс
  if (!LockService.acquireLock(resourceId)) {
    return res.error("Операция уже выполняется. Пожалуйста, повторите позднее", null, 409);
  }
  
  try {
    // Выполняем операцию вывода средств
    // ...код операции...
    
    return res.success({ message: "Операция успешно выполнена" });
  } catch (error) {
    throw error;
  } finally {
    // Всегда освобождаем блокировку
    LockService.releaseLock(resourceId);
  }
}
```

## План внедрения

1. **Фаза 1 - Базовая стандартизация (1-2 дня)**
   - Внедрить middleware для стандартизации ответов API
   - Обновить несколько ключевых контроллеров (authController, uniFarmingController)
   - Добавить централизованный обработчик ошибок

2. **Фаза 2 - Улучшение валидации (2-3 дня)**
   - Реализовать централизованную валидацию
   - Обновить все контроллеры для использования стандартных валидаторов
   - Добавить подробное логирование ошибок валидации

3. **Фаза 3 - Улучшение работы с БД (3-4 дня)**
   - Внедрить транзакционный сервис
   - Обновить сервисы для работы с транзакциями
   - Добавить идемпотентность операций

4. **Фаза 4 - Оптимизация и завершение (2-3 дня)**
   - Внедрить систему блокировок для критических ресурсов
   - Провести тестирование всех API-эндпоинтов
   - Оптимизировать и убрать излишний код

## Заключение

План стандартизации API UniFarm представляет собой комплексный подход к улучшению качества
кода, безопасности и надежности приложения. После внедрения всех предложенных улучшений API
будет иметь единый стандарт ответов, надежную валидацию входных данных, транзакционную 
работу с базой данных и эффективную обработку ошибок.