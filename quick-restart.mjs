#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

console.log('🔄 Быстрый перезапуск UniFarm...');

try {
  // Останавливаем старые процессы
  try {
    await execAsync('pkill -f "npm.*dev" || true');
    await execAsync('pkill -f "node.*server" || true');
  } catch (e) {
    // Игнорируем ошибки
  }

  console.log('✅ Старые процессы остановлены');
  
  // Ждем немного
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Запускаем новый процесс в фоне
  const child = exec('npm run dev', (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Ошибка запуска:', error);
      return;
    }
  });
  
  child.stdout?.on('data', (data) => {
    console.log(data.toString());
  });
  
  child.stderr?.on('data', (data) => {
    console.error(data.toString());
  });
  
  console.log('🚀 Приложение перезапущено!');
  console.log('📱 Теперь проверьте кнопки в боте @UniFarming_Bot');
  
} catch (error) {
  console.error('❌ Ошибка при перезапуске:', error);
}