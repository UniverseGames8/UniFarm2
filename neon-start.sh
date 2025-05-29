#!/bin/bash

# Прямой запуск приложения с использованием Neon DB
# Этот скрипт пропускает механизм выбора БД и напрямую использует Neon DB

# Загружаем настройки из .env.neon
if [ -f .env.neon ]; then
  echo "✅ Загрузка настроек из .env.neon..."
  set -a
  source .env.neon
  set +a
  echo "✅ Настройки загружены"
else
  echo "❌ Файл .env.neon не найден!"
  exit 1
fi

# Настройка переменных окружения для принудительного использования Neon DB
export FORCE_NEON_DB=true
export DISABLE_REPLIT_DB=true
export OVERRIDE_DB_PROVIDER=neon
export DATABASE_PROVIDER=neon
export USE_LOCAL_DB_ONLY=false
export NODE_ENV=production

# Проверка подключения к Neon DB
echo "🔄 Проверка подключения к Neon DB..."
node check-neon-db.cjs

# Запускаем dist/public/neon.js, который напрямую подключается к Neon DB
mkdir -p dist/public

# Создаем файл для запуска через Neon DB
cat > dist/public/neon.js << 'EOF'
/**
 * Модуль прямого подключения к Neon DB
 * Запускается через npm run neon или ./neon-start.sh
 */

import * as schema from '../../shared/schema.js';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pkg from 'pg';
const { Pool } = pkg;

// Настройка пула подключений
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: true
  }
});

// Создание экземпляра Drizzle ORM
const db = drizzle(pool, { schema });

// Экспорт модуля для использования в других файлах
export { db, pool };

// При прямом запуске - тест подключения
if (import.meta.url === import.meta.resolve(import.meta.url)) {
  console.log('[NEON-DB] Прямой запуск модуля подключения к Neon DB');
  
  try {
    // Проверка соединения
    const result = await pool.query('SELECT NOW() AS time');
    console.log(`[NEON-DB] ✅ Соединение с Neon DB установлено. Время на сервере: ${result.rows[0].time}`);
    
    // Получаем список таблиц
    const { rows } = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log(`[NEON-DB] Обнаружено ${rows.length} таблиц в базе данных.`);
    
    // Список ключевых таблиц для проверки
    const requiredTables = ['users', 'transactions', 'referrals'];
    
    // Проверяем наличие ключевых таблиц
    const missingTables = requiredTables.filter(table => 
      !rows.some(row => row.table_name === table)
    );
    
    if (missingTables.length > 0) {
      console.error(`[NEON-DB] ⚠️ Отсутствуют важные таблицы: ${missingTables.join(', ')}`);
    } else {
      console.log(`[NEON-DB] ✅ Все основные таблицы присутствуют`);
    }
    
    // Проверяем таблицу users
    try {
      const usersCount = await db.query.users.count();
      console.log(`[NEON-DB] ✅ Таблица users содержит ${usersCount} записей`);
    } catch (err) {
      console.error(`[NEON-DB] ❌ Ошибка при проверке таблицы users:`, err.message);
    }
  } catch (error) {
    console.error('[NEON-DB] ❌ Ошибка при подключении к Neon DB:', error.message);
    console.error(error.stack);
  } finally {
    // Закрываем соединение
    await pool.end();
    console.log('[NEON-DB] 🔄 Соединение с базой данных закрыто');
  }
}
EOF

# Запускаем приложение с Neon DB
echo "🚀 Запуск приложения с прямым подключением к Neon DB..."

# Запуск через node с указанием пути к модулю
node --experimental-specifier-resolution=node dist/public/neon.js