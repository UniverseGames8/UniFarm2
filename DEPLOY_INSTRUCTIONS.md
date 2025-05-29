# Инструкция по настройке деплоя на Replit

Для решения проблемы с доступом к приложению через прямой URL (https://uni-farm-connect-2-osadchukdmitro2.replit.app/), следуйте этим инструкциям:

## Шаг 1: Подготовка к деплою

1. Откройте раздел "Deployment" в вашем проекте на Replit
2. Нажмите кнопку "Deploy"
3. В открывшихся настройках укажите:
   - Run command: `node server.js`
   - Build command: `npm run build`

## Шаг 2: Настройка переменных окружения

Добавьте следующие переменные окружения в разделе "Secrets" в настройках вашего проекта на Replit:

```
NODE_ENV=production
FORCE_NEON_DB=true
OVERRIDE_DB_PROVIDER=neon
DATABASE_PROVIDER=neon
SKIP_TELEGRAM_CHECK=true
ALLOW_BROWSER_ACCESS=true
```

Также убедитесь, что установлена переменная `DATABASE_URL` с корректным URL для подключения к базе данных.

## Шаг 3: Ручной деплой

1. В вашем проекте на Replit перейдите в "Shell"
2. Выполните следующие команды:
   ```
   npm run build
   node server.js
   ```

## Шаг 4: Проверка доступности

После запуска, приложение должно быть доступно по URL:
https://uni-farm-connect-2-osadchukdmitro2.replit.app/

Вы можете проверить, что сервер работает, посетив:
https://uni-farm-connect-2-osadchukdmitro2.replit.app/api/health

## Устранение неполадок

Если приложение не отвечает или показывает "Service Unavailable":

1. Проверьте логи в консоли Replit
2. Убедитесь, что файл `server.js` корректно запускается
3. Проверьте, что компонент `TelegramWebAppCheck.tsx` отключает проверку Telegram
4. Попробуйте перезапустить деплой