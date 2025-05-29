# Структура базы данных UniFarm

## Обзор

UniFarm использует PostgreSQL в качестве основной базы данных с Drizzle ORM для типизированного доступа к данным. Архитектура базы данных разработана с учетом надежности, производительности и поддерживаемости.

## Основные компоненты

### 1. Файлы схемы данных

**Расположение:** `shared/schema.ts`

Централизованное описание всех таблиц и их полей через Drizzle ORM:

- Типизированные таблицы и колонки
- Определения первичных и внешних ключей
- Схемы вставки с использованием `createInsertSchema`
- Экспорт интерфейсов TypeScript для строгой типизации

Пример определения таблицы:

```typescript
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  telegram_id: bigint("telegram_id", { mode: "number" }).unique(),
  guest_id: text("guest_id").unique(),
  username: text("username"),
  ref_code: text("ref_code").unique(),
  // ...другие поля
});

// Типы для строгой типизации
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
```

### 2. Модуль работы с базой данных

**Расположение:** `server/db-standard.ts`

Централизованный модуль для подключения к базе данных и выполнения запросов:

- Единая точка конфигурации подключения к PostgreSQL
- Механизм автоматических повторных попыток при сбоях сети
- Мониторинг состояния соединения
- Удобные методы для выполнения SQL-запросов и транзакций

```typescript
// Примеры использования
import { db, transaction, query } from "./db-standard";

// ORM-запрос через Drizzle
const user = await db.select().from(users).where(eq(users.id, userId));

// Сырой SQL-запрос (при необходимости)
const result = await query('SELECT * FROM users WHERE id = $1', [userId]);

// Атомарная транзакция
await transaction(async (tx) => {
  await tx.insert(users).values({ ... });
  await tx.insert(transactions).values({ ... });
});
```

### 3. Интерфейс хранилища

**Расположение:** `server/storage-memory.ts`

Определяет контракт для всех хранилищ данных:

```typescript
export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  // ... другие методы
}
```

### 4. Реализация хранилища для базы данных

**Расположение:** `server/storage-standard.ts`

Реализует интерфейс `IStorage` с использованием Drizzle ORM:

- Типизированный доступ к данным
- Оптимизированные запросы
- Использование транзакций для сложных операций
- Логирование операций

### 5. Резервное хранилище в памяти

**Расположение:** `server/storage-memory.ts`

Реализация `IStorage` с использованием структур данных в памяти:

- Используется в случае недоступности базы данных
- Обеспечивает непрерывность работы приложения
- Автоматическое переключение при проблемах с подключением

### 6. Адаптер хранилища

**Расположение:** `server/storage-standard.ts`

Прозрачное переключение между базой данных и хранилищем в памяти:

- Автоматическое определение недоступности базы данных
- Повторные попытки восстановления соединения
- Делегирование вызовов нужной реализации

```typescript
// Пример использования адаптера
import { storage } from "./storage-standard";

// Метод автоматически использует подходящее хранилище
const user = await storage.getUser(userId);
```

## Таблицы базы данных

### Пользователи (`users`)

Хранит информацию о пользователях системы:

| Поле | Тип | Описание |
|------|-----|----------|
| id | serial | Первичный ключ |
| telegram_id | bigint | Уникальный ID пользователя Telegram |
| guest_id | text | Уникальный ID для неавторизованных пользователей |
| username | text | Имя пользователя |
| ref_code | text | Уникальный реферальный код |
| balance_uni | numeric | Баланс токенов UNI |
| balance_ton | numeric | Баланс токенов TON |
| ... | ... | ... |

### Транзакции (`transactions`)

Хранит историю всех финансовых операций:

| Поле | Тип | Описание |
|------|-----|----------|
| id | serial | Первичный ключ |
| user_id | integer | ID пользователя (внешний ключ) |
| type | text | Тип транзакции (deposit/withdraw/reward) |
| currency | text | Валюта (UNI/TON) |
| amount | numeric | Сумма транзакции |
| status | text | Статус транзакции |
| ... | ... | ... |

### Фарминг-депозиты (`farming_deposits`)

Хранит информацию о депозитах в фарминге:

| Поле | Тип | Описание |
|------|-----|----------|
| id | serial | Первичный ключ |
| user_id | integer | ID пользователя (внешний ключ) |
| amount_uni | numeric | Сумма депозита в UNI |
| rate_uni | numeric | Ставка фарминга UNI |
| rate_ton | numeric | Ставка фарминга TON |
| ... | ... | ... |

### Рефералы (`referrals`)

Хранит информацию о реферальных связях:

| Поле | Тип | Описание |
|------|-----|----------|
| id | serial | Первичный ключ |
| user_id | integer | ID пользователя-реферала |
| inviter_id | integer | ID пригласившего пользователя |
| level | integer | Уровень в реферальной цепочке |
| ... | ... | ... |

## Рекомендации по работе с базой данных

### Использование транзакций

Для операций, которые должны быть атомарными, используйте транзакции:

```typescript
import { transaction } from "./db-standard";

await transaction(async (tx) => {
  // Все операции внутри этого блока будут в одной транзакции
  // Если произойдет ошибка, все изменения будут откачены
  await tx.insert(users).values({ ... });
  await tx.update(balances).set({ ... });
});
```

### Работа с типами

Все данные строго типизированы, что помогает избежать ошибок:

```typescript
import { type User, type InsertUser } from "@shared/schema";

// Создание пользователя (тип гарантирует правильную структуру)
const insertUser: InsertUser = {
  username: "newuser",
  ref_code: "abc123def"
};

const user: User = await storage.createUser(insertUser);
```

### Обработка ошибок

При работе с базой данных всегда обрабатывайте возможные ошибки:

```typescript
try {
  const user = await storage.getUserByRefCode(refCode);
  // Обработка успешного результата
} catch (error) {
  console.error("Ошибка при получении пользователя:", error);
  // Обработка ошибки
}
```

## Миграции

Для изменения схемы базы данных в проекте используется Drizzle Kit:

```bash
# Создание миграции на основе изменений в схеме
npm run db:generate

# Применение миграций к базе данных
npm run db:push
```

## Дополнительные возможности

### Партиционирование таблиц

Для таблицы `transactions` настроено партиционирование по дате для повышения производительности при работе с большими объемами данных. Функции для управления партициями находятся в `server/scripts/partitioning.ts`.

### Мониторинг состояния базы данных

Состояние подключения к базе данных можно проверить через метод `getDatabaseState()` из `db-standard.ts`:

```typescript
import { getDatabaseState } from "./db-standard";

const state = getDatabaseState();
console.log(`Статус БД: ${state.connectionStatus}`);
console.log(`Использует хранилище в памяти: ${state.usingInMemoryStorage}`);
```

## Заключение

Архитектура базы данных в UniFarm обеспечивает надежность, типобезопасность и устойчивость к отказам. Использование Drizzle ORM с TypeScript делает код более безопасным и поддерживаемым, а механизм резервного хранилища гарантирует работоспособность приложения даже в случае проблем с подключением к базе данных.