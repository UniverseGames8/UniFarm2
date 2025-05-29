# Миграция на Replit PostgreSQL

## Цель миграции

Переход от Neon DB на локальную PostgreSQL базу данных на Replit для обеспечения более надежной работы и упрощения процесса разработки. Миграция выполнена без изменения существующей архитектуры проекта, с сохранением всех API и бизнес-логики.

## Выполненные изменения

### 1. Настройка переменных окружения

Создан/обновлен файл `.env.replit` с правильными параметрами подключения к PostgreSQL на Replit:

```
DATABASE_PROVIDER=replit
NODE_ENV=production
PUBLIC_MODE=production
PORT=3000
VITE_BOT_USERNAME=UniFarming_Bot
VITE_APP_NAME=UniFarm
USE_OPTIMIZED_REFERRALS=false
DATABASE_URL=postgresql://runner@localhost:5432/postgres
PGHOST=localhost
PGPORT=5432
PGUSER=runner
PGPASSWORD=
PGDATABASE=postgres
USE_LOCAL_DB_ONLY=true
```

### 2. Обновление механизма выбора базы данных

В файле `server/db-selector-new.ts` добавлена логика защиты от случайного переключения на Neon DB, когда установлен флаг `USE_LOCAL_DB_ONLY=true`. Это предотвращает потерю данных и обеспечивает безопасное использование Replit PostgreSQL.

### 3. Обновление механизма инициализации в `server/index.ts`

Добавлена проверка конфигурации базы данных с приоритетом использования Replit PostgreSQL. Выводятся предупреждения при обнаружении конфликтующих настроек.

### 4. Создание скриптов для работы с Replit PostgreSQL

1. **start-postgres.sh** - скрипт для запуска и проверки статуса PostgreSQL на Replit
   ```bash
   ./start-postgres.sh
   ```

2. **start-with-replit-db.js** - скрипт для полной настройки и запуска приложения с PostgreSQL:
   - Запускает PostgreSQL через start-postgres.sh
   - Загружает настройки из `.env.replit`
   - Проверяет наличие необходимых переменных окружения
   - Блокирует возможность подключения к Neon DB
   - Запускает сервер с принудительным использованием Replit PostgreSQL

## Использование

### Быстрый запуск с Replit PostgreSQL (рекомендуется)

```bash
node start-with-replit-db.js
```

Этот скрипт автоматически выполнит все необходимые действия:
1. Запустит PostgreSQL на Replit
2. Загрузит настройки из .env.replit
3. Установит переменную окружения DATABASE_PROVIDER=replit
4. Проверит наличие необходимых переменных для PostgreSQL
5. Запустит сервер с настройками для Replit PostgreSQL

### Ручной запуск компонентов

Если вам нужен больший контроль:

1. Запустите PostgreSQL:
```bash
./start-postgres.sh
```

2. Запустите сервер с явным указанием провайдера:
```bash
DATABASE_PROVIDER=replit node server/index.ts
```

### Механизм защиты от использования Neon DB

Если установлен флаг `USE_LOCAL_DB_ONLY=true` в `.env.replit`, все попытки переключения на Neon DB будут блокироваться. Это защищает от потери данных и путаницы между базами данных.

## Миграция данных

После запуска PostgreSQL на Replit, нужно создать схему базы данных:

1. Запустите PostgreSQL:
   ```bash
   ./start-postgres.sh
   ```

2. Выполните миграцию схемы:
   ```bash
   npx drizzle-kit push:pg
   ```

## Проверка и отладка

### Проверка статуса PostgreSQL

```bash
pg_ctl status
```

### Проверка соединения с базой данных

```bash
PGHOST=localhost PGUSER=runner PGDATABASE=postgres psql -c "SELECT current_database(), version();"
```

### Проверка переменных окружения

```bash
node -e "console.log('DATABASE_URL:', process.env.DATABASE_URL, '\nPGHOST:', process.env.PGHOST)"
```

## Устранение проблем

### PostgreSQL не запускается 

1. Проверьте, что PostgreSQL не запущен (не должно быть ошибки "порт уже используется"):
   ```bash
   pg_ctl status
   ```

2. Инициализируйте базу данных вручную:
   ```bash
   mkdir -p $HOME/.postgresql/data
   pg_ctl initdb -D $HOME/.postgresql/data
   ```

3. Запустите PostgreSQL:
   ```bash
   pg_ctl -D $HOME/.postgresql/data -l $HOME/.postgresql/logfile start
   ```

### Ошибка "Отсутствуют необходимые переменные окружения"

Убедитесь, что создана база данных PostgreSQL на Replit:
1. Используйте инструмент `create_postgresql_database_tool` в интерфейсе Replit
2. Перезапустите терминал после создания базы данных
3. Запустите приложение через `node start-with-replit-db.js`

### Ошибка "Connection refused" при подключении к PostgreSQL

Эта ошибка означает, что сервер PostgreSQL не запущен:
1. Запустите PostgreSQL через скрипт: `./start-postgres.sh`
2. Убедитесь, что сервер успешно запустился: `pg_ctl status`
3. Затем запустите приложение: `node start-with-replit-db.js`

### Конфликт настроек баз данных

Если вы видите предупреждения о конфликте настроек:
1. Проверьте содержимое `.env.replit` и других файлов .env
2. Для принудительного использования Replit PostgreSQL установите `USE_LOCAL_DB_ONLY=true`
3. Запустите приложение через `node start-with-replit-db.js`