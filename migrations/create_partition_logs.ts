/**
 * Миграция для создания таблицы partition_logs
 * Эта таблица будет использоваться для мониторинга создания новых партиций
 */

import { Pool } from '@neondatabase/serverless';
import ws from 'ws';
import { neonConfig } from '@neondatabase/serverless';

neonConfig.webSocketConstructor = ws;

async function runMigration() {
  console.log('Запуск миграции: создание таблицы partition_logs');
  
  if (!process.env.DATABASE_URL) {
    throw new Error('Отсутствует переменная окружения DATABASE_URL');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    // Создание таблицы для логирования партиций
    const createTableResult = await pool.query(`
      CREATE TABLE IF NOT EXISTS partition_logs (
        id SERIAL PRIMARY KEY,
        partition_name VARCHAR(100) NOT NULL,
        partition_date DATE NOT NULL,
        status VARCHAR(20) NOT NULL,
        details TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Создаем индекс по дате партиции для быстрого поиска
      CREATE INDEX IF NOT EXISTS idx_partition_logs_partition_date ON partition_logs (partition_date);
      
      -- Создаем индекс по имени партиции для быстрого поиска
      CREATE INDEX IF NOT EXISTS idx_partition_logs_partition_name ON partition_logs (partition_name);
    `);
    
    console.log('Таблица partition_logs успешно создана');
    
    return { success: true, message: 'Таблица partition_logs успешно создана' };
  } catch (error: any) {
    console.error('Ошибка при создании таблицы partition_logs:', error.message);
    return { success: false, message: error.message };
  } finally {
    await pool.end();
  }
}

// Если файл запущен напрямую, выполняем миграцию
if (require.main === module) {
  runMigration()
    .then((result) => {
      console.log(result);
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Необработанная ошибка:', error);
      process.exit(1);
    });
}

export default runMigration;