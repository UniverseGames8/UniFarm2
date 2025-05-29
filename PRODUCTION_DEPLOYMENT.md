# Руководство по деплою UniFarm в Production через Replit

## Важно: Production URL и Telegram Mini App

Приложение UniFarm должно быть доступно по основному URL:
- **Main URL**: https://uni-farm-connect-2-misterxuniverse.replit.app
- **Mini App URL**: https://uni-farm-connect-2-misterxuniverse.replit.app/UniFarm

Мы обновили обработку статических файлов для корректной работы в production-режиме. Теперь маршруты `/UniFarm`, `/app`, `/telegram` и `/telegram-app` должны работать корректно.

## Пошаговая инструкция по деплою в Production

### Шаг 1: Подготовка production-билда
```bash
# Остановите все текущие процессы
pkill -f "node " || true
pkill -f "tsx " || true

# Создайте production-билд
npm run build
```

### Шаг 2: Настройка деплоя через Replit интерфейс

1. Нажмите кнопку **Deploy** в правом верхнем углу интерфейса Replit
2. Выберите **"Configure"** и убедитесь, что настройки соответствуют:
   - **Run Command**: `NODE_ENV=production node dist/index.js` 
   - **Always On**: Включено
   - **Autoscale**: Включено
   - **Domain**: uni-farm-connect-2-misterxuniverse.replit.app

**Важно**: Используйте именно `NODE_ENV=production node dist/index.js` в качестве Run Command. Это запустит приложение напрямую из скомпилированного production-кода, обеспечивая стабильность и высокую производительность.

### Шаг 3: Запустите деплой
Нажмите кнопку **Deploy** для запуска процесса деплоя.

### Шаг 4: Проверка деплоя
После успешного деплоя:
1. Проверьте доступность основного сайта: https://uni-farm-connect-2-misterxuniverse.replit.app
2. Проверьте доступность Mini App: https://uni-farm-connect-2-misterxuniverse.replit.app/UniFarm
3. Проверьте другие маршруты Mini App: `/app`, `/telegram`, `/telegram-app`
4. Выполните тестовые API-запросы с помощью скрипта:
   ```bash
   node test-production-api.mjs
   ```

## Проверка настроек URL

Вы можете использовать специальный скрипт для проверки соответствия URL в Telegram-боте:

```bash
node check-production-url.mjs
```

## Устранение проблем 500 ошибок

Если после деплоя вы всё ещё видите 500 ошибки на маршрутах `/UniFarm`, `/app`, `/telegram`, попробуйте:

1. Убедитесь, что используется правильная команда запуска в Replit Deploy:
   ```
   NODE_ENV=production node dist/index.js
   ```
   
2. Убедитесь, что проект успешно собран:
   ```bash
   npm run build
   ```
   
3. Проверьте наличие всех необходимых файлов:
   ```bash
   ls -la dist/
   ls -la dist/public/
   ```
   
4. Перезапустите деплой через интерфейс Replit

## Перезапуск production-деплоя

Если необходимо перезапустить деплой:
1. Зайдите в раздел **Deployments** в Replit
2. Найдите текущий активный деплой
3. Нажмите на три точки справа и выберите **Restart**

## Проверка webhook для Telegram бота

После деплоя убедитесь, что webhook Telegram бота указывает на правильный URL:
```bash
node setup-telegram-webhook.js
```

## Обновление настроек Mini App

После успешного деплоя обновите кнопки и команды Telegram бота:
```bash
node setup-telegram-mini-app.js
```

## Полный цикл обновления и деплоя

Для полного обновления приложения и деплоя в production:
```bash
# Остановите все процессы
pkill -f "node " || true
pkill -f "tsx " || true

# Соберите приложение
npm run build

# Выполните deploy через интерфейс Replit
# Используйте настройки из Шага 2 (NODE_ENV=production node dist/index.js)

# После деплоя обновите настройки бота
node setup-telegram-webhook.js
node setup-telegram-mini-app.js

# Проверьте работу API
node test-production-api.mjs
```

## Проверка статуса бота и Mini App

После деплоя проверьте корректность настроек:
```bash
node check-bot-settings.js
```