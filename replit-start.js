/**
 * Основной скрипт запуска для кнопки Run в Replit
 */

// Импортируем модуль для запуска дочернего процесса
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// Определяем директорию проекта
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Выводим информацию о запуске
console.log('🚀 UniFarm Server - Запуск через кнопку Run в Replit');
console.log('⏱️ Время запуска:', new Date().toISOString());

// Создаем директорию для логов, если её нет
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Файл для логов
const logFile = path.join(logsDir, `replit-run-${Date.now()}.log`);
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

// Функция для логирования
function log(message) {
  const timestamp = new Date().toISOString();
  const formattedMsg = `[${timestamp}] ${message}`;
  console.log(formattedMsg);
  logStream.write(formattedMsg + '\n');
}

log('Запуск сервера через start.cjs...');

// Запускаем наш стабильный скрипт
const serverProcess = spawn('node', ['start.cjs'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
  }
});

// Обрабатываем завершение процесса сервера
serverProcess.on('close', (code) => {
  log(`⚠️ Процесс сервера завершился с кодом ${code}`);
  log('🔄 Поддерживаем основной процесс активным...');
});

serverProcess.on('error', (err) => {
  log(`❌ Ошибка при запуске сервера: ${err.message}`);
});

// Обрабатываем сигналы завершения
process.on('SIGINT', () => {
  log('⚠️ Получен сигнал SIGINT, игнорируем');
});

process.on('SIGTERM', () => {
  log('⚠️ Получен сигнал SIGTERM, игнорируем');
});

// Обрабатываем необработанные исключения
process.on('uncaughtException', (err) => {
  log(`❌ Необработанное исключение: ${err.message}`);
  log('✅ Продолжаем работу основного процесса');
});

// Интервал для поддержания процесса активным
setInterval(() => {}, 1000);

log('✅ Запускной скрипт инициализирован успешно');