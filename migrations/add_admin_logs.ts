import { db, pool } from '../server/db';

/**
 * Миграция для добавления таблицы admin_logs
 * Эта таблица будет использоваться для отслеживания действий администраторов
 * в системе, что важно для аудита и безопасности
 */
async function runMigration() {
  try {
    console.log('Начало миграции: создание таблицы admin_logs...');

    // Создаем enum тип для действий админа
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_action_type') THEN
          CREATE TYPE admin_action_type AS ENUM (
            'balance_change',
            'user_modify',
            'farming_modify',
            'referral_modify',
            'system_setting',
            'user_ban',
            'user_unban',
            'transaction_cancel',
            'transaction_refund',
            'other'
          );
        END IF;
      END
      $$;
    `);

    // Создаем таблицу admin_logs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_logs (
        id SERIAL PRIMARY KEY,
        admin_id INTEGER NOT NULL REFERENCES users(id),
        action_type admin_action_type NOT NULL,
        action_description TEXT NOT NULL,
        target_user_id INTEGER REFERENCES users(id),
        details JSONB,
        ip_address VARCHAR(45),
        created_at TIMESTAMP NOT NULL DEFAULT now()
      );
      
      -- Добавляем индексы для быстрого поиска и анализа логов
      CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs(admin_id);
      CREATE INDEX IF NOT EXISTS idx_admin_logs_action_type ON admin_logs(action_type);
      CREATE INDEX IF NOT EXISTS idx_admin_logs_target_user_id ON admin_logs(target_user_id);
      CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at DESC);
    `);

    console.log('Таблица admin_logs успешно создана');
  } catch (error) {
    console.error('Ошибка при создании таблицы admin_logs:', error);
    throw error;
  } finally {
    // Не закрываем соединение с базой данных, так как оно используется в приложении
  }
}

// Экспортируем функцию миграции
export default runMigration;

// Если скрипт запущен напрямую, выполняем миграцию
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('Миграция admin_logs выполнена успешно');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Ошибка при выполнении миграции admin_logs:', error);
      process.exit(1);
    });
}