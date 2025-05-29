/**
 * Скрипт для тестирования production-сервера UniFarm на Replit
 * 
 * Запускает production-server.mjs напрямую для тестирования
 */

import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Запуск тестирования production-сервера UniFarm...');

// Установка переменных окружения
process.env.NODE_ENV = 'production';
process.env.PORT = '3000';
process.env.DATABASE_PROVIDER = 'replit';

// Путь к production-server.mjs
const serverPath = path.join(__dirname, 'production-server.mjs');

console.log(`📂 Путь к серверу: ${serverPath}`);
console.log('🔧 Переменные окружения:');
console.log(`  - NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`  - PORT: ${process.env.PORT}`);
console.log(`  - DATABASE_PROVIDER: ${process.env.DATABASE_PROVIDER}`);
console.log(`  - DATABASE_URL: ${process.env.DATABASE_URL ? 'настроен' : 'не настроен'}`);

// Запускаем сервер
console.log('🚀 Запуск сервера...');

try {
  // Динамический импорт production-server.mjs
  import(serverPath).then(() => {
    console.log('✅ Сервер загружен успешно.');
  }).catch(error => {
    console.error('❌ Ошибка при загрузке сервера:', error);
  });
} catch (error) {
  console.error('❌ Критическая ошибка при запуске сервера:', error);
}