#!/bin/bash

# Полный скрипт деплоя для UniFarm Telegram Mini App
# Copyright © 2025 UniFarm

echo "🚀 Starting FULL PRODUCTION DEPLOYMENT process for UniFarm Telegram Mini App..."

# Устанавливаем переменные окружения для production
export NODE_ENV=production

# Сохраняем текущую директорию
CURRENT_DIR=$(pwd)

echo "📦 Step 1: Installing dependencies..."
npm ci || npm install

echo "🧹 Step 2: Cleaning previous build..."
rm -rf dist
mkdir -p dist/public

echo "🔨 Step 3: Building client and server..."
# Сборка клиента и сервера
npm run build

echo "🔍 Step 4: Verifying build artifacts..."
# Проверка наличия необходимых файлов
if [ ! -f "dist/index.js" ]; then
  echo "❌ ERROR: Server build failed. dist/index.js not found!"
  exit 1
fi

if [ ! -f "dist/public/index.html" ]; then
  echo "❌ ERROR: Client build failed. dist/public/index.html not found!"
  exit 1
fi

echo "✅ Build verification passed."

echo "🌐 Step 5: Setting up Telegram Mini App..."
# Делаем скрипт исполняемым, если он не был таковым
chmod +x setup-telegram-mini-app.js
# Запускаем настройку Telegram Mini App
node setup-telegram-mini-app.js

echo "🤖 Step 6: Setting up Telegram Bot commands..."
# Делаем скрипт исполняемым, если он не был таковым
chmod +x setup-telegram-bot-commands.js
# Запускаем настройку команд бота
node setup-telegram-bot-commands.js

echo "📡 Step 7: Setting up Telegram Webhook..."
# Делаем скрипт исполняемым, если он не был таковым
chmod +x setup-telegram-webhook.js
# Запускаем настройку webhook
node setup-telegram-webhook.js

echo "🔐 Step 8: Checking secrets and environment variables..."
# Проверяем наличие необходимых переменных окружения
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
  echo "⚠️ WARNING: TELEGRAM_BOT_TOKEN is not set. Telegram Bot functionality will be limited."
  echo "Set it with: export TELEGRAM_BOT_TOKEN=your_bot_token"
fi

if [ -z "$DATABASE_URL" ]; then
  echo "⚠️ WARNING: DATABASE_URL is not set. Database functionality will be limited."
fi

echo "🚀 Step 9: Making production start script executable..."
chmod +x start-production.sh

echo "✅ DEPLOYMENT COMPLETE! You can now run the application with:"
echo "./start-production.sh"
echo ""
echo "Or use the Replit 'Run' button to start the application."
echo ""
echo "📱 Your Telegram Mini App is available at:"
echo "https://t.me/UniFarming_Bot/UniFarm"