/**
 * Простой production-сервер для запуска на Replit
 * Обеспечивает быстрый запуск и стабильную работу в production-среде
 * Адаптирован для работы с ES модулями (package.json type: module)
 */

// Настраиваем переменные окружения
process.env.NODE_ENV = 'production';
// Используем порт 3000 для совместимости с Replit
process.env.PORT = process.env.PORT || '3000';
// Устанавливаем Replit PostgreSQL как основной провайдер БД
process.env.DATABASE_PROVIDER = 'replit';

console.log('[DB] Установлен провайдер базы данных: replit');

// Импортируем модули с использованием ESM синтаксиса
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// В ESM __dirname не определен, поэтому создаем его
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Создаем Express приложение
const app = express();
const port = parseInt(process.env.PORT, 10);

console.log(`🚀 Запуск UniFarm в production режиме на порту ${port}`);

// Путь к статическим файлам и index.html
const distPath = path.join(__dirname, 'dist', 'public');
const staticLoading = path.join(__dirname, 'static-loading.html');
const indexPath = path.join(distPath, 'index.html');

// Проверяем наличие статической страницы загрузки
if (!fs.existsSync(staticLoading)) {
  console.log('⚠️ Статическая страница загрузки не найдена, создаем заглушку...');
  const loadingPage = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>UniFarm - Loading...</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background-color: #0f172a;
          color: white;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          margin: 0;
        }
        .loader {
          border: 5px solid #f3f3f3;
          border-top: 5px solid #3498db;
          border-radius: 50%;
          width: 50px;
          height: 50px;
          animation: spin 2s linear infinite;
          margin-bottom: 20px;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
      <meta http-equiv="refresh" content="5">
    </head>
    <body>
      <div class="loader"></div>
      <h1>UniFarm</h1>
      <p>Приложение загружается, пожалуйста, подождите...</p>
    </body>
    </html>
  `;
  fs.writeFileSync(staticLoading, loadingPage);
}

// Проверяем наличие собранных файлов
if (!fs.existsSync(distPath)) {
  console.log('⚠️ Директория со статическими файлами не найдена, отдаем страницу загрузки');
  // Пытаемся искать статические файлы в других возможных местах
  const alternativePaths = [
    path.join(__dirname, 'client', 'dist', 'public'),
    path.join(__dirname, 'client', 'dist'),
    path.join(__dirname, 'public'),
    path.join(__dirname, 'client', 'public'),
  ];
  
  for (const altPath of alternativePaths) {
    if (fs.existsSync(altPath)) {
      console.log(`✅ Найден альтернативный путь к статическим файлам: ${altPath}`);
      // Обновляем путь к статическим файлам
      distPath = altPath;
      break;
    }
  }
}

// Настраиваем CORS и безопасность
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
  
  // Для Telegram WebApp
  res.header('Content-Security-Policy', "default-src * 'self' data: blob: 'unsafe-inline' 'unsafe-eval'");
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Обслуживаем статические файлы из dist/public
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath, {
    maxAge: '1d',
    etag: true
  }));
}

// Предоставляем простую конечную точку health
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Обрабатываем API запросы
app.use('/api', async (req, res, next) => {
  console.log(`[API] ${req.method} ${req.path}`);
  
  // Проверяем, загрузилось ли основное приложение
  try {
    // Проверяем различные пути к основному приложению
    const possiblePaths = [
      './dist/index.js',
      './build/index.js',
      './dist/server/index.js'
    ];
    
    let mainApp = null;
    
    for (const appPath of possiblePaths) {
      try {
        // Пытаемся загрузить основное приложение с использованием динамического импорта
        const module = await import(appPath);
        mainApp = module.default || module;
        console.log(`✅ Основное приложение загружено из ${appPath}`);
        break;
      } catch (e) {
        // Продолжаем поиск
      }
    }
    
    if (mainApp && typeof mainApp === 'function') {
      return mainApp(req, res, next);
    } else {
      console.warn('[API] Основное приложение не найдено или не является функцией');
      next();
    }
  } catch (error) {
    console.error('[API] Ошибка при обработке API запроса:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Сервер находится в процессе инициализации. Пожалуйста, повторите запрос позже.'
    });
  }
});

// Обслуживаем все остальные запросы, отдавая index.html
app.get('*', (req, res) => {
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // Если index.html еще не создан, отдаем статическую страницу загрузки
    res.sendFile(staticLoading);
  }
});

// Запускаем сервер
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Production сервер запущен на http://0.0.0.0:${port}`);
  
  // Предварительно подготавливаем пути к основному приложению
  const possibleMainPaths = [
    './dist/index.js',
    './build/index.js',
    './dist/server/index.js'
  ];
  
  // Пытаемся запустить основное приложение
  setTimeout(async () => {
    try {
      console.log('🔄 Запуск основного приложения...');
      
      // Перебираем возможные пути
      let mainAppLoaded = false;
      
      for (const appPath of possibleMainPaths) {
        try {
          console.log(`🔎 Пробуем загрузить основное приложение из ${appPath}...`);
          // Используем динамический импорт вместо require
          const module = await import(appPath);
          console.log(`✅ Основное приложение успешно загружено из ${appPath}`);
          mainAppLoaded = true;
          break;
        } catch (e) {
          console.log(`❌ Не удалось загрузить из ${appPath}:`, e.message);
        }
      }
      
      if (!mainAppLoaded) {
        console.log('⚠️ Не удалось загрузить основное приложение. Будем проксировать запросы к API');
      }
    } catch (error) {
      console.error('❌ Ошибка при запуске основного приложения:', error);
    }
  }, 1000);
});

// Обрабатываем аварийное завершение
process.on('uncaughtException', (err) => {
  console.error('❌ Необработанное исключение:', err);
  // Продолжаем работу
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Необработанное отклонение Promise:', reason);
  // Продолжаем работу
});