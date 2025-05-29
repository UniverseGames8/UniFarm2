import { db } from '../server/db.js';

/**
 * Миграция для добавления колонки wallet_address в таблицу transactions
 * Эта миграция выполняется через прямой SQL запрос, чтобы избежать проблем с Drizzle push
 */
async function runMigration() {
  try {
    console.log('Начинаем миграцию: добавление колонки wallet_address в таблицу transactions');
    
    // Проверяем, существует ли колонка уже
    const checkColumnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'transactions' AND column_name = 'wallet_address';
    `;
    
    const checkResult = await db.execute(checkColumnQuery);
    
    // Если колонка уже существует, пропускаем
    if (checkResult.rows.length > 0) {
      console.log('Колонка wallet_address уже существует в таблице transactions. Пропускаем миграцию.');
      return;
    }
    
    // Добавляем колонку wallet_address
    const addColumnQuery = `
      ALTER TABLE transactions
      ADD COLUMN wallet_address TEXT;
    `;
    
    await db.execute(addColumnQuery);
    console.log('Колонка wallet_address успешно добавлена в таблицу transactions');
    
    // Обновляем существующие записи, если необходимо
    // Например, можно установить значение NULL для всех существующих записей
    const updateExistingQuery = `
      UPDATE transactions
      SET wallet_address = NULL
      WHERE wallet_address IS NULL;
    `;
    
    await db.execute(updateExistingQuery);
    console.log('Существующие записи в таблице transactions обновлены');
    
    console.log('Миграция успешно завершена');
  } catch (error) {
    console.error('Ошибка при выполнении миграции:', error);
    throw error;
  }
}

// Экспортируем функцию для использования в других файлах
export default runMigration;