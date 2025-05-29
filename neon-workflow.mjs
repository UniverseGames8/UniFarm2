/**
 * Скрипт для запуска приложения через рабочий процесс (workflow) Replit
 * с принудительным использованием Neon DB
 */

// Импортируем dotenv для загрузки переменных окружения
import { config } from 'dotenv';
import { Pool } from 'pg';
import { spawn } from 'child_process';

// Загружаем переменные окружения из .env.neon
config({ path: '.env.neon' });

// Принудительно устанавливаем переменные окружения для Neon DB
process.env.DATABASE_PROVIDER = 'neon';
process.env.FORCE_NEON_DB = 'true';
process.env.DISABLE_REPLIT_DB = 'true';
process.env.OVERRIDE_DB_PROVIDER = 'neon';
process.env.NODE_ENV = 'production';

console.log('===============================================');
console.log('🚀 Запуск UniFarm с принудительным использованием Neon DB');
console.log('===============================================');
console.log('📊 Настройки базы данных:');
console.log('  DATABASE_PROVIDER:', process.env.DATABASE_PROVIDER);
console.log('  FORCE_NEON_DB:', process.env.FORCE_NEON_DB);
console.log('  DISABLE_REPLIT_DB:', process.env.DISABLE_REPLIT_DB);
console.log('  NODE_ENV:', process.env.NODE_ENV);
console.log('===============================================');

// Проверка наличия строки подключения
if (!process.env.DATABASE_URL) {
  console.error('❌ ERROR: Переменная DATABASE_URL не найдена!');
  console.error('Убедитесь, что файл .env.neon существует и содержит DATABASE_URL');
  process.exit(1);
}

// Проверка доступности базы данных перед запуском
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

try {
  const result = await pool.query('SELECT NOW() as now');
  console.log('✅ Подключение к Neon DB успешно установлено');
  console.log(`  Время сервера: ${result.rows[0].now}`);
  console.log('===============================================');
  
  // Закрываем пул соединений с БД
  await pool.end();
  
  // Запускаем приложение как отдельный процесс с нужными параметрами окружения
  console.log('🚀 Запуск сервера...');
  
  const serverProcess = spawn('node', ['dist/index.js'], {
    env: {
      ...process.env,
      DATABASE_PROVIDER: 'neon',
      FORCE_NEON_DB: 'true', 
      DISABLE_REPLIT_DB: 'true',
      OVERRIDE_DB_PROVIDER: 'neon'
    },
    stdio: 'inherit'
  });
  
  serverProcess.on('error', (err) => {
    console.error('❌ Ошибка при запуске сервера:', err.message);
    process.exit(1);
  });
  
  // Обработка завершения процесса сервера
  serverProcess.on('exit', (code) => {
    if (code !== 0) {
      console.error(`❌ Сервер завершился с кодом: ${code}`);
      process.exit(code);
    }
  });
  
  // Передаем сигналы завершения
  process.on('SIGINT', () => {
    serverProcess.kill('SIGINT');
  });
  
  process.on('SIGTERM', () => {
    serverProcess.kill('SIGTERM');
  });
  
} catch (err) {
  console.error('❌ Ошибка при подключении к Neon DB:', err.message);
  console.error('Проверьте настройки подключения в .env.neon');
  process.exit(1);
}