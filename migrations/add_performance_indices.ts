import { db, pool } from '../server/db';

/**
 * Миграция для добавления индексов производительности в базу данных
 * Эти индексы значительно ускоряют наиболее частые запросы в приложении
 */
async function runMigration() {
  try {
    console.log('Начало миграции: добавление индексов производительности...');

    // Выполним запросы для создания всех необходимых индексов
    await pool.query(`
      -- Индекс для быстрого поиска транзакций пользователя
      CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
      
      -- Составной индекс для сортировки транзакций по дате
      CREATE INDEX IF NOT EXISTS idx_transactions_user_id_created_at ON transactions(user_id, created_at DESC);
      
      -- Индекс для быстрого поиска депозитов пользователя
      CREATE INDEX IF NOT EXISTS idx_uni_farming_deposits_user_id ON uni_farming_deposits(user_id);
      
      -- Индекс для быстрого поиска рефералов пользователя
      CREATE INDEX IF NOT EXISTS idx_referrals_inviter_id ON referrals(inviter_id);
      
      -- Составной индекс для эффективного отображения миссий пользователя
      CREATE INDEX IF NOT EXISTS idx_user_missions_user_id_mission_id ON user_missions(user_id, mission_id);
      
      -- Индекс для поиска транзакций определенного типа
      CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
      
      -- Индекс по типу валюты для анализа
      CREATE INDEX IF NOT EXISTS idx_transactions_currency ON transactions(currency);
    `);

    console.log('Миграция успешно завершена. Индексы созданы.');
  } catch (error) {
    console.error('Ошибка при выполнении миграции индексов:', error);
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
      console.log('Миграция индексов выполнена успешно');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Ошибка при выполнении миграции индексов:', error);
      process.exit(1);
    });
}