# Настройка Telegram Mini App для UniFarm

## Общая информация

UniFarm работает как Telegram Mini App, что позволяет запускать приложение прямо внутри мессенджера Telegram. Это обеспечивает удобный доступ для пользователей и интеграцию с экосистемой Telegram.

## Как настроить Mini App в BotFather

1. Откройте Telegram и найдите официального бота [@BotFather](https://t.me/BotFather)
2. Если у вас уже есть бот, перейдите к настройке Mini App. Если нет, создайте нового бота:
   - Отправьте команду `/newbot`
   - Следуйте инструкциям, чтобы указать имя и username бота
   - Сохраните полученный токен бота (TELEGRAM_BOT_TOKEN)

3. Для настройки Mini App отправьте команду `/newapp`
4. Выберите бота, для которого вы хотите создать Mini App
5. Следуйте инструкциям:
   - Укажите короткое название (например, "UniFarm")
   - Добавьте описание (например, "Платформа для фарминга и заработка UNI токенов")
   - Загрузите фото для иконки приложения (должно быть квадратным)
   - Для URL укажите: `https://uni-farm-connect-2-misterxuniverse.replit.app/UniFarm`

6. После создания Mini App, настройте команды бота:
   - Отправьте команду `/mybots`
   - Выберите своего бота
   - Нажмите "Edit Bot" -> "Edit Commands"
   - Добавьте команды: 
     ```
     start - Запустить бота
     app - Открыть UniFarm
     ```

7. Настройте кнопку меню для открытия Mini App:
   - Отправьте команду `/mybots`
   - Выберите своего бота
   - Нажмите "Edit Bot" -> "Menu Button"
   - Укажите текст "Открыть UniFarm" и URL `https://uni-farm-connect-2-misterxuniverse.replit.app/UniFarm`

## Автоматическая настройка

Для автоматической настройки бота и Mini App используйте скрипты из репозитория:

```bash
# Полная настройка Mini App и бота
./setup-telegram-mini-app.js

# Настройка команд бота
./setup-telegram-bot-commands.js

# Настройка webhook
./setup-telegram-webhook.js
```

## Важные замечания

1. **URL для Mini App**: Всегда используйте основной домен Replit без слеша в конце: 
   `https://uni-farm-connect-2-misterxuniverse.replit.app/UniFarm`

2. **Режим работы**: Для корректной работы Telegram WebApp API приложение должно запускаться в режиме production:
   ```bash
   NODE_ENV=production node dist/index.js
   ```
   
   Или используйте готовый скрипт:
   ```bash
   ./start-production.sh
   ```

3. **Токен бота**: Убедитесь, что переменная среды TELEGRAM_BOT_TOKEN задана перед запуском:
   ```bash
   export TELEGRAM_BOT_TOKEN="your_telegram_bot_token"
   ```

4. **Webhook**: Для получения уведомлений от Telegram настройте webhook:
   ```bash
   node setup-telegram-webhook.js
   ```

## Проверка настроек

Для проверки правильности настройки Mini App выполните:

```bash
node verify-mini-app.js
```

Этот скрипт проверит доступность Mini App, настройку webhook и команды бота.

## Рекомендации по тестированию

1. Используйте мобильное приложение Telegram для окончательной проверки
2. Убедитесь, что API Telegram WebApp доступен, отправляя в консоль:
   ```javascript
   window.Telegram.WebApp.version
   ```
3. Если вы видите черный экран при запуске, проверьте, что:
   - Приложение запущено в режиме production
   - URL Mini App указан корректно
   - Нет ошибок в консоли браузера