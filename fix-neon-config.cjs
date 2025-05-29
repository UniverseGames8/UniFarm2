/**
 * Скрипт для диагностики и исправления настройки Neon DB
 * 
 * Этот скрипт проверяет текущую конфигурацию и пытается найти проблемы,
 * которые могут приводить к использованию Replit PostgreSQL вместо Neon DB.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Цвета для вывода
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

console.log(`${colors.blue}==========================================`);
console.log(`= ДИАГНОСТИКА НАСТРОЙКИ NEON DB =`);
console.log(`==========================================${colors.reset}`);

// Проверяем существование и содержимое .env.neon
console.log(`${colors.blue}[1] Проверка файла .env.neon${colors.reset}`);
if (!fs.existsSync('.env.neon')) {
  console.log(`${colors.red}❌ Файл .env.neon не найден!${colors.reset}`);
  process.exit(1);
}

// Читаем содержимое .env.neon
const envNeonContent = fs.readFileSync('.env.neon', 'utf-8');
console.log(`${colors.green}✅ Файл .env.neon найден${colors.reset}`);

// Проверяем DATABASE_URL
const dbUrlMatch = envNeonContent.match(/DATABASE_URL=(.+)/);
if (!dbUrlMatch) {
  console.log(`${colors.red}❌ DATABASE_URL не найден в .env.neon${colors.reset}`);
} else {
  const dbUrl = dbUrlMatch[1];
  if (dbUrl.includes('neon.tech')) {
    console.log(`${colors.green}✅ DATABASE_URL указывает на Neon DB: ${dbUrl.replace(/:[^:]*@/, ':***@')}${colors.reset}`);
  } else {
    console.log(`${colors.red}❌ DATABASE_URL не указывает на Neon DB: ${dbUrl}${colors.reset}`);
  }
}

// Проверяем флаги принудительного использования Neon DB
console.log(`${colors.blue}[2] Проверка флагов принудительного использования Neon DB${colors.reset}`);
const forceNeonDb = envNeonContent.includes('FORCE_NEON_DB=true');
const disableReplitDb = envNeonContent.includes('DISABLE_REPLIT_DB=true');
const dbProvider = envNeonContent.match(/DATABASE_PROVIDER=(\w+)/)?.[1];
const overrideProvider = envNeonContent.match(/OVERRIDE_DB_PROVIDER=(\w+)/)?.[1];

console.log(`FORCE_NEON_DB: ${forceNeonDb ? colors.green + '✅ true' : colors.red + '❌ false'}${colors.reset}`);
console.log(`DISABLE_REPLIT_DB: ${disableReplitDb ? colors.green + '✅ true' : colors.red + '❌ false'}${colors.reset}`);
console.log(`DATABASE_PROVIDER: ${dbProvider === 'neon' ? colors.green + '✅ neon' : colors.red + '❌ ' + dbProvider}${colors.reset}`);
console.log(`OVERRIDE_DB_PROVIDER: ${overrideProvider === 'neon' ? colors.green + '✅ neon' : colors.red + '❌ ' + overrideProvider}${colors.reset}`);

// Проверяем файл server/db-selector-new.ts
console.log(`${colors.blue}[3] Проверка файла server/db-selector-new.ts${colors.reset}`);
const dbSelectorPath = path.join('server', 'db-selector-new.ts');
if (!fs.existsSync(dbSelectorPath)) {
  console.log(`${colors.red}❌ Файл ${dbSelectorPath} не найден!${colors.reset}`);
} else {
  const dbSelectorContent = fs.readFileSync(dbSelectorPath, 'utf-8');
  console.log(`${colors.green}✅ Файл ${dbSelectorPath} найден${colors.reset}`);
  
  // Проверяем ключевые моменты в файле db-selector-new.ts
  const forcedNeonLines = [
    'return \'neon\';',
    'currentDatabaseProvider = \'neon\';',
    'ПРИНУДИТЕЛЬНОЕ ИСПОЛЬЗОВАНИЕ NEON DB'
  ];
  
  let allLinesFound = true;
  let missingLines = [];
  
  forcedNeonLines.forEach(line => {
    if (!dbSelectorContent.includes(line)) {
      allLinesFound = false;
      missingLines.push(line);
    }
  });
  
  if (allLinesFound) {
    console.log(`${colors.green}✅ Файл ${dbSelectorPath} содержит все необходимые строки для принудительного использования Neon DB${colors.reset}`);
  } else {
    console.log(`${colors.red}❌ Файл ${dbSelectorPath} не содержит следующие строки:${colors.reset}`);
    missingLines.forEach(line => {
      console.log(`   - ${line}`);
    });
  }
}

// Проверяем файл server/index.ts на предмет импорта db-selector-new
console.log(`${colors.blue}[4] Проверка импорта db-selector-new в server/index.ts${colors.reset}`);
const indexPath = path.join('server', 'index.ts');
if (!fs.existsSync(indexPath)) {
  console.log(`${colors.red}❌ Файл ${indexPath} не найден!${colors.reset}`);
} else {
  const indexContent = fs.readFileSync(indexPath, 'utf-8');
  console.log(`${colors.green}✅ Файл ${indexPath} найден${colors.reset}`);
  
  if (indexContent.includes('import { setDatabaseProvider } from "./db-selector-new"')) {
    console.log(`${colors.green}✅ Файл ${indexPath} импортирует setDatabaseProvider из db-selector-new${colors.reset}`);
  } else {
    console.log(`${colors.red}❌ Файл ${indexPath} не импортирует setDatabaseProvider из db-selector-new${colors.reset}`);
  }
}

// Проверяем файл server/db.ts (Neon DB)
console.log(`${colors.blue}[5] Проверка файла server/db.ts (Neon DB)${colors.reset}`);
const dbPath = path.join('server', 'db.ts');
if (!fs.existsSync(dbPath)) {
  console.log(`${colors.red}❌ Файл ${dbPath} не найден!${colors.reset}`);
} else {
  const dbContent = fs.readFileSync(dbPath, 'utf-8');
  console.log(`${colors.green}✅ Файл ${dbPath} найден${colors.reset}`);
  
  if (dbContent.includes('console.log(\'[DB-NEON] 🚀 Инициализация Neon DB соединения\');')) {
    console.log(`${colors.green}✅ Файл ${dbPath} содержит строку инициализации Neon DB${colors.reset}`);
  } else {
    console.log(`${colors.red}❌ Файл ${dbPath} не содержит строку инициализации Neon DB${colors.reset}`);
  }
}

// Проверка, не перезаписывает ли какой-то другой файл настройки
console.log(`${colors.blue}[6] Проверка других селекторов базы данных${colors.reset}`);
const otherDbSelectors = [
  'db-selector.ts',
  'db-selector.js',
  'db-override.ts',
  'db-override.js'
];

otherDbSelectors.forEach(file => {
  const filePath = path.join('server', file);
  if (fs.existsSync(filePath)) {
    console.log(`${colors.yellow}⚠️ Найден другой файл селектора базы данных: ${filePath}${colors.reset}`);
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Проверяем, импортируется ли этот файл в server/index.ts
    if (indexPath && fs.existsSync(indexPath)) {
      const indexContent = fs.readFileSync(indexPath, 'utf-8');
      if (indexContent.includes(`import { setDatabaseProvider } from "./${file.replace(/\.[^.]+$/, '')}"`)) {
        console.log(`${colors.red}❌ Этот файл импортируется в server/index.ts вместо db-selector-new.ts!${colors.reset}`);
      }
    }
  }
});

// Итоговый вывод и рекомендации
console.log(`${colors.blue}==========================================`);
console.log(`= ИТОГИ ДИАГНОСТИКИ =`);
console.log(`==========================================${colors.reset}`);

// Вывод рекомендаций
console.log(`${colors.yellow}Рекомендации по исправлению:${colors.reset}`);
console.log(`1. Проверьте, что правильно загружаются переменные окружения из .env.neon`);
console.log(`2. Убедитесь, что start-with-neon-db.js использует файл dist/index.js, который был скомпилирован с последними изменениями`);
console.log(`3. Проверьте, нет ли ошибок компиляции TypeScript при сборке приложения`);
console.log(`4. Если необходимо, выполните команду npm run build для перекомпиляции исходного кода`);
console.log(`5. Проверьте, не перезаписываются ли настройки DATABASE_PROVIDER в каком-то другом месте кода`);

console.log(`${colors.blue}===========================================${colors.reset}`);