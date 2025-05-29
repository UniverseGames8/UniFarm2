#!/bin/bash

# Скрипт для запуска и инициализации PostgreSQL на Replit

# Проверяем, запущен ли PostgreSQL
pg_running=$(ps aux | grep postgres | grep -v grep | wc -l)

# Определяем путь к PostgreSQL
PG_DIR="/home/runner/.pg"
PGDATA="$PG_DIR/data"
PGLOG="$PG_DIR/logs/postgresql.log"

# Создаем директории
mkdir -p "$PG_DIR/data"
mkdir -p "$PG_DIR/logs"

if [ "$pg_running" -gt 0 ]; then
  echo "PostgreSQL уже запущен"
else
  echo "PostgreSQL не запущен. Проверяем наличие данных..."
  
  # Проверяем, инициализирована ли PostgreSQL
  if [ -f "$PGDATA/PG_VERSION" ]; then
    echo "PostgreSQL уже инициализирован, запускаем сервер..."
  else
    echo "Инициализируем PostgreSQL..."
    initdb -D "$PGDATA" -U runner
    
    # Настраиваем PostgreSQL для работы с localhost
    echo "Настраиваем PostgreSQL..."
    echo "listen_addresses = '*'" >> "$PGDATA/postgresql.conf"
    echo "port = 5432" >> "$PGDATA/postgresql.conf"
    
    # Разрешаем соединения без пароля с localhost
    echo "host all all 127.0.0.1/32 trust" > "$PGDATA/pg_hba.conf"
    echo "host all all ::1/128 trust" >> "$PGDATA/pg_hba.conf"
    echo "local all all trust" >> "$PGDATA/pg_hba.conf"
    
    echo "PostgreSQL инициализирован"
  fi
  
  # Запускаем PostgreSQL
  echo "Запускаем PostgreSQL..."
  pg_ctl -D "$PGDATA" -l "$PGLOG" start
fi

# Проверяем, успешно ли запущен PostgreSQL
sleep 2
pg_running=$(ps aux | grep postgres | grep -v grep | wc -l)

if [ "$pg_running" -gt 0 ]; then
  echo "✅ PostgreSQL успешно запущен"
  
  # Создаем базу данных, если она не существует
  if ! psql -U runner -lqt | cut -d \| -f 1 | grep -qw postgres; then
    echo "Создаем базу данных postgres..."
    createdb -U runner postgres
  fi
  
  # Устанавливаем переменные окружения
  export DATABASE_URL="postgresql://runner@localhost:5432/postgres"
  export PGHOST="localhost"
  export PGUSER="runner"
  export PGPASSWORD=""
  export PGDATABASE="postgres"
  export PGPORT="5432"
  
  echo "Настройка завершена"
  echo "Для подключения используйте: psql -U runner postgres"
else
  echo "❌ Не удалось запустить PostgreSQL"
  echo "Проверьте логи: $PGLOG"
fi