/**
 * Файл для запуска workflow с Neon DB
 * Для использования в Replit Workflow
 * Совместим с настройками кабинета разработки
 */

// Установка переменных окружения перед запуском
process.env.DATABASE_PROVIDER = 'neon';
process.env.FORCE_NEON_DB = 'true';
process.env.DISABLE_REPLIT_DB = 'true';
process.env.OVERRIDE_DB_PROVIDER = 'neon';
process.env.NODE_ENV = 'production';
process.env.PORT = '3000';
process.env.SKIP_PARTITION_CREATION = 'true';
process.env.IGNORE_PARTITION_ERRORS = 'true';

console.log('===========================================');
console.log('ЗАПУСК WORKFLOW С ПРИНУДИТЕЛЬНЫМ NEON DB');
console.log('===========================================');
console.log('DATABASE_PROVIDER =', process.env.DATABASE_PROVIDER);
console.log('FORCE_NEON_DB =', process.env.FORCE_NEON_DB);
console.log('DISABLE_REPLIT_DB =', process.env.DISABLE_REPLIT_DB);
console.log('OVERRIDE_DB_PROVIDER =', process.env.OVERRIDE_DB_PROVIDER);
console.log('NODE_ENV =', process.env.NODE_ENV);
console.log('PORT =', process.env.PORT);
console.log('===========================================');

// Подключаем start-unified.cjs - этот файл содержит логику
// для подключения к Neon DB и управления партиционированием
import('./start-unified.cjs').catch(err => {
  console.error('Ошибка при импорте start-unified.cjs:', err);
  process.exit(1);
});