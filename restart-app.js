/**
 * Быстрый restart приложения
 */

import { spawn } from 'child_process';

console.log('🔄 Перезапуск приложения...');

// Убиваем старые процессы
try {
  spawn('pkill', ['-f', 'node'], { stdio: 'ignore' });
} catch (e) {}

// Ждем немного
setTimeout(() => {
  console.log('🚀 Запуск нового процесса...');
  
  // Запускаем новый процесс
  const child = spawn('npm', ['run', 'dev'], {
    detached: true,
    stdio: 'ignore'
  });
  
  child.unref();
  
  console.log('✅ Приложение перезапущено!');
  console.log('📱 Теперь проверьте кнопки в боте.');
  
  process.exit(0);
}, 2000);