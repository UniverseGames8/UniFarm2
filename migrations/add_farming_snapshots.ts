import { db, pool } from '../server/db';

/**
 * Миграция для добавления таблицы farming_snapshots
 * Эта таблица будет использоваться для хранения агрегированного дохода
 * по каждому пользователю с интервалом в сутки
 */
async function runMigration() {
  try {
    console.log('Начало миграции: создание таблицы farming_snapshots...');

    // Создаем таблицу farming_snapshots
    await pool.query(`
      CREATE TABLE IF NOT EXISTS farming_snapshots (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        total_earned NUMERIC NOT NULL,
        snapshot_date TIMESTAMP NOT NULL DEFAULT now()
      );
      
      -- Добавляем индекс для быстрого поиска снимков по пользователю и дате
      CREATE INDEX IF NOT EXISTS idx_farming_snapshots_user_id ON farming_snapshots(user_id);
      CREATE INDEX IF NOT EXISTS idx_farming_snapshots_snapshot_date ON farming_snapshots(snapshot_date DESC);
      CREATE INDEX IF NOT EXISTS idx_farming_snapshots_user_date ON farming_snapshots(user_id, snapshot_date DESC);
    `);

    console.log('Таблица farming_snapshots успешно создана');
  } catch (error) {
    console.error('Ошибка при создании таблицы farming_snapshots:', error);
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
      console.log('Миграция farming_snapshots выполнена успешно');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Ошибка при выполнении миграции farming_snapshots:', error);
      process.exit(1);
    });
}