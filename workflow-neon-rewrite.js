/**
 * Скрипт для запуска приложения UniFarm с принудительным использованием Neon DB
 * Специально для запуска через workflow
 * 
 * Этот скрипт модифицирует файл db-selector-new.ts,
 * заменяя логику определения провайдера БД на фиксированную Neon DB
 */

// Устанавливаем NODE_ENV=production перед запуском
process.env.NODE_ENV = 'production';

console.log('🚀 Запуск UniFarm с ПРИНУДИТЕЛЬНЫМ использованием Neon DB');
console.log('✅ NODE_ENV = production');

// Запускаем скрипт из режима CommonJS
require('./override-db-provider.cjs');