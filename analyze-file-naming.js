/**
 * Скрипт для анализа именования файлов в проекте
 * 
 * Этот скрипт находит файлы с одинаковым именем, но разным регистром,
 * а также выявляет несоответствия в соглашениях об именовании.
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

// Настройки
const DIRECTORIES_TO_SCAN = [
  './server',
  './shared',
  './client'
];

// Шаблоны именования
const NAMING_PATTERNS = {
  services: {
    pattern: /^[a-z][a-zA-Z0-9]*Service\.ts$/,
    description: 'camelCase + Service.ts'
  },
  controllers: {
    pattern: /^[a-z][a-zA-Z0-9]*Controller\.ts$/,
    description: 'camelCase + Controller.ts'
  },
  utilities: {
    pattern: /^[a-z][a-zA-Z0-9]*\.ts$/,
    description: 'camelCase.ts'
  },
  components: {
    pattern: /^[A-Z][a-zA-Z0-9]*\.tsx$/,
    description: 'PascalCase.tsx'
  },
  types: {
    pattern: /^[A-Z][a-zA-Z0-9]*Types\.ts$/,
    description: 'PascalCase + Types.ts'
  }
};

// Функция для получения всех файлов
function getAllFiles() {
  const allFiles = [];
  
  DIRECTORIES_TO_SCAN.forEach(dir => {
    if (fs.existsSync(dir)) {
      const files = glob.sync(`${dir}/**/*.{ts,tsx,js,jsx}`);
      allFiles.push(...files);
    } else {
      console.warn(`Директория ${dir} не существует, пропускаем.`);
    }
  });
  
  return allFiles;
}

// Функция для поиска конфликтов регистра
function findCaseConflicts(files) {
  const filesByLowercase = {};
  const conflicts = [];
  
  files.forEach(file => {
    const basename = path.basename(file);
    const dirname = path.dirname(file);
    const lowercaseBasename = basename.toLowerCase();
    const key = path.join(dirname, lowercaseBasename);
    
    if (!filesByLowercase[key]) {
      filesByLowercase[key] = [];
    }
    
    filesByLowercase[key].push(file);
  });
  
  // Найти конфликты
  Object.keys(filesByLowercase).forEach(key => {
    if (filesByLowercase[key].length > 1) {
      conflicts.push({
        files: filesByLowercase[key],
        lowercasePath: key
      });
    }
  });
  
  return conflicts;
}

// Функция для проверки соблюдения соглашений об именовании
function checkNamingConventions(files) {
  const violations = [];
  
  files.forEach(file => {
    const basename = path.basename(file);
    const dirname = path.dirname(file);
    
    // Проверить соответствие шаблонам именования
    if (dirname.includes('/services/') && !NAMING_PATTERNS.services.pattern.test(basename)) {
      violations.push({
        file,
        expected: NAMING_PATTERNS.services.description,
        actual: basename
      });
    } 
    else if (dirname.includes('/controllers/') && !NAMING_PATTERNS.controllers.pattern.test(basename)) {
      violations.push({
        file,
        expected: NAMING_PATTERNS.controllers.description,
        actual: basename
      });
    }
    else if (dirname.includes('/utils/') && !NAMING_PATTERNS.utilities.pattern.test(basename)) {
      violations.push({
        file,
        expected: NAMING_PATTERNS.utilities.description,
        actual: basename
      });
    }
    else if (dirname.includes('/components/') && basename.endsWith('.tsx') && !NAMING_PATTERNS.components.pattern.test(basename)) {
      violations.push({
        file,
        expected: NAMING_PATTERNS.components.description,
        actual: basename
      });
    }
    else if (basename.includes('Types.ts') && !NAMING_PATTERNS.types.pattern.test(basename)) {
      violations.push({
        file,
        expected: NAMING_PATTERNS.types.description,
        actual: basename
      });
    }
  });
  
  return violations;
}

// Основная функция
function analyzeFileNaming() {
  console.log('Анализ именования файлов в проекте...\n');
  
  const allFiles = getAllFiles();
  console.log(`Найдено ${allFiles.length} файлов для анализа.\n`);
  
  // Найти конфликты регистра
  const caseConflicts = findCaseConflicts(allFiles);
  console.log(`\n=== Конфликты регистра (${caseConflicts.length}) ===`);
  
  if (caseConflicts.length === 0) {
    console.log('Конфликтов регистра не обнаружено.');
  } else {
    caseConflicts.forEach((conflict, index) => {
      console.log(`\n${index + 1}. Конфликт для пути (в нижнем регистре): ${conflict.lowercasePath}`);
      console.log('   Конфликтующие файлы:');
      conflict.files.forEach(file => {
        console.log(`   - ${file}`);
      });
    });
  }
  
  // Проверить соблюдение соглашений об именовании
  const namingViolations = checkNamingConventions(allFiles);
  console.log(`\n=== Нарушения соглашений об именовании (${namingViolations.length}) ===`);
  
  if (namingViolations.length === 0) {
    console.log('Нарушений соглашений об именовании не обнаружено.');
  } else {
    namingViolations.forEach((violation, index) => {
      console.log(`\n${index + 1}. Файл: ${violation.file}`);
      console.log(`   Ожидаемый формат: ${violation.expected}`);
      console.log(`   Текущее имя: ${violation.actual}`);
    });
  }
  
  console.log('\n=== Общий итог ===');
  console.log(`Всего файлов: ${allFiles.length}`);
  console.log(`Конфликтов регистра: ${caseConflicts.length}`);
  console.log(`Нарушений соглашений об именовании: ${namingViolations.length}`);
  
  // Создать план действий
  if (caseConflicts.length > 0 || namingViolations.length > 0) {
    generateActionPlan(caseConflicts, namingViolations);
  }
}

// Функция для генерации плана действий
function generateActionPlan(caseConflicts, namingViolations) {
  console.log('\n=== План действий ===');
  
  // План для разрешения конфликтов регистра
  if (caseConflicts.length > 0) {
    console.log('\n1. Разрешение конфликтов регистра:');
    caseConflicts.forEach((conflict, index) => {
      const files = conflict.files;
      const recommendedName = path.basename(files[0]).toLowerCase(); // Используем нижний регистр как стандарт
      
      console.log(`\n   ${index + 1}.1. Конфликт: ${conflict.lowercasePath}`);
      console.log(`      Рекомендуемое имя файла: ${recommendedName}`);
      console.log('      Шаги:');
      
      files.forEach((file, fileIndex) => {
        if (path.basename(file) !== recommendedName) {
          console.log(`      - Переименовать ${file} в ${path.join(path.dirname(file), recommendedName)}`);
          console.log(`      - Обновить все импорты, ссылающиеся на ${file}`);
        }
      });
    });
  }
  
  // План для исправления нарушений соглашений об именовании
  if (namingViolations.length > 0) {
    console.log('\n2. Исправление нарушений соглашений об именовании:');
    namingViolations.forEach((violation, index) => {
      const currentName = path.basename(violation.file);
      let recommendedName = '';
      
      // Генерация рекомендуемого имени на основе ожидаемого формата
      if (violation.expected === NAMING_PATTERNS.services.description) {
        recommendedName = currentName.charAt(0).toLowerCase() + currentName.slice(1);
        if (!recommendedName.endsWith('Service.ts')) {
          recommendedName = recommendedName.replace(/\.ts$/, 'Service.ts');
        }
      } 
      else if (violation.expected === NAMING_PATTERNS.controllers.description) {
        recommendedName = currentName.charAt(0).toLowerCase() + currentName.slice(1);
        if (!recommendedName.endsWith('Controller.ts')) {
          recommendedName = recommendedName.replace(/\.ts$/, 'Controller.ts');
        }
      }
      else if (violation.expected === NAMING_PATTERNS.utilities.description) {
        recommendedName = currentName.charAt(0).toLowerCase() + currentName.slice(1);
      }
      else if (violation.expected === NAMING_PATTERNS.components.description) {
        recommendedName = currentName.charAt(0).toUpperCase() + currentName.slice(1);
      }
      else if (violation.expected === NAMING_PATTERNS.types.description) {
        recommendedName = currentName.charAt(0).toUpperCase() + currentName.slice(1);
        if (!recommendedName.endsWith('Types.ts')) {
          recommendedName = recommendedName.replace(/\.ts$/, 'Types.ts');
        }
      }
      
      console.log(`\n   ${index + 1}.1. Файл: ${violation.file}`);
      console.log(`      Текущее имя: ${currentName}`);
      console.log(`      Рекомендуемое имя: ${recommendedName}`);
      console.log('      Шаги:');
      console.log(`      - Переименовать ${violation.file} в ${path.join(path.dirname(violation.file), recommendedName)}`);
      console.log(`      - Обновить все импорты, ссылающиеся на ${violation.file}`);
    });
  }
  
  console.log('\n3. Общие рекомендации:');
  console.log('   - Выполнять переименование поэтапно, начиная с файлов с наименьшим количеством зависимостей');
  console.log('   - Тестировать приложение после каждого этапа переименования');
  console.log('   - Обновить tsconfig.json, добавив или проверив настройку "forceConsistentCasingInFileNames": true');
  console.log('   - Добавить проверку линтером для обеспечения соблюдения соглашений об именовании в будущем');
}

// Запуск анализа
analyzeFileNaming();