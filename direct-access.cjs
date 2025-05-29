/**
 * Простой файл для деплоя UniFarm с доступом через браузер
 * CommonJS версия для совместимости с Replit
 */

// Устанавливаем переменные окружения
process.env.NODE_ENV = 'production';
process.env.FORCE_NEON_DB = 'true';
process.env.OVERRIDE_DB_PROVIDER = 'neon';
process.env.DATABASE_PROVIDER = 'neon';
process.env.SKIP_TELEGRAM_CHECK = 'true';
process.env.ALLOW_BROWSER_ACCESS = 'true';

// Информация о запуске
console.log('=================================================');
console.log('  UNIFARM - ПРЯМОЙ ДОСТУП ЧЕРЕЗ БРАУЗЕР');
console.log('=================================================');
console.log(`NODE_ENV = ${process.env.NODE_ENV}`);
console.log(`FORCE_NEON_DB = ${process.env.FORCE_NEON_DB}`);
console.log(`SKIP_TELEGRAM_CHECK = ${process.env.SKIP_TELEGRAM_CHECK}`);
console.log('=================================================');
console.log(`Время запуска: ${new Date().toISOString()}`);
console.log('=================================================');

// Подключаем необходимые модули
const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');

// Создаем приложение
const app = express();
const PORT = process.env.PORT || 3000;

// Определяем путь к статическим файлам
const distPath = path.join(__dirname, 'dist', 'public');
const clientDistPath = path.join(__dirname, 'client', 'dist');

// Проверяем наличие папок
const hasDistFolder = fs.existsSync(distPath);
const hasClientDistFolder = fs.existsSync(clientDistPath);

// Выбираем папку со статическими файлами
let staticPath = hasDistFolder ? distPath : hasClientDistFolder ? clientDistPath : null;

// Настраиваем обслуживание статических файлов
if (staticPath) {
  console.log(`Обслуживание статических файлов из: ${staticPath}`);
  app.use(express.static(staticPath));
} else {
  console.log('Папка со статическими файлами не найдена');
}

// Простой API-эндпоинт для проверки здоровья
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    config: {
      NODE_ENV: process.env.NODE_ENV,
      FORCE_NEON_DB: process.env.FORCE_NEON_DB,
      SKIP_TELEGRAM_CHECK: process.env.SKIP_TELEGRAM_CHECK,
      DATABASE_PROVIDER: process.env.DATABASE_PROVIDER
    }
  });
});

// Страница-заглушка для тестирования
const fallbackHtml = `
<!DOCTYPE html>
<html>
  <head>
    <title>UniFarm</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        margin: 40px;
        line-height: 1.6;
        color: #333;
        background-color: #f9f9f9;
      }
      .container {
        max-width: 800px;
        margin: 0 auto;
        padding: 30px;
        background: #fff;
        border-radius: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      }
      h1 { 
        color: #0088cc; 
        text-align: center;
        margin-bottom: 30px;
      }
      .status { 
        background: #e8f5e9;
        padding: 20px; 
        border-radius: 8px;
        margin-bottom: 30px;
        text-align: center;
      }
      .info {
        background: #e3f2fd;
        padding: 20px;
        border-radius: 8px;
        margin-bottom: 20px;
      }
      .logo {
        font-size: 48px;
        text-align: center;
        margin-bottom: 20px;
      }
      a {
        color: #0088cc;
        text-decoration: none;
      }
      a:hover {
        text-decoration: underline;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="logo">🌾</div>
      <h1>UniFarm</h1>
      <div class="status">
        <p>✅ Сервер запущен и работает</p>
        <p>Время: ${new Date().toISOString()}</p>
      </div>
      <div class="info">
        <p>Это базовая страница сервера UniFarm для проверки работоспособности.</p>
        <p>Для проверки API: <a href="/api/health">/api/health</a></p>
      </div>
    </div>
  </body>
</html>
`;

// Обрабатываем все остальные маршруты
app.get('*', (req, res) => {
  if (staticPath && fs.existsSync(path.join(staticPath, 'index.html'))) {
    // Если есть index.html, отправляем его
    res.sendFile(path.join(staticPath, 'index.html'));
  } else {
    // Иначе показываем простую страницу-заглушку
    res.send(fallbackHtml);
  }
});

// Создаем и запускаем сервер
const server = http.createServer(app);
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});

// Обработка завершения
process.on('SIGINT', () => {
  console.log('Получен сигнал завершения, останавливаем сервер...');
  server.close(() => {
    console.log('Сервер остановлен');
    process.exit(0);
  });
});