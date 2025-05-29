# Инструкции по настройке Workflow для Neon DB

## Обновленный метод (простой и надежный)

Мы создали специальный скрипт `neon-workflow.js`, который гарантирует правильный запуск с Neon DB:

1. Откройте вкладку "Workflows" в левой панели
2. Создайте новый workflow (нажмите на "+" рядом с надписью "Workflows")
3. Установите следующие параметры:
   - Name: `Neon DB Server`
   - Command: `node neon-workflow.js`
   - Choose when to run: `Manual` или `Run in background`
4. Сохраните и запустите workflow

Этот скрипт принудительно устанавливает все необходимые переменные окружения для Neon DB до запуска основного приложения.

## Альтернативный способ

Если по каким-то причинам вам нужно использовать `start-unified.js`:

1. Откройте вкладку "Workflows" в левой панели
2. Создайте новый workflow
3. Установите команду:
```
NODE_ENV=production PORT=3000 DATABASE_PROVIDER=neon FORCE_NEON_DB=true node start-unified.js
```
4. Сохраните изменения и запустите workflow

Эта команда принудительно использует Neon DB, игнорируя настройки из файла .replit