/**
 * Скрипт для подготовки деплоя UniFarm
 * Исправляет проблему с ошибкой "Service Unavailable"
 * 
 * Запускать перед деплоем: node deploy-fix.js
 */

import fs from 'fs';
import path from 'path';

console.log('=============================================');
console.log('UNIFARM DEPLOYMENT FIX - ПОДГОТОВКА К ДЕПЛОЮ');
console.log('=============================================');

// Проверяем наличие переменных окружения
const criticalEnvVars = [
  'DATABASE_URL',
  'NEON_DB_URL',
  'TELEGRAM_BOT_TOKEN',
  'SESSION_SECRET'
];

const missingVars = criticalEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('❌ ОШИБКА: Отсутствуют критические переменные окружения:');
  missingVars.forEach(varName => console.error(`   - ${varName}`));
  console.log('\nПеред продолжением добавьте эти переменные в реплит!');
  process.exit(1);
}

console.log('✅ Все критические переменные окружения установлены');

// Создаем файл для запуска приложения в деплое
const deployFileContent = `#!/usr/bin/env node

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
`;

// Записываем файл
fs.writeFileSync('deploy-launcher.cjs', deployFileContent);
fs.chmodSync('deploy-launcher.cjs', '755'); // Делаем файл исполняемым

console.log('✅ Создан файл deploy-launcher.cjs для запуска в деплое');

// Проверяем наличие собранных файлов
if (!fs.existsSync('./dist/index.js')) {
  console.log('⚠️ Сборка проекта не найдена');
  console.log('   Запустите npm run build перед деплоем');
} else {
  console.log('✅ Сборка проекта найдена');
}

console.log('\n=============================================');
console.log('ИНСТРУКЦИИ ПО ДЕПЛОЮ:');
console.log('=============================================');
console.log('1. Запустите: npm run build');
console.log('2. При деплое используйте следующую команду:');
console.log('   node deploy-launcher.cjs');
console.log('=============================================');
console.log('\nДополнительные рекомендации:');
console.log('- Убедитесь, что все переменные окружения добавлены в реплит');
console.log('- После деплоя проверьте логи для выявления ошибок');
console.log('=============================================');