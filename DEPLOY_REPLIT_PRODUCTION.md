# Развертывание UniFarm на Replit

Этот документ описывает процесс развертывания UniFarm на платформе Replit в production-режиме.

## Требования

- Replit аккаунт с доступом к проекту
- PostgreSQL база данных (автоматически предоставляется Replit)
- Правильно настроенный Telegram Mini App

## Шаги деплоя

### 1. Настройка переменных окружения

Установите следующие переменные окружения в Replit:

```
NODE_ENV=production
PORT=3000
DATABASE_PROVIDER=replit
```

### 2. Настройка базы данных

База данных PostgreSQL автоматически настраивается на Replit. Соединение с Replit PostgreSQL настроено в файле `server/db-replit.ts`.

### 3. Запуск сервера

Запуск production-сервера выполняется командой:

```bash
node production-server-port.mjs
```

Этот скрипт автоматически:
- Находит свободный порт, начиная с порта 3000
- Устанавливает соединение с базой данных Replit PostgreSQL
- Запускает сервер в production-режиме

### 4. Настройка постоянного запуска

Для постоянного запуска проекта на Replit необходимо создать и активировать файл `.replit` с правильной конфигурацией:

```toml
run = "NODE_ENV=production DATABASE_PROVIDER=replit node production-server-port.mjs"
modules = ["nodejs-20:v8-20230920-bd784b9"]

[env]
DATABASE_PROVIDER = "replit"
NODE_ENV = "production"
PORT = "3000"

[deployment]
run = ["sh", "-c", "NODE_ENV=production DATABASE_PROVIDER=replit node production-server-port.mjs"]
deploymentTarget = "cloudrun"
ignorePorts = false

[[ports]]
localPort = 3000
externalPort = 80
```

### 5. Проверка работоспособности

После запуска сервера проверьте работоспособность, открыв эндпоинт `/api/health`:

```
https://имя-вашего-проекта.replit.app/api/health
```

### 6. Настройка Telegram Mini App

Укажите URL вашего приложения в настройках Telegram Bot:

```
https://имя-вашего-проекта.replit.app
```

## Решение проблем

### Проблема с портом 3000

Если порт 3000 уже занят, скрипт `production-server-port.mjs` автоматически найдет свободный порт и запустит сервер на нем.

### Ошибки подключения к базе данных

Если возникают ошибки подключения к базе данных, проверьте настройки в `server/db-replit.ts` и убедитесь, что переменная окружения `DATABASE_PROVIDER=replit` установлена.

### Ошибки загрузки приложения

Если основное приложение не загружается, скрипт автоматически запустит упрощенную версию сервера, которая позволит вам диагностировать проблему.

## Дополнительные инструменты

- `check-replit-db.js` - скрипт для проверки соединения с базой данных
- `npm run db:push` - команда для применения миграций Drizzle к базе данных