#!/usr/bin/env node

/**
 * Скрипт для запуска UniFarm в продакшн-режиме
 * Автоматически сгенерирован для исправления ошибки "Service Unavailable"
 */

// Установка критически важных переменных окружения
process.env.DATABASE_PROVIDER = 'neon';
process.env.FORCE_NEON_DB = 'true';
process.env.DISABLE_REPLIT_DB = 'true';
process.env.OVERRIDE_DB_PROVIDER = 'neon';
process.env.NODE_ENV = 'production';
process.env.SKIP_PARTITION_CREATION = 'true';
process.env.IGNORE_PARTITION_ERRORS = 'true';
process.env.PORT = process.env.PORT || '3000';

// Запуск основного скрипта
require('./start-unified.cjs');
