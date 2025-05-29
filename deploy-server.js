/**
 * Скрипт для запуска сервера в production режиме
 * Предоставляет более стабильный запуск с корректной настройкой портов
 */

// Устанавливаем режим production через переменную окружения
process.env.NODE_ENV = 'production';

// Импортируем модуль express и запускаем сервер
import('./dist/index.js')
  .then(() => {
    console.log('✅ Сервер успешно запущен в production режиме');
  })
  .catch((error) => {
    console.error('❌ Ошибка при запуске сервера:', error);
    process.exit(1);
  });