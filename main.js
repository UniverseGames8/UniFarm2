/**
 * Главный точка входа для Replit
 * 
 * Этот файл автоматически запускается при нажатии кнопки Run в интерфейсе Replit
 */

console.log('🚀 Запуск UniFarm через main.js...');

// Импортируем child_process для запуска скрипта
import { spawn } from 'child_process';

// Запускаем наш надежный скрипт запуска
const child = spawn('node', ['start.cjs'], {
  stdio: 'inherit'
});

// Обрабатываем завершение процесса
child.on('close', (code) => {
  console.log(`⚠️ Процесс завершился с кодом ${code}, поддерживаем main.js активным`);
});

// Игнорируем сигналы завершения
process.on('SIGINT', () => {
  console.log('⚠️ Получен SIGINT, игнорируем');
});

process.on('SIGTERM', () => {
  console.log('⚠️ Получен SIGTERM, игнорируем');
});

// Обрабатываем необработанные исключения
process.on('uncaughtException', (err) => {
  console.error('❌ Необработанное исключение:', err);
  console.log('✅ Продолжаем работу');
});

// Интервал для поддержания процесса активным
setInterval(() => {}, 1000);