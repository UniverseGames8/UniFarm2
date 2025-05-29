/**
 * Автономный файл для запуска приложения UniFarm с Neon DB
 * Этот файл предназначен для использования в Replit
 * 
 * Запуск: node neon-app-start.js
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// Получаем текущий каталог
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Устанавливаем переменные окружения для запуска
process.env.DATABASE_PROVIDER = 'neon';
process.env.FORCE_NEON_DB = 'true';
process.env.DISABLE_REPLIT_DB = 'true'; 
process.env.OVERRIDE_DB_PROVIDER = 'neon';
process.env.NODE_ENV = 'production';
process.env.PORT = '3000';
process.env.SKIP_PARTITION_CREATION = 'true';
process.env.IGNORE_PARTITION_ERRORS = 'true';

// Функция для проверки и создания файла health.html
function ensureHealthFile() {
  const distHealthPath = path.join(__dirname, 'dist', 'public', 'health.html');
  
  if (!fs.existsSync(distHealthPath)) {
    console.log('Проверка файла health.html...');
    
    // Создаем директорию dist/public, если она не существует
    if (!fs.existsSync(path.join(__dirname, 'dist', 'public'))) {
      fs.mkdirSync(path.join(__dirname, 'dist', 'public'), { recursive: true });
    }
    
    // Копируем health.html из server/public, если он существует
    const serverHealthPath = path.join(__dirname, 'server', 'public', 'health.html');
    
    if (fs.existsSync(serverHealthPath)) {
      fs.copyFileSync(serverHealthPath, distHealthPath);
      console.log(`✅ Скопирован файл health.html из ${serverHealthPath} в ${distHealthPath}`);
    } else {
      // Создаем базовый health.html файл, если не можем найти исходный
      const healthContent = `
<!DOCTYPE html>
<html>
<head>
  <title>UniFarm Health Check</title>
  <meta charset="utf-8">
</head>
<body>
  <h1>UniFarm API Server</h1>
  <p>Status: OK</p>
</body>
</html>`;
      
      fs.writeFileSync(distHealthPath, healthContent);
      console.log(`✅ Создан файл health.html в ${distHealthPath}`);
    }
  }
}

// Запуск сервера
function startServer() {
  console.log('===============================================');
  console.log('🚀 Запуск UniFarm с принудительным использованием Neon DB');
  console.log('===============================================');
  console.log('📊 Настройки базы данных:');
  console.log('  DATABASE_PROVIDER:', process.env.DATABASE_PROVIDER);
  console.log('  FORCE_NEON_DB:', process.env.FORCE_NEON_DB);
  console.log('  DISABLE_REPLIT_DB:', process.env.DISABLE_REPLIT_DB);
  console.log('  NODE_ENV:', process.env.NODE_ENV);
  console.log('  PORT:', process.env.PORT);
  console.log('  SKIP_PARTITION_CREATION:', process.env.SKIP_PARTITION_CREATION);
  console.log('===============================================');
  
  // Запускаем непосредственно собранный файл для обеспечения стабильности
  const serverProcess = spawn('node', ['dist/index.js'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_PROVIDER: 'neon',
      FORCE_NEON_DB: 'true',
      DISABLE_REPLIT_DB: 'true', 
      OVERRIDE_DB_PROVIDER: 'neon',
      NODE_ENV: 'production',
      PORT: '3000',
      SKIP_PARTITION_CREATION: 'true',
      IGNORE_PARTITION_ERRORS: 'true'
    }
  });
  
  // Обработчики событий
  serverProcess.on('error', (err) => {
    console.error(`❌ Ошибка при запуске сервера: ${err.message}`);
    process.exit(1);
  });
  
  serverProcess.on('exit', (code) => {
    if (code !== 0) {
      console.error(`❌ Сервер завершился с кодом ошибки: ${code}`);
      // Перезапускаем сервер после небольшой задержки
      console.log('🔄 Перезапуск сервера через 5 секунд...');
      setTimeout(() => {
        startServer();
      }, 5000);
    }
  });
  
  // Передаем сигналы завершения
  process.on('SIGINT', () => {
    serverProcess.kill('SIGINT');
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    serverProcess.kill('SIGTERM');
    process.exit(0);
  });
}

// Основная функция
function main() {
  // Проверяем и создаем health.html
  ensureHealthFile();
  
  // Запускаем сервер
  startServer();
}

// Запускаем программу
main();