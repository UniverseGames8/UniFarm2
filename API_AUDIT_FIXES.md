# Руководство по исправлению выявленных проблем API-цепочки

На основе проведенного аудита API-цепочки UniFarm были выявлены и исправлены критические
проблемы в следующих областях:

1. Валидация входных данных
2. Согласованность типов
3. Форматы ответов API
4. Работа с базой данных
5. Обработка ошибок

Ниже представлены выполненные исправления и рекомендации для дальнейшего улучшения.

## Исправление 1: Валидация входных данных и типов

### Проблема
Несогласованная валидация между контроллерами, отсутствие проверок на отрицательные значения и
некорректное преобразование типов.

### Исправления в WalletController
```typescript
// До исправления
static async linkWalletAddress(req: Request, res: Response): Promise<void> {
  try {
    const { wallet_address, user_id } = req.body;
    
    if (!user_id) {
      res.status(400).json({ message: "Отсутствует user_id" });
      return;
    }
    
    // Отсутствовала проверка формата адреса TON-кошелька
    
    // ... логика привязки кошелька
  } catch (error) {
    // ...
  }
}

// После исправления
static validateTonAddress(address: string): boolean {
  // Базовая валидация TON-адреса (UQ... или EQ... форматы)
  const tonAddressRegex = /^(?:UQ|EQ)[A-Za-z0-9_-]{46,48}$/;
  return tonAddressRegex.test(address);
}

static async linkWalletAddress(req: Request, res: Response): Promise<void> {
  try {
    // Валидация входных данных с помощью Zod
    const schema = z.object({
      wallet_address: z.string().min(1, "Адрес кошелька не может быть пустым"),
      user_id: z.number().positive("ID пользователя должен быть положительным числом").optional()
    });

    const validation = schema.safeParse(req.body);
    
    if (!validation.success) {
      console.error('[WalletController] Ошибка валидации входных данных:', validation.error.format());
      res.status(400).json({
        success: false,
        message: 'Некорректные параметры запроса',
        errors: validation.error.format()
      });
      return;
    }
    
    const { wallet_address } = validation.data;
    
    // Валидация формата TON-адреса
    if (!WalletController.validateTonAddress(wallet_address)) {
      console.error(`[WalletController] Некорректный формат TON-адреса: ${wallet_address}`);
      res.status(400).json({
        success: false,
        message: 'Некорректный формат TON-адреса'
      });
      return;
    }
    
    // ... оставшаяся логика привязки кошелька
  } catch (error) {
    // ...
  }
}
```

### Исправления в TransactionController
```typescript
// До исправления
static async withdrawFunds(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, amount, currency, address } = req.body;
    
    // Отсутствовала проверка на отрицательные значения и преобразование типов
    
    // ... логика вывода средств
  } catch (error) {
    // ...
  }
}

// После исправления
static async withdrawFunds(req: Request, res: Response): Promise<void> {
  try {
    // Валидация входных данных с помощью Zod
    const schema = z.object({
      user_id: z.number().int().positive("ID пользователя должен быть положительным целым числом"),
      amount: z.string().or(z.number()).refine(val => {
        const num = typeof val === "string" ? parseFloat(val) : val;
        return !isNaN(num) && num > 0;
      }, { message: "Сумма должна быть положительным числом" }),
      currency: z.string().min(1, "Валюта должна быть указана").refine(val => 
        ['UNI', 'TON'].includes(val.toUpperCase()), 
        { message: "Валюта должна быть UNI или TON" }
      ),
      address: z.string().min(1, "Адрес кошелька должен быть указан")
    });
    
    const validation = schema.safeParse(req.body);
    
    if (!validation.success) {
      console.error("[TransactionController] Ошибка валидации запроса:", validation.error.format());
      res.status(400).json({
        success: false,
        message: "Некорректные параметры запроса",
        errors: validation.error.format()
      });
      return;
    }
    
    const { user_id, amount, currency, address } = validation.data;
    
    // Преобразование суммы к числу
    const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
    
    // Верхнеуровневый формат валюты для унификации
    const formattedCurrency = currency.toUpperCase();
    
    // ... оставшаяся логика вывода средств
  } catch (error) {
    // ...
  }
}
```

### Исправления в ReferralController
```typescript
// До исправления
static async getReferralTree(req: Request, res: Response): Promise<void> {
  try {
    const user_id = parseInt(req.query.user_id as string);
    
    // Отсутствовала проверка на корректность преобразования и положительность значения
    
    // ... логика получения реферального дерева
  } catch (error) {
    // ...
  }
}

// После исправления
static async getReferralTree(req: Request, res: Response): Promise<void> {
  try {
    const schema = z.object({
      user_id: z.string()
        .refine(val => !isNaN(parseInt(val)), {
          message: "user_id должен быть числом"
        })
        .transform(val => parseInt(val))
        .refine(val => val > 0, {
          message: "user_id должен быть положительным числом"
        })
    });
    
    const validation = schema.safeParse(req.query);
    
    if (!validation.success) {
      res.status(400).json({
        success: false,
        message: "Некорректные параметры запроса",
        errors: validation.error.format()
      });
      return;
    }
    
    const { user_id } = validation.data;
    
    // ... оставшаяся логика получения реферального дерева
  } catch (error) {
    // ...
  }
}
```

## Исправление 2: Стандартизация ответов API

### Проблема
Различные форматы ответов API между контроллерами, отсутствие единого формата для успешных ответов и ошибок.

### Стандартизированный формат ответа
Был внедрен единый формат для всех API-ответов:

```typescript
// Структура успешного ответа
{
  success: true,
  data: { ... }
}

// Структура ответа с ошибкой
{
  success: false,
  message: "Сообщение об ошибке",
  errors?: { ... } // Подробности ошибок валидации, если есть
}
```

### Исправления в контроллерах
Все контроллеры были обновлены для использования единого формата ответа.

```typescript
// До исправления (разные форматы ответов)
res.status(200).json({ result: "success", user: user });
res.status(400).json({ message: "Ошибка" });

// После исправления (единый формат)
res.status(200).json({
  success: true,
  data: { user }
});

res.status(400).json({
  success: false,
  message: "Ошибка"
});
```

## Исправление 3: Проверка существования пользователя

### Проблема
Многие контроллеры не проверяли существование пользователя перед выполнением операций, что могло
привести к ошибкам и несогласованному состоянию данных.

### Примеры исправлений

```typescript
// До исправления
static async withdrawFunds(req: Request, res: Response): Promise<void> {
  try {
    const { user_id, amount, currency, address } = req.body;
    
    // Отсутствовала проверка существования пользователя
    
    // ... логика вывода средств
  } catch (error) {
    // ...
  }
}

// После исправления
static async withdrawFunds(req: Request, res: Response): Promise<void> {
  try {
    // ... валидация входных данных ...
    
    // Проверяем существование пользователя
    const user = await storage.getUserById(user_id);
    if (!user) {
      console.error(`[TransactionController] Пользователь не найден: ${user_id}`);
      res.status(404).json({
        success: false,
        message: "Пользователь не найден"
      });
      return;
    }
    
    // ... оставшаяся логика вывода средств
  } catch (error) {
    // ...
  }
}
```

## Исправление 4: Безопасная работа с балансами

### Проблема
Небезопасное обращение к балансам пользователей, которые могут быть не определены или иметь
разные типы данных.

### Исправления

```typescript
// До исправления
const balance = formattedCurrency === 'UNI' 
  ? parseFloat(user.balance_uni || '0')
  : parseFloat(user.balance_ton || '0');

// После исправления
// Используем безопасное получение значений баланса с учетом возможных отличий в типе пользователя
const balanceUni = typeof user.balance_uni === 'string' ? user.balance_uni : '0';
const balanceTon = typeof user.balance_ton === 'string' ? user.balance_ton : '0';

const balance = formattedCurrency === 'UNI' 
  ? parseFloat(balanceUni || '0')
  : parseFloat(balanceTon || '0');
```

## Исправление 5: Подробное логирование и обработка ошибок

### Проблема
Недостаточно подробное логирование ошибок, затрудняющее диагностику проблем.

### Исправления

```typescript
// До исправления
try {
  // ... логика ...
} catch (error) {
  console.error("Ошибка:", error);
  res.status(500).json({ message: "Произошла ошибка" });
}

// После исправления
try {
  // ... логика ...
} catch (error) {
  console.error("[TransactionController] Ошибка при запросе на вывод средств:", error);
  res.status(500).json({
    success: false,
    message: "Произошла ошибка при обработке запроса на вывод средств"
  });
}
```

## Исправление 6: Типизация сессий

### Проблема
Отсутствие типизации для сессий Express, приводящее к ошибкам при доступе к свойствам сессии.

### Исправления

```typescript
// Добавление определения типов для сессии
import 'express-session';

// Типизация для доступа к свойствам сессии
declare module 'express-session' {
  interface SessionData {
    userId?: number;
    user?: {
      id: number;
      username: string;
      ref_code?: string;
      guest_id?: string;
    };
  }
}
```

## Рекомендации для дальнейшего улучшения

После выполненных исправлений рекомендуются следующие дальнейшие улучшения:

1. **Внедрение middleware для валидации**
   - Создать общие middleware для валидации запросов, чтобы уменьшить дублирование кода в контроллерах

2. **Реализация сервисного слоя**
   - Вынести бизнес-логику из контроллеров в отдельные сервисы для лучшей организации кода
   - Создать единый сервис для работы с балансами пользователей

3. **Транзакционность операций с БД**
   - Обернуть многоэтапные операции с базой данных в транзакции для обеспечения целостности данных

4. **Расширение тестового покрытия**
   - Разработать автоматизированные тесты для всех API-эндпоинтов
   - Реализовать интеграционные тесты для проверки всей цепочки API → Контроллер → БД

5. **Доработка документации API**
   - Создать подробную документацию API с описанием всех параметров, типов данных и возможных ответов
   - Внедрить автоматическую генерацию документации из кода (например, с использованием Swagger)

## Заключение

Выполненные исправления значительно улучшили надежность, безопасность и поддерживаемость API-цепочки
UniFarm. Основные проблемы были адресованы, но для постоянного улучшения качества кодовой базы
рекомендуется продолжить работу над оставшимися рекомендациями.