# Настройка Telegram бота и webhook

В этом руководстве описано, как настроить Telegram бота и webhook для проекта UniFarm.

## Обзор

Проект использует Telegram бота для следующих функций:
1. Отправка уведомлений пользователям
2. Обработка команд от пользователей (например, `/ping`, `/info`, `/refcode`)
3. Управление реферальной системой

## Создание Telegram бота

1. Откройте Telegram и найдите бота [@BotFather](https://t.me/BotFather)
2. Отправьте команду `/newbot`
3. Следуйте инструкциям для создания нового бота:
   - Укажите имя бота (например, "UniFarm Bot")
   - Укажите username бота (например, "UniFarmingBot")
4. После создания бота, BotFather предоставит вам токен бота (TELEGRAM_BOT_TOKEN)
5. Сохраните этот токен в секретах вашего проекта

## Настройка секретов

Для работы с Telegram API необходимо добавить секрет `TELEGRAM_BOT_TOKEN`:

1. Перейдите в настройки вашего проекта в Replit
2. Найдите раздел "Secrets"
3. Добавьте новый секрет с ключом `TELEGRAM_BOT_TOKEN` и значением, полученным от BotFather

## Настройка webhook

Webhook позволяет получать уведомления от Telegram API в реальном времени. Для настройки webhook выполните следующие шаги:

### Автоматическая настройка (рекомендуется)

После деплоя приложения:

1. Откройте ваше приложение в браузере
2. Выполните POST-запрос на `/api/telegram/set-webhook` с параметром `webhookUrl`:

```bash
curl -X POST "https://your-domain.com/api/telegram/set-webhook" \
  -H "Content-Type: application/json" \
  -d '{"webhookUrl":"https://your-domain.com/api/telegram/webhook"}'
```

### Проверка состояния webhook

Чтобы проверить, правильно ли настроен webhook:

```bash
curl -X GET "https://your-domain.com/api/telegram/webhook-info"
```

### Удаление webhook

Если требуется удалить webhook:

```bash
curl -X POST "https://your-domain.com/api/telegram/delete-webhook"
```

## Тестирование бота

Бот поддерживает следующие команды:

1. `/ping` - проверка доступности бота
2. `/info` - получение информации о пользователе
3. `/refcode` - получение реферального кода пользователя

Эти команды можно использовать для проверки работоспособности бота после настройки.

## Диагностика проблем

Если бот не отвечает на команды:

1. Проверьте статус webhook: `/api/telegram/webhook-info`
2. Убедитесь, что TELEGRAM_BOT_TOKEN правильно настроен в секретах
3. Проверьте логи сервера на наличие ошибок при обработке запросов от Telegram

## Полезные ссылки

- [Официальная документация Telegram Bot API](https://core.telegram.org/bots/api)
- [Настройка кнопок и команд через BotFather](https://core.telegram.org/bots/features#commands)
- [Telegram Mini Apps](https://core.telegram.org/bots/webapps)