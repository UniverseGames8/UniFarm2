/**
 * Скрипт запуска с модификацией dist/index.js для принудительного использования Neon DB
 * 
 * Этот скрипт:
 * 1. Делает резервную копию dist/index.js
 * 2. Модифицирует его, добавляя код для принудительного использования Neon DB
 * 3. Запускает приложение с модифицированным dist/index.js
 * 4. Восстанавливает оригинальный файл при завершении
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const distIndexPath = path.join(process.cwd(), 'dist', 'index.js');
const backupPath = path.join(process.cwd(), 'dist', 'index.js.backup');

// Устанавливаем переменные окружения
process.env.DATABASE_PROVIDER = 'neon';
process.env.FORCE_NEON_DB = 'true';
process.env.DISABLE_REPLIT_DB = 'true';
process.env.OVERRIDE_DB_PROVIDER = 'neon';

console.log('🚀 Запуск UniFarm с ПРИНУДИТЕЛЬНЫМ использованием Neon DB');
console.log('✅ DATABASE_PROVIDER =', process.env.DATABASE_PROVIDER);
console.log('✅ FORCE_NEON_DB =', process.env.FORCE_NEON_DB);
console.log('✅ DISABLE_REPLIT_DB =', process.env.DISABLE_REPLIT_DB);

function restoreOriginal() {
  try {
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, distIndexPath);
      fs.unlinkSync(backupPath);
      console.log('🔄 Восстановлен оригинальный dist/index.js');
    }
  } catch (err) {
    console.error('❌ Ошибка при восстановлении оригинального файла:', err.message);
  }
}

// Обработка сигналов завершения
process.on('SIGINT', () => {
  console.log('\n👋 Завершение работы по команде пользователя...');
  restoreOriginal();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Завершение работы...');
  restoreOriginal();
  process.exit(0);
});

// Резервное копирование оригинального файла
try {
  if (fs.existsSync(distIndexPath)) {
    console.log('📝 Создание резервной копии dist/index.js...');
    fs.copyFileSync(distIndexPath, backupPath);
    
    // Чтение содержимого файла
    let content = fs.readFileSync(distIndexPath, 'utf8');
    
    // Код для инжекции - принудительное использование Neon DB
    const injectionCode = `
// INJECTED BY run-with-neon.cjs
// Принудительно устанавливаем Neon DB
process.env.DATABASE_PROVIDER = 'neon';
process.env.FORCE_NEON_DB = 'true';
process.env.DISABLE_REPLIT_DB = 'true';
process.env.OVERRIDE_DB_PROVIDER = 'neon';
console.log('[INJECTED] 🚀 ПРИНУДИТЕЛЬНОЕ ИСПОЛЬЗОВАНИЕ NEON DB');
`;
    
    // Находим место для вставки - после импортов, но до основного кода
    const importPattern = /import\s+.*?from\s+['"].*?['"]/g;
    const importMatches = [...content.matchAll(importPattern)];
    
    if (importMatches.length > 0) {
      // Находим последний импорт
      const lastImport = importMatches[importMatches.length - 1];
      const lastImportPos = lastImport.index + lastImport[0].length;
      
      // Вставляем код после последнего импорта
      content = content.slice(0, lastImportPos) + 
                '\n' + injectionCode + 
                content.slice(lastImportPos);
    } else {
      // Если импортов нет, вставляем в начало файла
      content = injectionCode + content;
    }
    
    // Записываем модифицированный файл
    fs.writeFileSync(distIndexPath, content);
    console.log('✅ Файл dist/index.js успешно модифицирован для использования Neon DB');
  } else {
    console.error('❌ Файл dist/index.js не найден!');
    process.exit(1);
  }
} catch (err) {
  console.error('❌ Ошибка при модификации файла:', err.message);
  process.exit(1);
}

// Запускаем приложение
console.log('📦 Запуск приложения с модифицированным файлом...');
const child = spawn('node', ['dist/index.js'], {
  stdio: 'inherit',
  env: process.env
});

// Обработка событий
child.on('close', (code) => {
  console.log(`⚠️ Процесс завершился с кодом ${code}`);
  restoreOriginal();
  process.exit(code);
});

child.on('error', (err) => {
  console.error(`❌ Ошибка при запуске: ${err.message}`);
  restoreOriginal();
  process.exit(1);
});