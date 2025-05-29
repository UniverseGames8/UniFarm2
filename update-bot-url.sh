#!/bin/bash

# Скрипт для обновления URL Telegram бота после деплоя
# Используется для обновления кнопки меню и webhook URL

# Получаем текущий URL из Replit
REPLIT_URL=$(curl -s https://api.replit.com/v0/deployments/current | grep -o '"url":"[^"]*"' | cut -d'"' -f4)

if [ -z "$REPLIT_URL" ]; then
  echo "❌ Не удалось получить URL текущего развертывания из API Replit"
  exit 1
fi

echo "✅ Получен URL текущего развертывания: $REPLIT_URL"

# Проверяем наличие токена бота в переменных окружения
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
  echo "❌ Токен бота не найден в переменных окружения"
  echo "Установите переменную окружения TELEGRAM_BOT_TOKEN"
  exit 1
fi

echo "✅ Токен бота найден в переменных окружения"

# Обновляем кнопку меню бота
echo "🔄 Обновляем кнопку меню бота..."
RESPONSE=$(curl -s -X POST \
  https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setMenuButton \
  -H "Content-Type: application/json" \
  -d "{
    \"menu_button\": {
      \"type\": \"web_app\",
      \"text\": \"Открыть UniFarm\",
      \"web_app\": {
        \"url\": \"$REPLIT_URL\"
      }
    }
  }")

if echo "$RESPONSE" | grep -q '"ok":true'; then
  echo "✅ Кнопка меню бота успешно обновлена"
else
  echo "❌ Ошибка при обновлении кнопки меню бота:"
  echo "$RESPONSE"
fi

# Устанавливаем webhook для бота
echo "🔄 Устанавливаем webhook для бота..."
WEBHOOK_URL="$REPLIT_URL/api/telegram-webhook"
RESPONSE=$(curl -s -X POST \
  https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"$WEBHOOK_URL\",
    \"drop_pending_updates\": true
  }")

if echo "$RESPONSE" | grep -q '"ok":true'; then
  echo "✅ Webhook успешно установлен: $WEBHOOK_URL"
else
  echo "❌ Ошибка при установке webhook:"
  echo "$RESPONSE"
fi

# Получаем информацию о текущем webhook
echo "🔍 Проверяем информацию о webhook..."
RESPONSE=$(curl -s -X GET \
  https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo)

echo "📋 Информация о webhook:"
echo "$RESPONSE" | grep -o '"url":"[^"]*"' | cut -d'"' -f4

echo "✅ Настройка бота завершена"