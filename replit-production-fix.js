/**
 * Специальный скрипт для запуска приложения в production режиме на Replit
 * Также гарантирует правильную настройку портов и обработку статических файлов
 */

// Устанавливаем режим production и порт
process.env.NODE_ENV = 'production';
process.env.PORT = '3000'; // Replit ожидает порт 3000 для production

console.log('🚀 Запуск UniFarm в production режиме на Replit');
console.log(`🔧 Используемый порт: ${process.env.PORT}`);
console.log(`🔧 Режим: ${process.env.NODE_ENV}`);

// Основные модули
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');

// Создаем простой сервер для обслуживания статических файлов
const app = express();
const server = http.createServer(app);

// Определяем путь к собранным файлам
const distPath = path.resolve(process.cwd(), 'dist', 'public');
const indexPath = path.resolve(distPath, 'index.html');

console.log(`📂 Путь к статическим файлам: ${distPath}`);
console.log(`📄 Путь к index.html: ${indexPath}`);

// Проверяем наличие файлов
if (!fs.existsSync(distPath)) {
  console.error(`❌ Директория ${distPath} не существует!`);
  process.exit(1);
}

if (!fs.existsSync(indexPath)) {
  console.error(`❌ Файл ${indexPath} не существует!`);
  process.exit(1);
}

// Настраиваем обслуживание статических файлов
app.use(express.static(distPath, {
  etag: true,
  lastModified: true,
  maxAge: '1d'
}));

// Добавляем обработку CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Для Telegram WebApp
  res.header('Content-Security-Policy', "default-src * 'self' data: blob: 'unsafe-inline' 'unsafe-eval'");
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// Настраиваем обработку всех неизвестных маршрутов для SPA
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    // Для API запросов пропускаем в основное приложение
    console.log(`[API] Запрос: ${req.path}`);
    // Перенаправляем на основной сервер
    require('../dist/index.js');
  } else {
    // Отправляем index.html для всех других маршрутов
    console.log(`[Static] Запрос: ${req.path}`);
    res.sendFile(indexPath);
  }
});

// Запускаем сервер
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Сервер запущен на порту ${PORT} в режиме ${process.env.NODE_ENV || 'development'}`);
  
  // Запускаем основное приложение
  try {
    console.log('🔄 Загрузка основного приложения...');
    require('../dist/index.js');
  } catch (error) {
    console.error('❌ Ошибка при загрузке основного приложения:', error);
  }
});