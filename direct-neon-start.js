/**
 * Прямой запуск приложения с Neon DB, минуя db-selector
 */

import 'dotenv/config';
import { exec } from 'child_process';
import * as fs from 'fs';

// Загружаем настройки из .env.neon
if (fs.existsSync('.env.neon')) {
  const envContent = fs.readFileSync('.env.neon', 'utf-8');
  const envLines = envContent.split('\n');
  
  envLines.forEach(line => {
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length) {
        let value = valueParts.join('=').trim();
        
        // Обработка переменных окружения в формате ${VAR_NAME}
        if (value.includes('${') && value.includes('}')) {
          // Заменяем ${VAR_NAME} на значение переменной окружения
          value = value.replace(/\${([^}]+)}/g, (match, varName) => {
            return process.env[varName] || '';
          });
        }
        
        process.env[key.trim()] = value;
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

console.log('🔍 Проверка настроек:');
console.log(`- DATABASE_PROVIDER: ${process.env.DATABASE_PROVIDER}`);
console.log(`- FORCE_NEON_DB: ${process.env.FORCE_NEON_DB}`);
console.log(`- DATABASE_URL: ${process.env.DATABASE_URL.replace(/:[^:]*@/, ':***@')}`);
console.log(`- NODE_ENV: ${process.env.NODE_ENV}`);

// Запускаем скомпилированное приложение
console.log('\n🚀 Запуск приложения с Neon DB...');

try {
  // Запускаем приложение с новыми переменными окружения
  const node = exec('node dist/index.js', { 
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