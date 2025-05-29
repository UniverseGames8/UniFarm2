#!/bin/bash

# Настройка Telegram бота для использования в качестве Mini App
# Этот скрипт будет:
# 1. Проверять токен бота
# 2. Настраивать команды бота
# 3. Настраивать меню бота
# 4. Создавать Mini App через BotFather
# 5. Настраивать webhook для приема сообщений

# Цвета для вывода
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Получаем токен бота из переменных окружения
BOT_TOKEN="$TELEGRAM_BOT_TOKEN"

if [ -z "$BOT_TOKEN" ]; then
  echo -e "${RED}Ошибка: Переменная окружения TELEGRAM_BOT_TOKEN не установлена${NC}"
  exit 1
fi

# Базовый URL Telegram API
API_URL="https://api.telegram.org/bot$BOT_TOKEN"

# URL нашего приложения
APP_URL="https://uni-farm-connect-2-misterxuniverse.replit.app"

# Получение информации о боте
echo -e "${BLUE}Получение информации о боте...${NC}"
BOT_INFO=$(curl -s -X GET "$API_URL/getMe")
BOT_USERNAME=$(echo $BOT_INFO | grep -o '"username":"[^"]*"' | cut -d'"' -f4)
BOT_ID=$(echo $BOT_INFO | grep -o '"id":[0-9]*' | cut -d':' -f2)

if [ -z "$BOT_USERNAME" ]; then
  echo -e "${RED}Ошибка: Не удалось получить информацию о боте. Проверьте токен.${NC}"
  echo "$BOT_INFO"
  exit 1
fi

echo -e "${GREEN}Бот @$BOT_USERNAME (ID: $BOT_ID) найден.${NC}"

# Очистка существующих команд
echo -e "${BLUE}Очистка существующих команд бота...${NC}"
CLEAR_COMMANDS=$(curl -s -X POST "$API_URL/deleteMyCommands")

# Настройка основных команд бота
echo -e "${BLUE}Настройка команд бота...${NC}"
COMMANDS='
{
  "commands": [
    {"command": "start", "description": "Запустить бота и получить приветственное сообщение"},
    {"command": "app", "description": "Открыть Mini App для фарминга и заработка"},
    {"command": "refcode", "description": "Получить ваш реферальный код"},
    {"command": "info", "description": "Информация о вашем аккаунте"},
    {"command": "ping", "description": "Проверка соединения с ботом"}
  ]
}'

SET_COMMANDS=$(curl -s -X POST "$API_URL/setMyCommands" \
  -H "Content-Type: application/json" \
  -d "$COMMANDS")

echo -e "${GREEN}Команды настроены: $SET_COMMANDS${NC}"

# Настройка меню бота
echo -e "${BLUE}Настройка меню бота...${NC}"
MENU='
{
  "menu_button": {
    "type": "web_app",
    "text": "Запустить UniFarm",
    "web_app": {
      "url": "'$APP_URL'"
    }
  }
}'

SET_MENU=$(curl -s -X POST "$API_URL/setChatMenuButton" \
  -H "Content-Type: application/json" \
  -d "$MENU")

echo -e "${GREEN}Меню настроено: $SET_MENU${NC}"

# Настройка webhook для приема сообщений от Telegram
echo -e "${BLUE}Настройка webhook для приема сообщений...${NC}"
WEBHOOK_URL="$APP_URL/api/telegram/webhook"

SET_WEBHOOK=$(curl -s -X POST "$API_URL/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "'$WEBHOOK_URL'",
    "allowed_updates": ["message", "callback_query"],
    "drop_pending_updates": true
  }')

echo -e "${GREEN}Webhook настроен: $SET_WEBHOOK${NC}"

# Проверка webhook
echo -e "${BLUE}Проверка настроек webhook...${NC}"
WEBHOOK_INFO=$(curl -s -X GET "$API_URL/getWebhookInfo")
echo -e "${GREEN}Информация о webhook: $WEBHOOK_INFO${NC}"

# Настройка имени приложения для команды /app
echo -e "${BLUE}Настройка команды /app для открытия Mini App...${NC}"
# Это делается через сообщение с кнопкой для команды /app

# Успешное завершение
echo -e "${GREEN}Настройка бота @$BOT_USERNAME завершена успешно!${NC}"
echo -e "${YELLOW}Важно:${NC} Если вы хотите создать новое Mini App или изменить настройки через BotFather, выполните следующие шаги вручную:"
echo -e "1. Откройте BotFather: https://t.me/BotFather"
echo -e "2. Отправьте команду /mybots и выберите @$BOT_USERNAME"
echo -e "3. Выберите 'Bot Settings' > 'Menu Button' для настройки меню"
echo -e "4. Выберите 'Menu Button' > 'Configure menu button' для установки кнопки веб-приложения"
echo -e "5. Укажите текст кнопки (например, 'Запустить UniFarm') и URL Mini App: $APP_URL"
echo -e "6. Для настройки Mini App выберите 'Bot Settings' > 'Mini Apps' > 'Create new Mini App'"
echo -e "7. Следуйте инструкциям и укажите URL приложения: $APP_URL"