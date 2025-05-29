#!/bin/bash
#
# Скрипт запуска сервера для workflow Replit
# Обеспечивает постоянную работу сервера с автоматическим перезапуском

echo "========================================================================="
echo "  ЗАПУСК UNIFARM С АВТОМАТИЧЕСКИМ ПЕРЕЗАПУСКОМ"
echo "========================================================================="
echo "Дата запуска: $(date -u)"
echo "========================================================================="

# Экспортируем переменные окружения
export NODE_ENV=production
export PORT=3000
export DATABASE_PROVIDER=neon
export FORCE_NEON_DB=true
export DISABLE_REPLIT_DB=true
export OVERRIDE_DB_PROVIDER=neon
export SKIP_PARTITION_CREATION=true
export IGNORE_PARTITION_ERRORS=true

# Функция запуска сервера с мониторингом
start_server() {
  while true; do
    echo "[$(date -u)] Запуск сервера UniFarm..."
    node start-unified.js
    EXIT_CODE=$?
    
    echo "[$(date -u)] Сервер завершил работу с кодом: $EXIT_CODE"
    
    if [ $EXIT_CODE -eq 0 ]; then
      echo "[$(date -u)] Сервер завершился штатно. Перезапуск..."
    else
      echo "[$(date -u)] Сервер завершился с ошибкой. Перезапуск..."
    fi
    
    echo "[$(date -u)] Ожидание 3 секунды перед перезапуском..."
    sleep 3
  done
}

# Запускаем сервер
start_server