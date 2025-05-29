// Простое приложение Express для деплоя
const express = require('express');
const path = require('path');
const fs = require('fs');

// Настройка переменных окружения для обхода проверки Telegram
process.env.SKIP_TELEGRAM_CHECK = 'true';
process.env.ALLOW_BROWSER_ACCESS = 'true';
process.env.NODE_ENV = 'production';

// Создание приложения Express
const app = express();
const PORT = process.env.PORT || 3000;

// Путь к собранным статическим файлам
const distPath = path.join(__dirname, 'dist');
const clientDistPath = path.join(__dirname, 'client', 'dist');

// Определяем, какую папку с файлами использовать
let staticFolder = null;
if (fs.existsSync(path.join(distPath, 'index.html'))) {
  staticFolder = distPath;
  console.log(`Используем статические файлы из: ${staticFolder}`);
} else if (fs.existsSync(path.join(clientDistPath, 'index.html'))) {
  staticFolder = clientDistPath;
  console.log(`Используем статические файлы из: ${staticFolder}`);
} else {
  console.log('Нет доступных статических файлов');
}

// Настройка обслуживания статических файлов
if (staticFolder) {
  app.use(express.static(staticFolder));
}

// API для проверки работоспособности
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    environment: {
      node_env: process.env.NODE_ENV,
      skip_telegram: process.env.SKIP_TELEGRAM_CHECK,
      browser_access: process.env.ALLOW_BROWSER_ACCESS
    }
  });
});

// Обработка всех остальных запросов - отправляем index.html
app.get('*', (req, res) => {
  if (staticFolder && fs.existsSync(path.join(staticFolder, 'index.html'))) {
    res.sendFile(path.join(staticFolder, 'index.html'));
  } else {
    // Базовая HTML страница, если нет собранного приложения
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>UniFarm - Тестовый режим</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .container { max-width: 600px; margin: 0 auto; }
            h1 { color: #0088cc; }
            .status { background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>UniFarm</h1>
            <div class="status">
              <p>✅ Сервер запущен и работает</p>
              <p>Доступ без проверки Telegram: Включен</p>
              <p>Время: ${new Date().toISOString()}</p>
            </div>
            <p>Проверка API: <a href="/api/health">/api/health</a></p>
          </div>
        </body>
      </html>
    `);
  }
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
  console.log('Переменные окружения:');
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`SKIP_TELEGRAM_CHECK: ${process.env.SKIP_TELEGRAM_CHECK}`);
  console.log(`ALLOW_BROWSER_ACCESS: ${process.env.ALLOW_BROWSER_ACCESS}`);
});