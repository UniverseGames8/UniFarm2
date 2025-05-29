#!/usr/bin/env node

/**
 * Development сервер для тестирования UniFarm в режиме разработки
 * Запускает приложение с локальной базой данных и отключенным кэшированием
 */

console.log('🔧 [DEV MODE] Запуск приложения в режиме разработки...');

// Устанавливаем переменные окружения для development
process.env.NODE_ENV = 'development';
process.env.DATABASE_PROVIDER = 'replit';
process.env.PORT = '3000';
process.env.DISABLE_CACHE = 'true';
process.env.DEV_MODE = 'true';

console.log('🔧 [DEV MODE] Environment variables set:');
console.log('   NODE_ENV:', process.env.NODE_ENV);
console.log('   DATABASE_PROVIDER:', process.env.DATABASE_PROVIDER);
console.log('   PORT:', process.env.PORT);
console.log('   DEV_MODE:', process.env.DEV_MODE);

// Запускаем основной сервер
import('./start-unified.js')
  .then(() => {
    console.log('✅ [DEV MODE] Сервер успешно запущен в режиме разработки');
  })
  .catch((error) => {
    console.error('❌ [DEV MODE] Ошибка запуска сервера:', error);
    process.exit(1);
  });