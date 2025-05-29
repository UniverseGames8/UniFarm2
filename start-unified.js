#!/usr/bin/env node

/**
 * Unified entry point for production deployment
 * Запускає сервер з підключенням до вашої production бази ep-lucky-boat-a463bggt
 */

console.log('🚀 [UNIFIED START] Запуск UniFarm production сервера...');

// СИСТЕМНЕ ПЕРЕНАПРАВЛЕННЯ НА ПРАВИЛЬНУ БАЗУ
process.env.NODE_ENV = 'production';
process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_SpgdNBV70WKl@ep-lucky-boat-a463bggt-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';
process.env.PGHOST = 'ep-lucky-boat-a463bggt-pooler.us-east-1.aws.neon.tech';
process.env.PGUSER = 'neondb_owner';
process.env.PGPASSWORD = 'npg_SpgdNBV70WKl';
process.env.PGDATABASE = 'neondb';
process.env.PGPORT = '5432';
process.env.DATABASE_PROVIDER = 'neon';
process.env.FORCE_NEON_DB = 'true';

// Переконуємось що порт встановлений
if (!process.env.PORT) {
  process.env.PORT = '3000';
}

console.log('✅ [UNIFIED START] Production змінні встановлені');
console.log('🎯 [UNIFIED START] Використовуємо Neon DB:', process.env.FORCE_NEON_DB);
console.log('📡 [UNIFIED START] Порт:', process.env.PORT);

// Запускаємо основний сервер з dist/ після збірки
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

if (fs.existsSync('./dist/index.js')) {
  console.log('🎯 [UNIFIED START] Запуск зібраної версії з dist/');
  await import('./dist/index.js');
} else {
  console.log('🔄 [UNIFIED START] Запуск development версії');
  await import('./server/index.js');
}