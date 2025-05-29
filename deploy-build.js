/**
 * Скрипт для использования в процессе деплоя Replit
 * Выполняет сборку проекта перед запуском
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('===================================');
console.log('СБОРКА ПРОЕКТА ДЛЯ ДЕПЛОЯ');
console.log('===================================');

// Устанавливаем NODE_ENV=production для корректной сборки
process.env.NODE_ENV = 'production';

// Запускаем сборку проекта
console.log('Запуск сборки проекта (npm run build)...');
const buildProcess = spawnSync('npm', ['run', 'build'], {
  stdio: 'inherit',
  env: {...process.env, NODE_ENV: 'production'}
});

if (buildProcess.status !== 0) {
  console.error('❌ Ошибка при сборке проекта!');
  process.exit(1);
}

console.log('✅ Проект успешно собран');

// Проверяем наличие собранных файлов
if (!fs.existsSync('./dist/public')) {
  console.error('❌ Не найдена директория dist/public');
  process.exit(1);
}

if (!fs.existsSync('./dist/index.js')) {
  console.error('❌ Не найден файл dist/index.js');
  process.exit(1);
}

console.log('✅ Проверка файлов сборки успешна');

// Запускаем скрипт start-unified.cjs
console.log('Запуск скрипта start-unified.cjs...');
const startProcess = spawnSync('node', ['start-unified.cjs'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production',
    DATABASE_PROVIDER: 'neon',
    FORCE_NEON_DB: 'true',
    DISABLE_REPLIT_DB: 'true'
  }
});

// Проверяем статус завершения
process.exit(startProcess.status);