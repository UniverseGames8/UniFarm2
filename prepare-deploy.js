/**
 * Скрипт для подготовки проекта к деплою
 * Запускает сборку проекта перед деплоем
 */

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('===================================');
console.log('ПОДГОТОВКА ПРОЕКТА К ДЕПЛОЮ');
console.log('===================================');

// Запускаем сборку проекта
console.log('Запуск сборки проекта (npm run build)...');

const buildProcess = spawnSync('npm', ['run', 'build'], {
  stdio: 'inherit',
  shell: false
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
console.log('===================================');
console.log('ПРОЕКТ ГОТОВ К ДЕПЛОЮ');
console.log('===================================');