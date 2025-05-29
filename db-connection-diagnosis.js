/**
 * Диагностический скрипт для проверки подключения к базе данных
 * Запускать отдельно от основного приложения для изоляции проблем
 * 
 * Использование:
 * node db-connection-diagnosis.js
 */

// Явное применение фикса для базы данных
console.log('[Диагностика] 📊 Применение фикса подключения к БД...');

// Принудительно отключаем Unix сокеты для PostgreSQL
process.env.PGHOST = process.env.PGHOST || 'localhost';  
process.env.PGSSLMODE = 'prefer';
process.env.PGSOCKET = ''; 
process.env.PGCONNECT_TIMEOUT = '10';

// Принудительно переключаем на Neon DB
process.env.DATABASE_PROVIDER = 'neon';
process.env.FORCE_NEON_DB = 'true';
process.env.DISABLE_REPLIT_DB = 'true';
process.env.OVERRIDE_DB_PROVIDER = 'neon';

console.log('[Диагностика] ✅ Фикс для БД применен');

// Импортируем модули для работы с БД
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Pool } = require('pg');

// Выводим информацию о настройках подключения
console.log('\n[Диагностика] 📋 Переменные окружения для подключения к БД:');
console.log('DATABASE_PROVIDER =', process.env.DATABASE_PROVIDER || 'не установлена');
console.log('FORCE_NEON_DB =', process.env.FORCE_NEON_DB || 'не установлена');
console.log('DISABLE_REPLIT_DB =', process.env.DISABLE_REPLIT_DB || 'не установлена');
console.log('OVERRIDE_DB_PROVIDER =', process.env.OVERRIDE_DB_PROVIDER || 'не установлена');
console.log('PGSSLMODE =', process.env.PGSSLMODE || 'не установлена');
console.log('PGSOCKET =', process.env.PGSOCKET || 'не установлена (это нормально)');
console.log('PGCONNECT_TIMEOUT =', process.env.PGCONNECT_TIMEOUT || 'не установлена');

// Проверяем DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.error('[Диагностика] ❌ КРИТИЧЕСКАЯ ОШИБКА: DATABASE_URL не найден!');
  console.error('Проверьте настройки переменных окружения для подключения к Neon DB.');
  process.exit(1);
} else {
  // Маскируем URL для безопасности в логах
  const maskedUrl = process.env.DATABASE_URL.replace(/\/\/([^:]+):([^@]+)@/, '//\\1:***@');
  console.log('\n[Диагностика] 🔐 DATABASE_URL:', maskedUrl);
  
  // Проверяем, что URL указывает на Neon DB
  if (process.env.DATABASE_URL.includes('neon.tech')) {
    console.log('[Диагностика] ✅ Строка подключения указывает на Neon DB');
  } else {
    console.warn('[Диагностика] ⚠️ ВНИМАНИЕ: DATABASE_URL не содержит домен neon.tech. Это может не быть Neon DB!');
  }
}

// Попытка подключения
console.log('\n[Диагностика] 🔄 Попытка подключения к базе данных...');

// Создаем пул соединений с настройками Neon DB
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Для Neon DB
  },
  // Ограничиваем размер пула для диагностики
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000
});

// Добавляем обработчики событий
pool.on('error', (err) => {
  console.error('[Диагностика] ❌ Ошибка пула соединений:', err.message);
});

pool.on('connect', () => {
  console.log('[Диагностика] ✅ Соединение с пулом установлено');
});

// Тестирование соединения
async function testConnection() {
  console.log('\n[Диагностика] 🔬 ТЕСТИРОВАНИЕ СОЕДИНЕНИЯ С БАЗОЙ ДАННЫХ');
  
  try {
    // Пытаемся получить клиента из пула
    console.log('[Диагностика] 🔄 Получение клиента из пула...');
    const client = await pool.connect();
    console.log('[Диагностика] ✅ Клиентское соединение установлено успешно');
    
    // Простой запрос для проверки соединения
    console.log('[Диагностика] 🔄 Выполнение тестового запроса...');
    const result = await client.query('SELECT NOW() as time');
    console.log('[Диагностика] ✅ Запрос выполнен успешно. Текущее время в БД:', result.rows[0].time);
    
    // Проверка версии PostgreSQL
    const versionResult = await client.query('SELECT version()');
    console.log('[Диагностика] 📊 Версия PostgreSQL:', versionResult.rows[0].version);
    
    // Проверка таблиц в базе данных
    console.log('\n[Диагностика] 🔄 Проверка таблиц в базе данных...');
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
      LIMIT 10;
    `);
    
    if (tablesResult.rows.length === 0) {
      console.log('[Диагностика] ⚠️ Таблицы не найдены в схеме public');
    } else {
      console.log(`[Диагностика] ✅ Найдено ${tablesResult.rows.length} таблиц:`);
      tablesResult.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. ${row.table_name}`);
      });
    }
    
    // Попробуем проверить пользователей
    try {
      console.log('\n[Диагностика] 🔄 Проверка наличия пользователей...');
      const usersResult = await client.query(`
        SELECT COUNT(*) as count 
        FROM auth_users
      `);
      
      console.log(`[Диагностика] ✅ Найдено ${usersResult.rows[0].count} пользователей в системе`);
    } catch (error) {
      console.error('[Диагностика] ⚠️ Не удалось проверить пользователей:', error.message);
    }
    
    // Освобождаем клиента
    client.release();
    console.log('\n[Диагностика] ✅ Диагностика подключения к базе данных завершена успешно');
    
  } catch (error) {
    console.error('[Диагностика] ❌ ОШИБКА ПРИ ПОДКЛЮЧЕНИИ К БАЗЕ ДАННЫХ:');
    console.error(error.message);
    if (error.stack) {
      console.error('Стек ошибки:', error.stack);
    }
    
    // Дополнительная диагностика для ошибок подключения
    if (error.message.includes('ENOENT') || error.message.includes('socket')) {
      console.error('[Диагностика] 🔍 Обнаружена ошибка с Unix socket. Возможно, система всё еще пытается использовать локальный PostgreSQL.');
      console.error('Рекомендация: Убедитесь, что db-connect-fix.js импортируется до любых операций с БД во всех файлах.');
    } else if (error.message.includes('timeout')) {
      console.error('[Диагностика] 🔍 Обнаружен таймаут подключения. Neon DB может быть недоступен или перегружен.');
      console.error('Рекомендация: Проверьте статус Neon DB и сетевое подключение.');
    } else if (error.message.includes('too many clients')) {
      console.error('[Диагностика] 🔍 Превышено максимальное количество соединений в пуле.');
      console.error('Рекомендация: Проверьте утечки соединений и закрытие клиентов после использования.');
    }
    
  } finally {
    await pool.end();
    console.log('[Диагностика] 🏁 Пул соединений закрыт. Диагностика завершена.');
  }
}

// Запускаем тестирование
testConnection().catch(error => {
  console.error('[Диагностика] ⚠️ Необработанная ошибка в скрипте диагностики:', error);
});