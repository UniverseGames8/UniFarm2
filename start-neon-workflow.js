/**
 * Запускает приложение с принудительным использованием Neon DB
 * Этот файл используется как точка входа для Replit Workflow
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Получаем текущий каталог (в ESM __dirname не определен)
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

console.log('===============================================');
console.log('🚀 Запуск UniFarm (workflow) с принудительным использованием Neon DB');
console.log('===============================================');
console.log('📊 Настройки базы данных:');
console.log('  DATABASE_PROVIDER:', process.env.DATABASE_PROVIDER);
console.log('  FORCE_NEON_DB:', process.env.FORCE_NEON_DB);
console.log('  DISABLE_REPLIT_DB:', process.env.DISABLE_REPLIT_DB);
console.log('  NODE_ENV:', process.env.NODE_ENV);
console.log('  PORT:', process.env.PORT);
console.log('  SKIP_PARTITION_CREATION:', process.env.SKIP_PARTITION_CREATION);
console.log('===============================================');

// Проверяем наличие start-with-neon.sh
const startScript = path.join(process.cwd(), 'start-with-neon.sh');

if (!fs.existsSync(startScript)) {
  console.error(`❌ Скрипт ${startScript} не найден!`);
  process.exit(1);
}

// Делаем скрипт исполняемым, если он не является таковым
try {
  fs.chmodSync(startScript, '755');
  console.log(`✅ Права доступа для ${startScript} обновлены (755)`);
} catch (err) {
  console.warn(`⚠️ Не удалось обновить права доступа для ${startScript}: ${err.message}`);
}

// Запускаем скрипт start-with-neon.sh
console.log(`🚀 Запуск скрипта ${startScript}...`);

const scriptProcess = spawn('bash', [startScript], {
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
scriptProcess.on('error', (err) => {
  console.error(`❌ Ошибка при запуске скрипта: ${err.message}`);
  process.exit(1);
});

scriptProcess.on('exit', (code) => {
  if (code !== 0) {
    console.error(`❌ Скрипт завершился с кодом ошибки: ${code}`);
    process.exit(code);
  }
});

// Передаем сигналы завершения
process.on('SIGINT', () => {
  scriptProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  scriptProcess.kill('SIGTERM');
});