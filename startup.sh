#!/bin/bash

# Скрипт для постійного запуску UniFarm в режимі memory storage
echo "====================================="
echo "  ЗАПУСК UNIFARM - TELEGRAM MINI APP"
echo "====================================="
echo "Час запуску: $(date)"

# Встановлюємо змінні оточення для роботи з пам'яттю
export FORCE_MEMORY_STORAGE="true"
export ALLOW_MEMORY_FALLBACK="true"
export USE_MEMORY_SESSION="true"
export IGNORE_DB_CONNECTION_ERRORS="true"
export DATABASE_PROVIDER="memory"
export SKIP_PARTITION_CREATION="true"
export IGNORE_PARTITION_ERRORS="true"
export SKIP_TELEGRAM_CHECK="true"
export ALLOW_BROWSER_ACCESS="true"
export NODE_ENV="production"

# Функція для запуску сервера
function start_server() {
  echo "Запуск сервера..."
  node run-memory-mode.mjs
}

# Функція для перевірки стану сервера
function check_server() {
  if ! pgrep -f "run-memory-mode.mjs" > /dev/null; then
    echo "Сервер не працює. Перезапуск..."
    start_server
  else
    echo "Сервер працює нормально."
  fi
}

# Запускаємо сервер вперше
start_server

# Налаштовуємо перевірку кожні 30 секунд
while true; do
  sleep 30
  check_server
done