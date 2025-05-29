# Инструкции по деплою UniFarm на Replit

## Подготовка проекта к деплою

1. Убедитесь, что ESM-модули правильно настроены в `start-unified.js`
2. Проверьте настройки портов в файлах `start-unified.js` и `production-server.js` (должны использовать порт 3000)
3. Проверьте настройки базы данных для Replit PostgreSQL

## Настройка Replit для деплоя

В интерфейсе Replit перейдите в раздел "Deployments" и установите следующие параметры:

### Команда сборки
```
npm run build
```

### Команда запуска
```
NODE_ENV=production DATABASE_PROVIDER=replit node start-unified.js
```

### Переменные окружения
- `NODE_ENV` = `production`
- `DATABASE_PROVIDER` = `replit`

## После успешного деплоя

После успешного деплоя выполните команду для создания структуры базы данных:
```
npm run db:push
```

## Устранение неполадок

### Ошибка "ReferenceError: require is not defined"
Убедитесь, что в файле `start-unified.js` явно указано, что это CommonJS модуль.

### Ошибка "PORT mismatch"
Убедитесь, что все настройки портов соответствуют друг другу. В нашем случае, мы используем порт 3000 везде.