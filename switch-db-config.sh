#!/bin/bash

# Скрипт для переключения между конфигурациями баз данных
# Использование: ./switch-db-config.sh replit|neon

# Цвета для более читаемого вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

if [ "$1" != "replit" ] && [ "$1" != "neon" ]; then
  echo -e "${RED}Ошибка: Укажите тип базы данных (replit или neon)${NC}"
  echo -e "Использование: ${YELLOW}./switch-db-config.sh replit|neon${NC}"
  exit 1
fi

DB_TYPE=$1

echo -e "${BLUE}===============================================${NC}"
echo -e "${GREEN}🔄 ПЕРЕКЛЮЧЕНИЕ НА ${DB_TYPE^^} DB${NC}"
echo -e "${BLUE}===============================================${NC}"

# Проверяем наличие необходимых файлов
if [ "$DB_TYPE" == "neon" ] && [ ! -f ".env.neon" ]; then
  echo -e "${RED}❌ Ошибка: Файл .env.neon не найден!${NC}"
  echo -e "${YELLOW}Создайте файл .env.neon с настройками подключения к Neon DB${NC}"
  exit 1
fi

if [ "$DB_TYPE" == "neon" ] && [ ! -f ".replit.neon" ]; then
  echo -e "${RED}❌ Ошибка: Файл .replit.neon не найден!${NC}"
  exit 1
fi

if [ "$DB_TYPE" == "replit" ] && [ ! -f ".replit" ]; then
  echo -e "${RED}❌ Ошибка: Файл .replit не найден!${NC}"
  exit 1
fi

if [ "$DB_TYPE" == "replit" ] && [ ! -f ".env.replit" ]; then
  echo -e "${YELLOW}⚠️ Предупреждение: Файл .env.replit не найден, будут использованы переменные окружения по умолчанию${NC}"
fi

# Копируем конфигурацию
if [ "$DB_TYPE" == "neon" ]; then
  echo -e "${BLUE}📝 Копирование конфигурации Neon DB...${NC}"
  cp .replit.neon .replit
  echo -e "${GREEN}✅ Конфигурация Neon DB активирована${NC}"
  
  echo -e "${BLUE}📝 Проверка переменных окружения...${NC}"
  if grep -q "DATABASE_URL" .env.neon; then
    echo -e "${GREEN}✅ Переменная DATABASE_URL найдена в .env.neon${NC}"
  else
    echo -e "${RED}❌ Ошибка: Переменная DATABASE_URL не найдена в .env.neon!${NC}"
    echo -e "${YELLOW}Добавьте DATABASE_URL=postgresql://username:password@host:port/dbname?sslmode=require в .env.neon${NC}"
    exit 1
  fi
else
  echo -e "${BLUE}📝 Копирование конфигурации Replit PostgreSQL...${NC}"
  # Сохраняем оригинальную конфигурацию .replit (если она от neon)
  if grep -q "FORCE_NEON_DB" .replit; then
    mv .replit .replit.neon.backup
  fi
  
  # Используем стандартную конфигурацию или восстанавливаем из бэкапа
  if [ -f ".replit.original" ]; then
    cp .replit.original .replit
  elif [ -f ".replit.backup" ]; then
    cp .replit.backup .replit
  fi
  
  echo -e "${GREEN}✅ Конфигурация Replit PostgreSQL активирована${NC}"
fi

echo -e "${BLUE}===============================================${NC}"
echo -e "${GREEN}✅ ПЕРЕКЛЮЧЕНИЕ ЗАВЕРШЕНО${NC}"
echo -e "${BLUE}===============================================${NC}"

echo -e "${YELLOW}Перезапустите Replit для применения изменений${NC}"
if [ "$DB_TYPE" == "neon" ]; then
  echo -e "${YELLOW}Чтобы запустить приложение с Neon DB, выполните:${NC}"
  echo -e "${BLUE}   ./start-with-neon.sh${NC}"
fi