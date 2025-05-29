/**
 * Скрипт для проверки экспортов перед деплоем
 * 
 * Проверяет наличие всех необходимых экспортов в модулях
 * для успешного деплоя приложения
 */

// Импортируем path для работы с путями
const path = require('path');
const fs = require('fs');

// Функция для проверки TypeScript экспортов
function checkTsExports(filePath, requiredExports) {
  console.log(`\nПроверка файла: ${filePath}`);
  
  try {
    // Читаем содержимое файла
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Проверяем каждый экспорт
    const missingExports = [];
    
    for (const exp of requiredExports) {
      // Находим строки с экспортами
      const exportPattern1 = new RegExp(`export\\s+const\\s+${exp}\\s*=`, 'm');
      const exportPattern2 = new RegExp(`export\\s+function\\s+${exp}\\s*\\(`, 'm');
      const exportPattern3 = new RegExp(`export\\s+enum\\s+${exp}\\s+`, 'm');
      const exportPattern4 = new RegExp(`export\\s+\\{[^}]*\\b${exp}\\b[^}]*\\}`, 'm');
      
      if (!exportPattern1.test(content) && 
          !exportPattern2.test(content) && 
          !exportPattern3.test(content) &&
          !exportPattern4.test(content)) {
        missingExports.push(exp);
      }
    }
    
    if (missingExports.length === 0) {
      console.log(`✅ Все необходимые экспорты найдены`);
    } else {
      console.log(`❌ Отсутствуют экспорты: ${missingExports.join(', ')}`);
    }
    
    return missingExports.length === 0;
  } catch (error) {
    console.error(`❌ Ошибка при проверке файла ${filePath}:`, error.message);
    return false;
  }
}

// Проверяем экспорты в db-selector.ts
const dbSelectorPath = path.join(__dirname, 'server', 'db-selector.ts');
const dbSelectorRequiredExports = [
  'pool', 
  'db', 
  'wrappedPool', 
  'testDatabaseConnection', 
  'dbType', 
  'DatabaseType',
  'dbConnectionStatus',
  'isTablePartitioned'
];

const dbSelectorExportsOk = checkTsExports(dbSelectorPath, dbSelectorRequiredExports);

// Проверяем экспорты в db.ts
const dbPath = path.join(__dirname, 'server', 'db.ts');
const dbRequiredExports = [
  'pool', 
  'db', 
  'wrappedPool', 
  'testDatabaseConnection', 
  'dbType', 
  'DatabaseType',
  'dbConnectionStatus',
  'isTablePartitioned'
];

const dbExportsOk = checkTsExports(dbPath, dbRequiredExports);

// Проверяем, что start-unified.cjs существует
const startScriptPath = path.join(__dirname, 'start-unified.cjs');
let startScriptExists = false;

try {
  startScriptExists = fs.existsSync(startScriptPath);
  console.log(`\nПроверка файла: ${startScriptPath}`);
  if (startScriptExists) {
    console.log(`✅ Файл start-unified.cjs существует`);
  } else {
    console.log(`❌ Файл start-unified.cjs не найден`);
  }
} catch (error) {
  console.error(`❌ Ошибка при проверке файла ${startScriptPath}:`, error.message);
}

// Итоговый результат
console.log('\n==============================================');
console.log('             РЕЗУЛЬТАТЫ ПРОВЕРКИ              ');
console.log('==============================================');

if (dbSelectorExportsOk && dbExportsOk && startScriptExists) {
  console.log('✅ Все проверки пройдены успешно!');
  console.log('   Проект готов к деплою');
} else {
  console.log('❌ Некоторые проверки не пройдены.');
  console.log('   Исправьте ошибки перед деплоем');
}

console.log('\nРекомендуемая команда для деплоя:');
console.log('PORT=3000 NODE_ENV=production DATABASE_PROVIDER=neon node start-unified.cjs');
console.log('==============================================');