#!/bin/bash
# Скрипт для быстрого перезапуска сервера в режиме разработки с переменными production
# С удобным выводом информации о статусе

echo "🚀 Перезапуск UniFarm в режиме разработки с настройками PRODUCTION..."
echo "🔧 NODE_ENV = production"

# Запуск в режиме production
node dev-production.cjs