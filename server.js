/**
 * Файл запуска UniFarm для деплоя
 * Запускает приложение с прямым доступом через браузер
 */

// Устанавливаем необходимые переменные окружения
process.env.NODE_ENV = 'production';
process.env.FORCE_NEON_DB = 'true';
process.env.OVERRIDE_DB_PROVIDER = 'neon';
process.env.DATABASE_PROVIDER = 'neon';
process.env.SKIP_TELEGRAM_CHECK = 'true';
process.env.ALLOW_BROWSER_ACCESS = 'true';

// Код для вывода информации в консоль
console.log('=================================================');
console.log('  UNIFARM - ПРЯМОЙ ДОСТУП ПО URL');
console.log('=================================================');
console.log(`DATABASE_PROVIDER = ${process.env.DATABASE_PROVIDER}`);
console.log(`FORCE_NEON_DB = ${process.env.FORCE_NEON_DB}`);
console.log(`OVERRIDE_DB_PROVIDER = ${process.env.OVERRIDE_DB_PROVIDER}`);
console.log(`SKIP_TELEGRAM_CHECK = ${process.env.SKIP_TELEGRAM_CHECK}`);
console.log(`ALLOW_BROWSER_ACCESS = ${process.env.ALLOW_BROWSER_ACCESS}`);
console.log(`NODE_ENV = ${process.env.NODE_ENV}`);
console.log(`PORT = ${process.env.PORT || 3000}`);
console.log('=================================================');
console.log(`Время запуска: ${new Date().toISOString()}`);
console.log('=================================================');

// Загружаем Express прямо здесь для создания простого сервера
import express from 'express';
import path from 'path';
import { createServer } from 'http';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Создаем приложение
const app = express();
const PORT = process.env.PORT || 3000;

// Получаем правильный путь в ES модуле
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Проверяем, существует ли собранная версия приложения
const distPath = path.join(__dirname, 'dist', 'public');
const hasDistFolder = fs.existsSync(distPath);

// Статические файлы
if (hasDistFolder) {
  console.log(`Обслуживание статических файлов из: ${distPath}`);
  app.use(express.static(distPath));
}

// Простой API-эндпоинт для проверки работы
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: process.platform,
      hasDistFolder
    }
  });
});

// Перенаправляем все запросы на index.html для SPA
app.get('*', (req, res) => {
  if (hasDistFolder) {
    res.sendFile(path.join(distPath, 'index.html'));
  } else {
    // Если папки dist нет, покажем простую страницу
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>UniFarm</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 40px;
              line-height: 1.6;
            }
            .container {
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
              border: 1px solid #ddd;
              border-radius: 8px;
            }
            h1 { color: #0088cc; }
            .status { 
              background: #e8f5e9;
              padding: 15px; 
              border-radius: 4px;
              margin-bottom: 20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>UniFarm</h1>
            <div class="status">
              <p>✅ Сервер запущен и работает</p>
              <p>Статус: OK</p>
              <p>Время: ${new Date().toISOString()}</p>
            </div>
            <p>Приложение находится в процессе запуска или dist-папка не найдена.</p>
            <p>Проверьте статус по эндпоинту <a href="/api/health">/api/health</a></p>
          </div>
        </body>
      </html>
    `);
  }
});

// Запускаем сервер
const server = createServer(app);
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
  console.log(`Доступ: http://localhost:${PORT}`);
});

// Обработка сигналов для корректного завершения
process.on('SIGINT', () => {
  console.log('Получен сигнал SIGINT, завершаем работу...');
  server.close(() => {
    console.log('Сервер остановлен');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('Получен сигнал SIGTERM, завершаем работу...');
  server.close(() => {
    console.log('Сервер остановлен');
    process.exit(0);
  });
});