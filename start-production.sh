#!/bin/bash

# Запуск UniFarm в production режиме
# Этот скрипт обеспечивает правильную настройку для запуска в рабочем режиме

echo "🚀 Запуск UniFarm Telegram Mini App в production режиме..."

# Устанавливаем переменные окружения
export NODE_ENV=production

# Проверяем наличие собранных файлов
if [ ! -d "dist" ] || [ ! -f "dist/index.js" ]; then
  echo "⚠️ Сборка не найдена. Запускаем сборку проекта..."
  npm run build
  
  if [ $? -ne 0 ]; then
    echo "❌ Ошибка при сборке проекта. Пожалуйста, исправьте ошибки и попробуйте снова."
    exit 1
  fi
fi

# Проверяем настройки Telegram бота
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
  echo "⚠️ ВНИМАНИЕ: переменная TELEGRAM_BOT_TOKEN не установлена!"
  echo "Функциональность Telegram Bot будет ограничена."
fi

# Определяем порт для запуска
PORT=5000

echo "📡 Запуск сервера на порту $PORT..."
# Запуск Node.js приложения в production режиме
PORT=$PORT node dist/index.js