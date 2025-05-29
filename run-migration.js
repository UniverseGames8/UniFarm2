/**
 * Запуск миграции партиционирования для Neon DB
 */

// Импортируем необходимые модули
import { runMigration } from './server/migrations/create_auto_partitioned_transactions.ts';

// Выполняем миграцию
console.log('🚀 Запуск миграции партиционирования для Neon DB...');

runMigration()
  .then(() => {
    console.log('✅ Миграция выполнена успешно!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка при выполнении миграции:', error);
    process.exit(1);
  });