/**
 * Специальный скрипт для запуска и поддержания сервера UniFarm в рабочем состоянии в среде Replit
 * 
 * Особенности:
 * - Запускает сервер на основе TypeScript без перезагрузки
 * - Удерживает процесс от завершения даже при ошибках
 * - Автоматически перезапускает сервер при падении
 * - Предотвращает автоматическое завершение процесса Replit
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Время запуска
const startTime = new Date();
console.log('🕒 Запуск:', startTime.toISOString());
console.log('🚀 UniFarm Server Keeper - запуск сервера с защитой от выключения');

// Создаем директорию для логов, если ее нет
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Файл для вывода логов
const logFile = path.join(logsDir, `server-${Date.now()}.log`);
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

// Функция для логирования
function log(message) {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[${timestamp}] ${message}`;
  console.log(formattedMessage);
  logStream.write(formattedMessage + '\n');
}

// Определяем команду для запуска сервера
let serverProcess = null;

// Функция для запуска сервера
function startServer() {
  log('Запуск сервера UniFarm...');
  
  // Запускаем процесс сервера
  serverProcess = spawn('npx', ['tsx', 'server/index.ts'], {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      FORCE_COLOR: '1', // Включаем цветной вывод в консоль
    },
  });
  
  // Перехватываем стандартный вывод
  serverProcess.stdout.on('data', (data) => {
    process.stdout.write(data);
    logStream.write(data);
  });
  
  // Перехватываем вывод ошибок
  serverProcess.stderr.on('data', (data) => {
    process.stderr.write(data);
    logStream.write(data);
  });
  
  // Обработка закрытия процесса
  serverProcess.on('close', (code) => {
    const uptime = Math.floor((new Date() - startTime) / 1000);
    log(`Сервер завершил работу с кодом ${code}. Время работы: ${Math.floor(uptime / 60)}м ${uptime % 60}с`);
    
    // Перезапускаем сервер через 3 секунды
    log('Автоматический перезапуск через 3 секунды...');
    setTimeout(startServer, 3000);
  });
  
  // Обработка ошибок процесса
  serverProcess.on('error', (err) => {
    log(`Ошибка при запуске сервера: ${err.message}`);
  });
}

// Запускаем сервер
startServer();

// Обрабатываем сигналы завершения
process.on('SIGINT', () => {
  log('Получен сигнал SIGINT');
  log('Игнорируем завершение для поддержания сервера в Replit');
});

process.on('SIGTERM', () => {
  log('Получен сигнал SIGTERM');
  log('Игнорируем завершение для поддержания сервера в Replit');
});

// Обрабатываем необработанные исключения
process.on('uncaughtException', (err) => {
  log(`Необработанное исключение: ${err.message}`);
  log('Основной процесс продолжает работу');
});

// Пинг каждые 5 минут для сохранения активности
setInterval(() => {
  const uptime = Math.floor((new Date() - startTime) / 1000);
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = uptime % 60;
  
  log(`⏱️ Сервер работает ${hours}ч ${minutes}м ${seconds}с`);
}, 5 * 60 * 1000);

// Еще один интервал каждую секунду для гарантии работы
setInterval(() => {}, 1000);

log('✅ Скрипт поддержания сервера успешно запущен');