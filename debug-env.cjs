/**
 * Скрипт для отладки переменных окружения
 */

process.env.DATABASE_PROVIDER = 'neon';
process.env.FORCE_NEON_DB = 'true';
process.env.DISABLE_REPLIT_DB = 'true';
process.env.OVERRIDE_DB_PROVIDER = 'neon';

// Путь к файлу, который импортирует db-selector
const fs = require('fs');
const path = require('path');

function checkFilesForImport(dir, searchPattern) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const file of files) {
    if (file.isDirectory()) {
      if (file.name !== 'node_modules' && file.name !== '.git') {
        checkFilesForImport(path.join(dir, file.name), searchPattern);
      }
      continue;
    }
    
    // Проверяем только JavaScript/TypeScript файлы
    if (!['.js', '.ts', '.cjs', '.mjs'].some(ext => file.name.endsWith(ext))) {
      continue;
    }
    
    const filePath = path.join(dir, file.name);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      
      if (content.includes(searchPattern)) {
        console.log(`🔍 Found in: ${filePath}`);
        
        // Выведем строки с контекстом
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(searchPattern)) {
            console.log(`   Line ${i+1}: ${lines[i].trim()}`);
            
            // Выведем несколько строк до и после для контекста
            const startLine = Math.max(0, i - 5);
            const endLine = Math.min(lines.length - 1, i + 5);
            console.log(`   Context:`);
            for (let j = startLine; j <= endLine; j++) {
              if (j === i) {
                console.log(`   > ${j+1}: ${lines[j].trim()}`);
              } else {
                console.log(`     ${j+1}: ${lines[j].trim()}`);
              }
            }
            console.log();
          }
        }
      }
    } catch (err) {
      console.error(`Ошибка при чтении файла ${filePath}: ${err.message}`);
    }
  }
}

console.log('🔍 Поиск файлов, содержащих db-selector...');
checkFilesForImport('.', 'db-selector');

console.log('\n📊 Текущие переменные окружения:');
console.log('DATABASE_PROVIDER:', process.env.DATABASE_PROVIDER);
console.log('FORCE_NEON_DB:', process.env.FORCE_NEON_DB);
console.log('DISABLE_REPLIT_DB:', process.env.DISABLE_REPLIT_DB);
console.log('OVERRIDE_DB_PROVIDER:', process.env.OVERRIDE_DB_PROVIDER);

console.log('\n📝 Проверка файла .env:');
try {
  const envContent = fs.readFileSync('.env', 'utf8');
  console.log(envContent);
} catch (err) {
  console.error(`Не удалось прочитать .env: ${err.message}`);
}

console.log('\n📝 Проверка файла .env.neon:');
try {
  const envNeonContent = fs.readFileSync('.env.neon', 'utf8');
  console.log(envNeonContent);
} catch (err) {
  console.error(`Не удалось прочитать .env.neon: ${err.message}`);
}

console.log('\n🚀 Проверка настройки в start-unified.js/cjs:');
try {
  let unifiedContent;
  if (fs.existsSync('start-unified.js')) {
    unifiedContent = fs.readFileSync('start-unified.js', 'utf8');
  } else if (fs.existsSync('start-unified.cjs')) {
    unifiedContent = fs.readFileSync('start-unified.cjs', 'utf8');
  }
  
  if (unifiedContent) {
    const dbProviderMatch = unifiedContent.match(/DATABASE_PROVIDER\s*=\s*['"](\w+)['"]/g);
    if (dbProviderMatch) {
      console.log(`Найдены настройки DATABASE_PROVIDER: ${dbProviderMatch.join(', ')}`);
    } else {
      console.log('Настройки DATABASE_PROVIDER не найдены явно');
    }
  }
} catch (err) {
  console.error(`Ошибка при проверке start-unified: ${err.message}`);
}

// Проверяем dist/index.js
console.log('\n🔎 Проверка содержимого dist/index.js:');
try {
  if (fs.existsSync('dist/index.js')) {
    const distContent = fs.readFileSync('dist/index.js', 'utf8');
    const dbProviderMatches = distContent.match(/DATABASE_PROVIDER\s*=\s*['"](\w+)['"]/g);
    if (dbProviderMatches) {
      console.log(`Найдены настройки DATABASE_PROVIDER в собранном файле: ${dbProviderMatches.join(', ')}`);
    } else {
      console.log('Настройки DATABASE_PROVIDER не найдены явно в собранном файле');
    }
    
    // Проверка импорта db-selector в dist/index.js
    if (distContent.includes('db-selector')) {
      console.log('Найден импорт db-selector в собранном файле');
    } else {
      console.log('Импорт db-selector не найден в собранном файле');
    }
  } else {
    console.log('Файл dist/index.js не найден');
  }
} catch (err) {
  console.error(`Ошибка при проверке dist/index.js: ${err.message}`);
}