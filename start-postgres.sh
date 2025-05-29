#!/bin/bash

# Цвета для логов
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Директория для сокетов
SOCKET_DIR="$HOME/.postgresql/sockets"

# Проверяем, запущен ли уже PostgreSQL
is_postgres_running() {
  pg_isready -h $SOCKET_DIR > /dev/null 2>&1
  return $?
}

# Функция для проверки соединения с PostgreSQL
test_postgres_connection() {
  # Пытаемся выполнить запрос к PostgreSQL
  PGPASSWORD="$PGPASSWORD" psql -h "$SOCKET_DIR" -U "$PGUSER" -d "$PGDATABASE" -c "SELECT 1" >/dev/null 2>&1
  return $?
}

# Функция для экспорта переменных окружения PostgreSQL
setup_postgres_env() {
  # Экспортируем переменные окружения для удобства
  export PGDATABASE="postgres"
  export PGPORT="5432"
  export PGHOST="$SOCKET_DIR"
  export PGUSER="runner"
  export PGPASSWORD=""
  export DATABASE_URL="postgresql://$PGUSER@$SOCKET_DIR:$PGPORT/$PGDATABASE"
  
  echo -e "${BLUE}Переменные окружения PostgreSQL настроены:${NC}"
  echo -e "  PGDATABASE: $PGDATABASE"
  echo -e "  PGPORT: $PGPORT"
  echo -e "  PGHOST: $PGHOST"
  echo -e "  PGUSER: $PGUSER"
  echo -e "  DATABASE_URL: $DATABASE_URL"
  
  # Создаем или обновляем файл с переменными окружения
  cat > .env.replit <<EOF
PGDATABASE=$PGDATABASE
PGPORT=$PGPORT
PGHOST=$PGHOST
PGUSER=$PGUSER
PGPASSWORD=$PGPASSWORD
DATABASE_URL=$DATABASE_URL
DATABASE_PROVIDER=replit
USE_LOCAL_DB_ONLY=true
EOF

  echo -e "${GREEN}Файл .env.replit обновлен с актуальными настройками PostgreSQL${NC}"
}

# Функция для создания директории сокетов
create_socket_dir() {
  if [ ! -d "$SOCKET_DIR" ]; then
    echo -e "${YELLOW}Создание директории для сокетов PostgreSQL: $SOCKET_DIR${NC}"
    mkdir -p "$SOCKET_DIR"
  else
    echo -e "${BLUE}Директория для сокетов уже существует: $SOCKET_DIR${NC}"
  fi
}

# Главная функция
main() {
  echo -e "${CYAN}Запуск и настройка PostgreSQL для UniFarm...${NC}"
  
  # Создаем директорию для сокетов
  create_socket_dir
  
  # Настраиваем переменные окружения
  setup_postgres_env
  
  # Если PostgreSQL уже запущен, просто выходим
  if is_postgres_running; then
    echo -e "${GREEN}PostgreSQL уже запущен${NC}"
  else
    echo -e "${YELLOW}Запуск PostgreSQL...${NC}"
    
    # Если переменные не установлены, устанавливаем их стандартные значения
    if [ -z "$PGUSER" ]; then
      export PGUSER="runner"
    fi
    
    if [ -z "$PGDATABASE" ]; then
      export PGDATABASE="postgres"
    fi
    
    # Запускаем PostgreSQL с явным указанием директории для сокетов
    pg_ctl -D ~/.postgresql -o "-k $SOCKET_DIR" -l ~/.postgresql/logfile start
    
    # Ждем запуска PostgreSQL
    for i in {1..30}; do
      if is_postgres_running; then
        echo -e "${GREEN}PostgreSQL запущен успешно!${NC}"
        break
      fi
      echo -e "${YELLOW}Ожидание запуска PostgreSQL (попытка $i/30)...${NC}"
      sleep 1
    done
    
    # Проверяем, запустился ли PostgreSQL
    if ! is_postgres_running; then
      echo -e "${RED}Не удалось запустить PostgreSQL после 30 попыток.${NC}"
      echo -e "${RED}Проверьте логи в ~/.postgresql/logfile${NC}"
      exit 1
    fi
  fi
  
  # Проверяем соединение
  if test_postgres_connection; then
    echo -e "${GREEN}Соединение с PostgreSQL успешно установлено${NC}"
  else
    echo -e "${RED}Не удалось подключиться к PostgreSQL! Проверьте настройки и права доступа.${NC}"
    exit 1
  fi
  
  echo -e "${GREEN}PostgreSQL готов к работе${NC}"
}

# Запускаем главную функцию
main