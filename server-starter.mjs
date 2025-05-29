/**
 * ESM стартер для запуска production-сервера
 * Поскольку package.json настроен с "type": "module",
 * этот файл использует ESM синтаксис для запуска CommonJS файла
 */

import { createRequire } from 'module';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Настраиваем переменные окружения
process.env.NODE_ENV = 'production';
process.env.PORT = process.env.PORT || '3000';
process.env.DATABASE_PROVIDER = 'replit';

// Получаем текущую директорию
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log(`🚀 Запуск UniFarm в production режиме на порту ${process.env.PORT}`);
console.log('⚙️ Используем ESM стартер для запуска CommonJS production-сервера');

// Путь к production-server.js
const serverPath = join(__dirname, 'production-server.js');

// Запускаем production-server.js через spawn
try {
  const server = spawn('node', [serverPath], {
    stdio: 'inherit',
    env: { ...process.env }
  });
  
  server.on('error', (err) => {
    console.error('❌ Ошибка при запуске production-сервера:', err);
    process.exit(1);
  });
  
  server.on('close', (code) => {
    console.log(`🛑 Production сервер завершился с кодом ${code}`);
    if (code !== 0) {
      process.exit(code);
    }
  });
} catch (err) {
  console.error('❌ Критическая ошибка запуска:', err);
  process.exit(1);
}