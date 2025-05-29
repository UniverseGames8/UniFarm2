#!/bin/bash

# Скрипт для удобного переключения между базами данных Neon DB и Replit PostgreSQL
# Автор: AI Developer
# Дата: 14.05.2025

# Цвета для вывода
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Функция для печати с цветом
print_color() {
  echo -e "${2}${1}${NC}"
}

# Функция для печати заголовка
print_header() {
  echo -e "\n${BOLD}${CYAN}****** $1 ******${NC}\n"
}

# Функция для проверки подключения к Neon DB
check_neon_connection() {
  print_color "🔍 Проверка подключения к Neon DB..." "$BLUE"
  
  if [ ! -f ".env.neon" ]; then
    print_color "❌ Файл .env.neon не найден! Необходимо создать этот файл с настройками подключения к Neon DB." "$RED"
    return 1
  fi
  
  # Загружаем переменные из .env.neon
  source .env.neon
  
  if [ -z "$DATABASE_URL" ]; then
    print_color "❌ В файле .env.neon не найдена переменная DATABASE_URL!" "$RED"
    return 1
  fi
  
  # Проверяем подключение с помощью нашего скрипта
  node check-neon-db.cjs > /dev/null 2>&1
  
  if [ $? -eq 0 ]; then
    print_color "✅ Подключение к Neon DB успешно установлено!" "$GREEN"
    return 0
  else
    print_color "❌ Не удалось подключиться к Neon DB!" "$RED"
    return 1
  fi
}

# Функция для проверки подключения к Replit PostgreSQL
check_replit_connection() {
  print_color "🔍 Проверка подключения к Replit PostgreSQL..." "$BLUE"
  
  if [ -z "$PGHOST" ] || [ -z "$PGUSER" ] || [ -z "$PGDATABASE" ]; then
    print_color "❌ Переменные окружения Replit PostgreSQL не установлены!" "$RED"
    return 1
  fi
  
  # Простой запрос для проверки подключения
  psql -c "SELECT 1" > /dev/null 2>&1
  
  if [ $? -eq 0 ]; then
    print_color "✅ Подключение к Replit PostgreSQL успешно установлено!" "$GREEN"
    return 0
  else
    print_color "❌ Не удалось подключиться к Replit PostgreSQL!" "$RED"
    return 1
  fi
}

# Функция для переключения на Neon DB
switch_to_neon() {
  print_header "Переключение на Neon DB"
  
  # Проверяем подключение
  check_neon_connection
  if [ $? -ne 0 ]; then
    print_color "⚠️ Переключение на Neon DB не выполнено из-за проблем с подключением." "$YELLOW"
    return 1
  fi
  
  # Создаем .env с настройками для Neon DB
  print_color "📝 Создание .env с настройками для Neon DB..." "$BLUE"
  cat > .env << EOF
# Настройки базы данных
DATABASE_PROVIDER=neon
FORCE_NEON_DB=true
DISABLE_REPLIT_DB=true
OVERRIDE_DB_PROVIDER=neon
USE_LOCAL_DB_ONLY=false
NODE_ENV=production

# Настройки из .env.neon
$(cat .env.neon)
EOF
  
  print_color "✅ Создан файл .env с настройками для Neon DB!" "$GREEN"
  print_color "🚀 Система настроена на использование Neon DB" "$GREEN"
  print_color "ℹ️ Для применения изменений перезапустите приложение:" "$CYAN"
  print_color "   npm run dev" "$CYAN"
}

# Функция для переключения на Replit PostgreSQL
switch_to_replit() {
  print_header "Переключение на Replit PostgreSQL"
  
  # Проверяем подключение
  check_replit_connection
  if [ $? -ne 0 ]; then
    print_color "⚠️ Переключение на Replit PostgreSQL не выполнено из-за проблем с подключением." "$YELLOW"
    return 1
  fi
  
  # Создаем .env с настройками для Replit PostgreSQL
  print_color "📝 Создание .env с настройками для Replit PostgreSQL..." "$BLUE"
  cat > .env << EOF
# Настройки базы данных
DATABASE_PROVIDER=replit
FORCE_NEON_DB=false
DISABLE_REPLIT_DB=false
OVERRIDE_DB_PROVIDER=replit
USE_LOCAL_DB_ONLY=true
NODE_ENV=development

# Настройки Replit PostgreSQL уже доступны из системного окружения
EOF
  
  print_color "✅ Создан файл .env с настройками для Replit PostgreSQL!" "$GREEN"
  print_color "🚀 Система настроена на использование Replit PostgreSQL" "$GREEN"
  print_color "ℹ️ Для применения изменений перезапустите приложение:" "$CYAN"
  print_color "   npm run dev" "$CYAN"
}

# Функция для просмотра текущих настроек
show_current_settings() {
  print_header "Текущие настройки базы данных"
  
  # Проверяем настройки в .env
  if [ -f ".env" ]; then
    print_color "📋 Содержимое файла .env:" "$BLUE"
    grep -E "DATABASE_PROVIDER|FORCE_NEON_DB|DISABLE_REPLIT_DB|USE_LOCAL_DB_ONLY|NODE_ENV" .env
  else
    print_color "❌ Файл .env не найден!" "$RED"
  fi
  
  # Проверяем текущие переменные окружения
  print_color "\n📊 Текущие переменные окружения:" "$BLUE"
  echo "DATABASE_PROVIDER=$DATABASE_PROVIDER"
  echo "FORCE_NEON_DB=$FORCE_NEON_DB"
  echo "DISABLE_REPLIT_DB=$DISABLE_REPLIT_DB"
  echo "USE_LOCAL_DB_ONLY=$USE_LOCAL_DB_ONLY"
  echo "NODE_ENV=$NODE_ENV"
  
  # Проверяем, какая БД сейчас используется
  print_color "\n🔍 Проверка активных подключений:" "$BLUE"
  
  if [ "$FORCE_NEON_DB" = "true" ] || [ "$DATABASE_PROVIDER" = "neon" ] && [ "$USE_LOCAL_DB_ONLY" != "true" ]; then
    print_color "🌟 Текущая настройка: используется Neon DB" "$GREEN"
    check_neon_connection
  elif [ "$USE_LOCAL_DB_ONLY" = "true" ] || [ "$DATABASE_PROVIDER" = "replit" ]; then
    print_color "🌟 Текущая настройка: используется Replit PostgreSQL" "$GREEN"
    check_replit_connection
  else
    print_color "❓ Невозможно определить используемую базу данных. Проверьте настройки." "$YELLOW"
  fi
}

# Главное меню
show_menu() {
  print_header "Инструмент переключения базы данных"
  echo "1) Переключиться на Neon DB (production)"
  echo "2) Переключиться на Replit PostgreSQL (development)"
  echo "3) Показать текущие настройки"
  echo "4) Проверить подключение к Neon DB"
  echo "5) Проверить подключение к Replit PostgreSQL"
  echo "0) Выйти"
  echo
  read -p "Выберите действие (0-5): " choice
  
  case $choice in
    1)
      switch_to_neon
      ;;
    2)
      switch_to_replit
      ;;
    3)
      show_current_settings
      ;;
    4)
      node check-neon-db.cjs
      ;;
    5)
      check_replit_connection
      ;;
    0)
      print_color "👋 До свидания!" "$CYAN"
      exit 0
      ;;
    *)
      print_color "❌ Неверный выбор. Пожалуйста, выберите действие от 0 до 5." "$RED"
      ;;
  esac
  
  echo
  read -p "Нажмите Enter для продолжения..."
  show_menu
}

# Проверка аргументов командной строки
if [ "$1" = "neon" ]; then
  switch_to_neon
elif [ "$1" = "replit" ]; then
  switch_to_replit
elif [ "$1" = "status" ]; then
  show_current_settings
else
  show_menu
fi