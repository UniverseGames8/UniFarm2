#!/bin/bash

# Скрипт для запуска приложения с принудительным использованием Neon DB

# Устанавливаем переменные окружения
export DATABASE_PROVIDER=neon
export FORCE_NEON_DB=true
export DISABLE_REPLIT_DB=true
export OVERRIDE_DB_PROVIDER=neon
export NODE_ENV=production

echo "==============================================="
echo "🚀 Запуск UniFarm с принудительным использованием Neon DB"
echo "==============================================="
echo "📊 Настройки базы данных:"
echo "  DATABASE_PROVIDER: $DATABASE_PROVIDER"
echo "  FORCE_NEON_DB: $FORCE_NEON_DB"
echo "  DISABLE_REPLIT_DB: $DISABLE_REPLIT_DB"
echo "  NODE_ENV: $NODE_ENV"
echo "==============================================="

# Загружаем настройки из .env.neon
if [ -f .env.neon ]; then
  echo "✅ Загружаем настройки из .env.neon"
  source .env.neon
else
  echo "❌ Файл .env.neon не найден!"
  exit 1
fi

# Запускаем приложение
echo "🚀 Запуск приложения..."
node dist/index.js