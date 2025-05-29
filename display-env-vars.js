/**
 * Скрипт для вывода переменных окружения при деплое
 * Помогает диагностировать проблемы с подключением к базе данных
 */
console.log('====== ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ ДЛЯ БАЗЫ ДАННЫХ ======');
console.log('DATABASE_PROVIDER =', process.env.DATABASE_PROVIDER || 'не установлена');
console.log('FORCE_NEON_DB =', process.env.FORCE_NEON_DB || 'не установлена');
console.log('DISABLE_REPLIT_DB =', process.env.DISABLE_REPLIT_DB || 'не установлена');
console.log('OVERRIDE_DB_PROVIDER =', process.env.OVERRIDE_DB_PROVIDER || 'не установлена');

// Проверяем наличие DATABASE_URL (без вывода самого значения для безопасности)
if (process.env.DATABASE_URL) {
  const maskedUrl = process.env.DATABASE_URL.replace(/\/\/([^:]+):([^@]+)@/, '//\\1:***@');
  console.log('DATABASE_URL =', maskedUrl);
} else {
  console.log('DATABASE_URL = не установлена ❌');
}

// Проверяем переменные окружения PostgreSQL
console.log('\n====== ПЕРЕМЕННЫЕ POSTGRES ======');
console.log('PGDATABASE =', process.env.PGDATABASE || 'не установлена');
console.log('PGHOST =', process.env.PGHOST || 'не установлена');
console.log('PGPORT =', process.env.PGPORT || 'не установлена');
console.log('PGUSER =', process.env.PGUSER || 'не установлена');
console.log('PGPASSWORD =', process.env.PGPASSWORD ? '***' : 'не установлена');

// Проверяем другие важные переменные окружения
console.log('\n====== ДРУГИЕ ПЕРЕМЕННЫЕ ======');
console.log('NODE_ENV =', process.env.NODE_ENV || 'не установлена');
console.log('PORT =', process.env.PORT || 'не установлена');
console.log('SKIP_PARTITION_CREATION =', process.env.SKIP_PARTITION_CREATION || 'не установлена');
console.log('IGNORE_PARTITION_ERRORS =', process.env.IGNORE_PARTITION_ERRORS || 'не установлена');
console.log('TELEGRAM_BOT_TOKEN =', process.env.TELEGRAM_BOT_TOKEN ? 'установлен ✅' : 'не установлен ❌');

// Выводим рекомендации по исправлению
console.log('\n====== РЕКОМЕНДАЦИИ ПО ИСПРАВЛЕНИЮ ======');
if (!process.env.DATABASE_URL) {
  console.log('❌ DATABASE_URL не установлена. Необходимо настроить переменную окружения DATABASE_URL с корректным URL для подключения к Neon DB.');
}

if (process.env.DATABASE_PROVIDER !== 'neon') {
  console.log('❌ DATABASE_PROVIDER = ' + (process.env.DATABASE_PROVIDER || 'не установлена') + '. Должно быть значение "neon".');
}

if (process.env.FORCE_NEON_DB !== 'true') {
  console.log('❌ FORCE_NEON_DB = ' + (process.env.FORCE_NEON_DB || 'не установлена') + '. Должно быть значение "true".');
}

console.log('\n====== ПРОВЕРКА ЗАВЕРШЕНА ======');