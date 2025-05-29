#!/bin/bash

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Создание и настройка PostgreSQL базы данных ===${NC}"

# Проверяем, установлен ли PostgreSQL
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}PostgreSQL не установлен. Устанавливаем...${NC}"
    echo -e "${YELLOW}Эта операция может занять несколько минут${NC}"
    nix-env -iA nixpkgs.postgresql
    if [ $? -ne 0 ]; then
        echo -e "${RED}Ошибка установки PostgreSQL${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}PostgreSQL уже установлен${NC}"
fi

# Создаем директорию для базы данных
DATA_DIR="$HOME/.postgres"
mkdir -p "$DATA_DIR"

echo -e "${BLUE}Проверка существующего экземпляра PostgreSQL...${NC}"

# Проверяем, запущен ли уже PostgreSQL
PG_PID=$(pgrep -f "postgres.*-D $DATA_DIR")
if [ -n "$PG_PID" ]; then
    echo -e "${GREEN}PostgreSQL уже запущен с PID $PG_PID${NC}"
else
    echo -e "${YELLOW}PostgreSQL не запущен. Инициализируем базу данных...${NC}"
    
    # Проверяем, инициализирована ли база данных
    if [ ! -f "$DATA_DIR/PG_VERSION" ]; then
        echo -e "${YELLOW}Инициализация базы данных PostgreSQL...${NC}"
        pg_ctl init -D "$DATA_DIR"
        if [ $? -ne 0 ]; then
            echo -e "${RED}Ошибка инициализации PostgreSQL${NC}"
            exit 1
        fi
        
        # Настраиваем PostgreSQL для принятия локальных подключений
        sed -i "s/#listen_addresses = 'localhost'/listen_addresses = 'localhost'/g" "$DATA_DIR/postgresql.conf"
        echo "host    all             all             127.0.0.1/32            trust" > "$DATA_DIR/pg_hba.conf"
        echo "local   all             all                                     trust" >> "$DATA_DIR/pg_hba.conf"
    else
        echo -e "${GREEN}База данных уже инициализирована${NC}"
    fi
    
    # Запускаем PostgreSQL
    echo -e "${YELLOW}Запуск PostgreSQL...${NC}"
    pg_ctl -D "$DATA_DIR" -l "$DATA_DIR/logfile" start
    if [ $? -ne 0 ]; then
        echo -e "${RED}Ошибка запуска PostgreSQL${NC}"
        exit 1
    fi
    
    # Ждем, пока PostgreSQL запустится
    sleep 3
fi

# Проверяем, отвечает ли PostgreSQL
echo -e "${BLUE}Проверка соединения с PostgreSQL...${NC}"
if ! psql -h localhost -c "SELECT 1" postgres &> /dev/null; then
    echo -e "${RED}Не удается подключиться к PostgreSQL${NC}"
    exit 1
fi
echo -e "${GREEN}PostgreSQL успешно отвечает${NC}"

# Создаем пользователя и базу данных
DB_NAME="replit_db"
DB_USER="replit_user"

# Используем переменную окружения или генерируем случайный пароль
if [ -n "$DB_REPLIT_PASSWORD" ]; then
  DB_PASSWORD="$DB_REPLIT_PASSWORD"
  echo -e "${BLUE}Используем пароль из переменной окружения DB_REPLIT_PASSWORD${NC}"
else
  # Генерируем случайный надежный пароль
  DB_PASSWORD=$(openssl rand -base64 16)
  echo -e "${BLUE}Сгенерирован случайный пароль для базы данных${NC}"
fi

echo -e "${BLUE}Создание базы данных и пользователя...${NC}"

# Проверяем, существует ли уже база данных
if psql -h localhost -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    echo -e "${GREEN}База данных $DB_NAME уже существует${NC}"
else
    echo -e "${YELLOW}Создание базы данных $DB_NAME...${NC}"
    createdb -h localhost "$DB_NAME"
    if [ $? -ne 0 ]; then
        echo -e "${RED}Ошибка создания базы данных${NC}"
        exit 1
    fi
fi

# Проверяем, существует ли уже пользователь
if psql -h localhost -c "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" postgres | grep -q "1 row"; then
    echo -e "${GREEN}Пользователь $DB_USER уже существует${NC}"
else
    echo -e "${YELLOW}Создание пользователя $DB_USER...${NC}"
    psql -h localhost -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD'" postgres
    if [ $? -ne 0 ]; then
        echo -e "${RED}Ошибка создания пользователя${NC}"
        exit 1
    fi
fi

# Предоставляем права на базу данных
echo -e "${YELLOW}Предоставление прав пользователю $DB_USER...${NC}"
psql -h localhost -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER" postgres
if [ $? -ne 0 ]; then
    echo -e "${RED}Ошибка при предоставлении прав${NC}"
    exit 1
fi

# Проверяем возможность подключения с новым пользователем
echo -e "${BLUE}Проверка подключения с новым пользователем...${NC}"
if ! PGPASSWORD="$DB_PASSWORD" psql -h localhost -U "$DB_USER" -c "SELECT 1" "$DB_NAME" &> /dev/null; then
    echo -e "${RED}Не удается подключиться с новым пользователем${NC}"
    exit 1
fi
echo -e "${GREEN}Подключение с новым пользователем успешно${NC}"

# Генерируем строку подключения
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME"

# Создаем файл с переменными окружения
ENV_FILE=".env.replit-db"
echo "# Настройки подключения к PostgreSQL на Replit" > "$ENV_FILE"
echo "PGHOST=localhost" >> "$ENV_FILE"
echo "PGPORT=5432" >> "$ENV_FILE"
echo "PGUSER=$DB_USER" >> "$ENV_FILE"
echo "PGPASSWORD=$DB_PASSWORD" >> "$ENV_FILE"
echo "PGDATABASE=$DB_NAME" >> "$ENV_FILE"
echo "DATABASE_URL=$DATABASE_URL" >> "$ENV_FILE"

echo -e "${GREEN}Настройки сохранены в файл $ENV_FILE${NC}"
echo -e "${GREEN}Для активации настроек выполните:${NC}"
echo -e "${BLUE}source $ENV_FILE${NC}"

echo -e "${GREEN}=== База данных PostgreSQL успешно настроена ===${NC}"
echo -e "${BLUE}DATABASE_URL=${NC} $DATABASE_URL"