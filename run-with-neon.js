/**
 * Запуск приложения с Neon DB и исправлением ошибок схемы
 */

import 'dotenv/config';
import { exec } from 'child_process';
import * as fs from 'fs';
import path from 'path';

// Загружаем настройки из .env.neon
if (fs.existsSync('.env.neon')) {
  const envContent = fs.readFileSync('.env.neon', 'utf-8');
  const envLines = envContent.split('\n');
  
  envLines.forEach(line => {
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  
  console.log('✅ Переменные из .env.neon загружены');
}

// Принудительно устанавливаем настройки для Neon DB
console.log('🔧 Установка флагов принудительного использования Neon DB...');
process.env.DATABASE_PROVIDER = 'neon';
process.env.FORCE_NEON_DB = 'true';
process.env.DISABLE_REPLIT_DB = 'true';
process.env.OVERRIDE_DB_PROVIDER = 'neon';
process.env.USE_LOCAL_DB_ONLY = 'false';
process.env.NODE_ENV = 'production';

// Проверяем наличие DATABASE_URL для Neon DB
if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes('neon.tech')) {
  console.error('❌ Ошибка: DATABASE_URL не настроен для Neon DB');
  console.error('Убедитесь, что в файле .env.neon указан правильный URL для Neon DB');
  process.exit(1);
}

// Исправляем проблему с partition_logs
console.log('🔧 Исправляем проблему с полем partition_logs...');

// Путь к файлу с проблемным кодом
const partitionManagerPath = path.join(process.cwd(), 'server', 'controllers', 'partitionManager.ts');

if (fs.existsSync(partitionManagerPath)) {
  let content = fs.readFileSync(partitionManagerPath, 'utf-8');
  
  // Заменяем operation_type на operation
  content = content.replace(/operation_type/g, 'operation');
  
  // Сохраняем изменения
  fs.writeFileSync(partitionManagerPath, content);
  console.log('✅ Исправили поле operation_type на operation в partitionManager.ts');
} else {
  console.log('⚠️ Файл partitionManager.ts не найден, пропускаем исправление');
}

// Проверяем, нужно ли перекомпилировать проект
console.log('🔄 Проверка необходимости перекомпиляции...');

// Компилируем проект
console.log('🔧 Компилируем проект...');
try {
  const result = exec('npm run build', (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ Ошибка компиляции: ${error.message}`);
      console.error('Продолжаем с существующими скомпилированными файлами');
    } else {
      console.log('✅ Проект успешно скомпилирован');
    }
    
    // Запускаем приложение
    startApplication();
  });
} catch (error) {
  console.error(`❌ Ошибка запуска компиляции: ${error.message}`);
  console.error('Продолжаем с существующими скомпилированными файлами');
  
  // Запускаем приложение даже при ошибке компиляции
  startApplication();
}

// Функция запуска приложения
function startApplication() {
  console.log('\n🚀 Запуск приложения с Neon DB...');
  console.log('Переменные окружения:');
  console.log(`- DATABASE_PROVIDER: ${process.env.DATABASE_PROVIDER}`);
  console.log(`- FORCE_NEON_DB: ${process.env.FORCE_NEON_DB}`);
  console.log(`- DATABASE_URL: ${process.env.DATABASE_URL.replace(/:[^:]*@/, ':***@')}`);
  console.log(`- NODE_ENV: ${process.env.NODE_ENV}`);
  
  try {
    // Запускаем приложение с новыми переменными окружения
    const node = exec('node --max-old-space-size=512 dist/index.js', { 
      env: process.env 
    });
    
    node.stdout.pipe(process.stdout);
    node.stderr.pipe(process.stderr);
    
    node.on('exit', (code) => {
      if (code !== 0) {
        console.error(`\n❌ Приложение завершилось с кодом ${code}`);
      }
    });
    
    // Обработка прерывания
    process.on('SIGINT', () => {
      console.log('\nЗавершение работы...');
      node.kill();
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Ошибка запуска приложения:', error.message);
    process.exit(1);
  }
}