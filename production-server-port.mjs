/**
 * Скрипт для запуска production-сервера UniFarm на Replit
 * С возможностью автоматического выбора свободного порта
 * 
 * ВАЖНО: Настроен на использование только локальной PostgreSQL от Replit,
 * игнорируя все внешние подключения, включая Neon DB
 */

import { fileURLToPath } from 'url';
import path from 'path';
import { createServer } from 'http';
import express from 'express';
import fs from 'fs';
import { createRequire } from 'module';

// Преобразуем URL импорта в путь для __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Принудительно устанавливаем переменную окружения для использования локальной PostgreSQL
process.env.DATABASE_PROVIDER = 'replit';
process.env.USE_LOCAL_DB_ONLY = 'true';

// Переменные конфигурации
const PORT = parseInt(process.env.PORT || '3000', 10);
const BASE_PORT = PORT; // Начальный порт
const MAX_PORT_ATTEMPTS = 10; // Максимальное число попыток

console.log(`[DB] Установлен принудительный провайдер базы данных: replit (только локальная PostgreSQL)`);
console.log(`🚀 Запуск UniFarm в production режиме на порту ${PORT}`);

// Проверка доступности порта
async function isPortAvailable(port) {
  return new Promise(resolve => {
    const server = createServer();
    
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false); // Порт занят
      } else {
        resolve(true); // Другая ошибка, считаем порт свободным
      }
    });
    
    server.once('listening', () => {
      server.close();
      resolve(true); // Порт свободен
    });
    
    server.listen(port);
  });
}

// Функция для запуска сервера с автоматическим выбором порта
async function startServerWithAutoPort() {
  let port = BASE_PORT;
  let attempt = 0;
  
  // Пробуем последовательно порты, начиная с BASE_PORT
  while (attempt < MAX_PORT_ATTEMPTS) {
    const available = await isPortAvailable(port);
    if (available) {
      // Порт свободен, запускаем сервер
      process.env.PORT = port.toString();
      console.log(`✅ Порт ${port} свободен, запускаем сервер...`);
      return port;
    }
    
    // Порт занят, пробуем следующий
    console.log(`⚠️ Порт ${port} занят, пробуем порт ${port + 1}...`);
    port++;
    attempt++;
  }
  
  // Не удалось найти свободный порт
  throw new Error(`❌ Не удалось найти свободный порт после ${MAX_PORT_ATTEMPTS} попыток`);
}

// Функция для запуска production-сервера
async function startProductionServer() {
  try {
    console.log('✅ Используем production-конфигурацию');
    
    // Выбираем свободный порт
    const port = await startServerWithAutoPort();
    console.log(`🔄 Запуск production-сервера на порту ${port}...`);
    
    // Попытка загрузить production-сервер
    const appPath = './dist/index.js';
    console.log(`🔎 Пробуем загрузить основное приложение из ${appPath}...`);
    
    try {
      // Путь к production-сборке
      const app = await import(appPath);
      
      if (app) {
        console.log(`✅ Основное приложение успешно загружено из ${appPath}`);
      }
    } catch (error) {
      console.error('❌ Ошибка при загрузке основного приложения:', error);
      
      // Запускаем простой express сервер в качестве запасного варианта
      console.log('⚠️ Запуск запасного express сервера...');
      
      const app = express();
      
      // Базовые middleware
      app.use(express.json());
      app.use(express.urlencoded({ extended: true }));
      
      // Проверка работоспособности
      app.get('/api/health', (req, res) => {
        res.json({
          status: 'ok',
          message: 'UniFarm API работает в запасном режиме',
          timestamp: new Date().toISOString()
        });
      });
      
      // Статика из dist, если папка существует
      const distPublicPath = path.join(__dirname, 'dist', 'public');
      if (fs.existsSync(distPublicPath)) {
        app.use(express.static(distPublicPath));
        console.log(`📂 Статические файлы доступны из ${distPublicPath}`);
      }
      
      // Обработка 404
      app.use((req, res) => {
        res.status(404).json({
          error: 'Маршрут не найден',
          message: 'API работает в запасном режиме'
        });
      });
      
      // Запуск сервера
      app.listen(port, '0.0.0.0', () => {
        console.log(`✅ Запасной сервер запущен на http://0.0.0.0:${port}`);
      });
    }
  } catch (error) {
    console.error('❌ Критическая ошибка запуска:', error);
    process.exit(1);
  }
}

// Запуск сервера
startProductionServer();