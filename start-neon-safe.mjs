/**
 * Скрипт для безопасного запуска приложения с Neon DB
 * Перехватывает некритические ошибки для обеспечения стабильной работы
 */

// Импортируем необходимые модули
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
// Отключаем создание партиций при запуске
process.env.SKIP_PARTITION_CREATION = 'true';
process.env.IGNORE_PARTITION_ERRORS = 'true';

console.log('===============================================');
console.log('🚀 Запуск UniFarm с принудительным использованием Neon DB');
console.log('===============================================');
console.log('📊 Настройки базы данных:');
console.log('  DATABASE_PROVIDER:', process.env.DATABASE_PROVIDER);
console.log('  FORCE_NEON_DB:', process.env.FORCE_NEON_DB);
console.log('  DISABLE_REPLIT_DB:', process.env.DISABLE_REPLIT_DB);
console.log('  NODE_ENV:', process.env.NODE_ENV);
console.log('  SKIP_PARTITION_CREATION:', process.env.SKIP_PARTITION_CREATION);
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
  
  // Запрашиваем список таблиц для проверки
  const tablesResult = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);
  
  console.log(`✅ БД содержит ${tablesResult.rowCount} таблиц`);
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
      OVERRIDE_DB_PROVIDER: 'neon',
      SKIP_PARTITION_CREATION: 'true',
      IGNORE_PARTITION_ERRORS: 'true'
    },
    stdio: 'inherit'
  });
  
  // Обработка ошибок запуска процесса
  serverProcess.on('error', (err) => {
    console.error('❌ Ошибка при запуске сервера:', err.message);
    process.exit(1);
  });
  
  // Обработка завершения процесса сервера
  serverProcess.on('exit', (code) => {
    // Игнорируем ошибки партиционирования (код 1)
    if (code !== 0) {
      if (code === 1) {
        console.log('⚠️ Сервер завершился с кодом 1 (возможно из-за ошибки партиционирования)');
        console.log('Перезапуск сервера...');
        
        // Задержка перед перезапуском
        setTimeout(() => {
          const restartProcess = spawn('node', ['dist/index.js'], {
            env: {
              ...process.env,
              DATABASE_PROVIDER: 'neon',
              FORCE_NEON_DB: 'true', 
              DISABLE_REPLIT_DB: 'true',
              OVERRIDE_DB_PROVIDER: 'neon',
              SKIP_PARTITION_CREATION: 'true',
              IGNORE_PARTITION_ERRORS: 'true'
            },
            stdio: 'inherit'
          });
          
          restartProcess.on('exit', (restartCode) => {
            if (restartCode !== 0) {
              console.error(`❌ Сервер завершился при перезапуске с кодом: ${restartCode}`);
              process.exit(restartCode);
            }
          });
        }, 3000);
      } else {
        console.error(`❌ Сервер завершился с кодом: ${code}`);
        process.exit(code);
      }
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