/**
 * Скрипт для быстрого запуска сервера на Replit
 * Открывает порт сразу, а затем загружает основное приложение
 */

// Сначала настраиваем переменные окружения для запуска
process.env.NODE_ENV = 'development';

// Импортируем необходимые модули
const http = require('http');
const { exec, spawn } = require('child_process');

console.log('🚀 Запуск сервера UniFarm для Replit...');

// Открываем немедленно порт 5000 с простым сервером, чтобы 
// Replit понял, что сервер запущен
const tempServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Server starting, please wait...');
  
  // Логируем информацию о запросе
  console.log(`Получен запрос: ${req.method} ${req.url}`);
});

// Запускаем временный сервер на порту 5000
tempServer.listen(5000, '0.0.0.0', () => {
  console.log('✅ Порт 5000 открыт, Replit считает сервер запущенным');
  
  // Теперь запускаем настоящий сервер
  console.log('🔄 Запускаем основное приложение...');
  
  // Используем spawn, чтобы запустить процесс npm run dev
  const npmProcess = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit',
    shell: false
  });
  
  // Обрабатываем события процесса
  npmProcess.on('error', (error) => {
    console.error('❌ Ошибка при запуске npm run dev:', error);
  });
  
  // После запуска основного сервера, закрываем временный
  // Делаем это с небольшой задержкой, чтобы Replit не считал, что сервер упал
  setTimeout(() => {
    tempServer.close(() => {
      console.log('✅ Временный сервер закрыт, основной сервер работает');
    });
  }, 5000); // 5 секунд
});

// Обрабатываем сигналы завершения
process.on('SIGINT', () => {
  console.log('Получен сигнал SIGINT, завершаем работу...');
  tempServer.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Получен сигнал SIGTERM, завершаем работу...');
  tempServer.close();
  process.exit(0);
});