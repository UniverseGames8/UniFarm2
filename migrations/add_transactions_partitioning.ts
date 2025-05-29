import { db, pool } from '../server/db';

/**
 * Миграция для добавления партиционирования таблицы transactions по дате
 * Это значительно ускорит выборку по временным интервалам при большом объеме данных
 * 
 * ВАЖНО: Эта миграция должна выполняться только при наличии большого количества транзакций
 * и после тщательного тестирования на тестовой базе данных.
 */
async function runMigration() {
  try {
    console.log('Начало миграции: добавление партиционирования для таблицы transactions...');

    // Создаем временную таблицу в качестве шаблона для партиционированной таблицы
    await pool.query(`
      -- Создаем партиционированную таблицу на базе существующей структуры
      CREATE TABLE IF NOT EXISTS transactions_partitioned (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        type VARCHAR(50) NOT NULL,
        amount NUMERIC NOT NULL,
        currency VARCHAR(10) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'completed',
        tx_hash VARCHAR(255),
        wallet_address VARCHAR(255),
        description TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP
      ) PARTITION BY RANGE (created_at);
      
      -- Создаем партиции по месяцам для последних 12 месяцев
      -- Этот скрипт нужно адаптировать к реальному диапазону дат в системе
      -- В данном примере мы создаем партиции для текущего и предыдущего месяца
      CREATE TABLE IF NOT EXISTS transactions_y2025m04 PARTITION OF transactions_partitioned
        FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
      
      CREATE TABLE IF NOT EXISTS transactions_y2025m05 PARTITION OF transactions_partitioned
        FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
        
      -- Создаем партицию для будущих данных
      CREATE TABLE IF NOT EXISTS transactions_future PARTITION OF transactions_partitioned
        FOR VALUES FROM ('2025-06-01') TO (MAXVALUE);
      
      -- Создаем индексы на партиционированной таблице
      CREATE INDEX IF NOT EXISTS idx_transactions_part_user_id ON transactions_partitioned(user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_part_user_id_created_at ON transactions_partitioned(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_transactions_part_type ON transactions_partitioned(type);
      CREATE INDEX IF NOT EXISTS idx_transactions_part_currency ON transactions_partitioned(currency);
      CREATE INDEX IF NOT EXISTS idx_transactions_part_created_at ON transactions_partitioned(created_at);
    `);

    console.log('Структура для партиционирования таблицы transactions успешно создана');
    
    // Примечание: фактическая миграция данных из transactions в transactions_partitioned 
    // должна выполняться только после тщательного тестирования и в специальном окне обслуживания
    console.log('ВАЖНО: Для завершения миграции данных необходимо выполнить следующие шаги вручную:');
    console.log('1. Сделать резервную копию таблицы transactions');
    console.log('2. Перенести данные из transactions в transactions_partitioned');
    console.log('3. Переименовать таблицы (заменить transactions на transactions_partitioned)');
    console.log('4. Обновить последовательность id в новой таблице');
    
  } catch (error) {
    console.error('Ошибка при создании партиционирования для таблицы transactions:', error);
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
      console.log('Миграция для партиционирования transactions выполнена успешно');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Ошибка при выполнении миграции партиционирования:', error);
      process.exit(1);
    });
}