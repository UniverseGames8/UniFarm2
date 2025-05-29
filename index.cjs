/**
 * Точка входа для Replit - автоматически запускается при нажатии кнопки Run
 */

// Перенаправляем на наш скрипт поддержания сервера
console.log('🚀 Запуск UniFarm через точку входа index.cjs...');
console.log('⏱️ Время запуска:', new Date().toISOString());

// Запускаем keep-alive скрипт напрямую через require
try {
  console.log('➡️ Перенаправление на keep-alive.cjs...');
  require('./keep-alive.cjs');
  
  // Чтобы гарантировать, что процесс не завершится
  setInterval(() => {}, 1000);
} catch (error) {
  console.error('❌ Ошибка при запуске keep-alive.cjs:', error);
}