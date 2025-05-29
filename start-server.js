/**
 * Скрипт для запуска сервера с правильной настройкой базы данных
 * Этот скрипт проверяет настройки подключения и запускает сервер
 */

console.log('🔄 Запуск сервера UniFarm с улучшенной обработкой подключения к БД');

// Явно устанавливаем переменные окружения для БД
process.env.PGSSLMODE = 'require';
process.env.FORCE_NEON_DB = 'true';
process.env.DISABLE_REPLIT_DB = 'true';
process.env.OVERRIDE_DB_PROVIDER = 'neon';

// Импортируем и запускаем сервер
require('./server/index.js');