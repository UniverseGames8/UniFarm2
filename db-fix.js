/**
 * Исправление для подключения к базе данных PostgreSQL
 * Позволяет использовать как Replit PostgreSQL, так и Neon DB
 */

// Настройка переменных окружения для подключения к PostgreSQL
process.env.PGHOST = process.env.PGHOST || 'localhost';
process.env.PGPORT = process.env.PGPORT || 5432;
process.env.PGUSER = process.env.PGUSER || 'postgres';
process.env.PGPASSWORD = process.env.PGPASSWORD || 'postgres';
process.env.PGDATABASE = process.env.PGDATABASE || 'postgres';

// Отключаем использование Unix socket для подключения
process.env.PGSSLMODE = 'prefer';

// Загружаем все нужные переменные окружения из .env файла
import { config } from 'dotenv';
config();

// Логирование настроек подключения
console.log('[DB-Fix] Настройка параметров подключения к PostgreSQL');
console.log(`[DB-Fix] Host: ${process.env.PGHOST}`);
console.log(`[DB-Fix] Port: ${process.env.PGPORT}`);
console.log(`[DB-Fix] Database: ${process.env.PGDATABASE}`);
console.log(`[DB-Fix] User: ${process.env.PGUSER}`);
console.log(`[DB-Fix] SSL Mode: ${process.env.PGSSLMODE}`);