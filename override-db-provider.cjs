/**
 * Временное решение для запуска приложения с Neon DB
 * Модифицирует поведение db-selector-new.ts при запуске
 */

const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

// Модификация файла перед запуском
console.log('\n🚀 Запуск временного модуля для принудительного использования Neon DB\n');

// Устанавливаем переменные окружения для всех порожденных процессов
process.env.DATABASE_PROVIDER = 'neon';
process.env.FORCE_NEON_DB = 'true';
process.env.DISABLE_REPLIT_DB = 'true';
process.env.OVERRIDE_DB_PROVIDER = 'neon';
process.env.USE_LOCAL_DB_ONLY = 'false';
process.env.NODE_ENV = 'production';

// Временная модификация файла db-selector-new.ts, если он существует
const dbSelectorPath = path.join(process.cwd(), 'server', 'db-selector-new.ts');
let originalContent = '';
let isModified = false;

function modifyDbSelector() {
  try {
    if (fs.existsSync(dbSelectorPath)) {
      // Чтение оригинального содержимого
      originalContent = fs.readFileSync(dbSelectorPath, 'utf8');
      
      // Проверяем, нужна ли модификация
      if (originalContent.includes('// ФОРСИРОВАННОЕ ИСПОЛЬЗОВАНИЕ NEON DB [OVERRIDE]')) {
        console.log('⚠️ Файл уже был модифицирован');
        return;
      }
      
      // Код, который заменит функцию determineProvider
      const replacementCode = `
// ФОРСИРОВАННОЕ ИСПОЛЬЗОВАНИЕ NEON DB [OVERRIDE]
const determineProvider = (): DatabaseProvider => {
  console.log('[DB-Selector] 🚀 ФОРСИРОВАНИЕ NEON DB (override-db-provider.cjs)');
  return 'neon';
};`;
      
      // Ищем функцию determineProvider
      const functionPattern = /const determineProvider = \(\): DatabaseProvider => \{[\s\S]*?\};/;
      
      // Заменяем функцию
      const modifiedContent = originalContent.replace(functionPattern, replacementCode);
      
      // Записываем модифицированный файл
      fs.writeFileSync(dbSelectorPath, modifiedContent);
      isModified = true;
      
      console.log('✅ Файл db-selector-new.ts успешно модифицирован!');
      
      // На всякий случай перекомпилируем
      try {
        console.log('🔧 Перекомпиляция исходных файлов...');
        child_process.execSync('npm run build', { stdio: 'inherit' });
        console.log('✅ Перекомпиляция успешно завершена');
      } catch (err) {
        console.error('⚠️ Ошибка перекомпиляции, продолжаем без неё:', err.message);
      }
    } else {
      console.error('⚠️ Файл db-selector-new.ts не найден!');
    }
  } catch (error) {
    console.error('❌ Ошибка при модификации файла:', error.message);
  }
}

// Восстановление оригинального файла
function restoreOriginal() {
  if (isModified && originalContent) {
    try {
      fs.writeFileSync(dbSelectorPath, originalContent);
      console.log('\n🔄 Восстановлен оригинальный файл db-selector-new.ts');
    } catch (error) {
      console.error('❌ Ошибка при восстановлении оригинального файла:', error.message);
    }
  }
}

// Запуск приложения
function runApp() {
  console.log('📦 Запуск приложения...');
  
  // Используем spawn для запуска node dist/index.js
  const appProcess = child_process.spawn('node', ['dist/index.js'], {
    stdio: 'inherit',
    env: process.env
  });
  
  // Обработка завершения
  appProcess.on('close', (code) => {
    console.log(`\n⚠️ Процесс завершился с кодом ${code}`);
    restoreOriginal();
    process.exit(code);
  });
  
  // Обработка ошибок
  appProcess.on('error', (error) => {
    console.error(`\n❌ Ошибка при запуске приложения: ${error.message}`);
    restoreOriginal();
    process.exit(1);
  });
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

// Запуск последовательности действий
modifyDbSelector();
runApp();