import { db, pool } from '../server/db';

/**
 * Миграция для добавления таблицы wallet_snapshots
 * Эта таблица будет использоваться для хранения снимков балансов кошельков,
 * что позволит отслеживать изменения балансов с течением времени
 */
async function runMigration() {
  try {
    console.log('Начало миграции: создание таблицы wallet_snapshots...');

    // Создаем таблицу wallet_snapshots
    await pool.query(`
      CREATE TABLE IF NOT EXISTS wallet_snapshots (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        balance_uni NUMERIC NOT NULL DEFAULT 0,
        balance_ton NUMERIC NOT NULL DEFAULT 0,
        snapshot_date TIMESTAMP NOT NULL DEFAULT now()
      );
      
      -- Добавляем индексы для оптимизации запросов
      CREATE INDEX IF NOT EXISTS idx_wallet_snapshots_user_id ON wallet_snapshots(user_id);
      CREATE INDEX IF NOT EXISTS idx_wallet_snapshots_snapshot_date ON wallet_snapshots(snapshot_date DESC);
      CREATE INDEX IF NOT EXISTS idx_wallet_snapshots_user_date ON wallet_snapshots(user_id, snapshot_date DESC);
    `);

    console.log('Таблица wallet_snapshots успешно создана');
  } catch (error) {
    console.error('Ошибка при создании таблицы wallet_snapshots:', error);
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
      console.log('Миграция wallet_snapshots выполнена успешно');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Ошибка при выполнении миграции wallet_snapshots:', error);
      process.exit(1);
    });
}