#!/usr/bin/env node

/**
 * Скрипт для автоматического переименования файлов
 * Помогает переименовывать файлы в соответствии с соглашением об именовании
 * и автоматически обновляет импорты
 */

import { readdirSync, statSync, renameSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';

// Получаем текущую директорию
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Проверяет соответствие имени файла правилам именования
 */
function checkNamingConvention(filePath) {
  const fileName = basename(filePath);
  const ext = extname(fileName);
  const name = fileName.replace(ext, '');
  
  // Игнорируем временные файлы и системные файлы
  if (fileName.startsWith('.') || fileName.startsWith('_')) {
    return { valid: true, suggestedName: null };
  }
  
  // Проверяем на соответствие правилам в зависимости от пути
  if (filePath.includes('/services/') && ext === '.ts') {
    // Сервисы должны быть в camelCase и заканчиваться на Service.ts
    if (name.endsWith('Service') && name[0] === name[0].toLowerCase()) {
      return { valid: true, suggestedName: null };
    } else if (name.endsWith('Service') && name[0] === name[0].toUpperCase()) {
      // Если имя содержит Service, но начинается с большой буквы
      const camelCaseName = name[0].toLowerCase() + name.slice(1);
      return { valid: false, suggestedName: camelCaseName + ext };
    } else if (!name.endsWith('Service')) {
      // Если имя не содержит Service
      const camelCaseName = name[0].toLowerCase() + name.slice(1) + 'Service';
      return { valid: false, suggestedName: camelCaseName + ext };
    }
  } else if (filePath.includes('/controllers/') && ext === '.ts') {
    // Контроллеры должны быть в camelCase и заканчиваться на Controller.ts
    if (name.endsWith('Controller') && name[0] === name[0].toLowerCase()) {
      return { valid: true, suggestedName: null };
    } else if (name.endsWith('Controller') && name[0] === name[0].toUpperCase()) {
      // Если имя содержит Controller, но начинается с большой буквы
      const camelCaseName = name[0].toLowerCase() + name.slice(1);
      return { valid: false, suggestedName: camelCaseName + ext };
    } else if (!name.endsWith('Controller')) {
      // Если имя не содержит Controller
      const camelCaseName = name[0].toLowerCase() + name.slice(1) + 'Controller';
      return { valid: false, suggestedName: camelCaseName + ext };
    }
  } else if (filePath.includes('/utils/') && ext === '.ts') {
    // Утилиты должны быть в camelCase
    if (name[0] === name[0].toLowerCase()) {
      return { valid: true, suggestedName: null };
    } else {
      const camelCaseName = name[0].toLowerCase() + name.slice(1);
      return { valid: false, suggestedName: camelCaseName + ext };
    }
  } else if ((filePath.includes('/components/') || filePath.includes('/views/')) && 
             (ext === '.tsx' || ext === '.jsx')) {
    // React компоненты должны быть в PascalCase
    if (name[0] === name[0].toUpperCase()) {
      return { valid: true, suggestedName: null };
    } else {
      const pascalCaseName = name[0].toUpperCase() + name.slice(1);
      return { valid: false, suggestedName: pascalCaseName + ext };
    }
  } else if (filePath.includes('/types/') && ext === '.ts') {
    // Типы должны быть в PascalCase
    if (name[0] === name[0].toUpperCase()) {
      return { valid: true, suggestedName: null };
    } else {
      const pascalCaseName = name[0].toUpperCase() + name.slice(1);
      return { valid: false, suggestedName: pascalCaseName + ext };
    }
  }
  
  // Для остальных файлов считаем, что правила именования соблюдены
  return { valid: true, suggestedName: null };
}

/**
 * Рекурсивно находит все файлы в указанной директории
 */
function findFiles(dir, excludePattern = /node_modules|\.git|dist|\.next/) {
  const results = [];
  
  try {
    const list = readdirSync(dir);
    
    for (const file of list) {
      const filePath = join(dir, file);
      
      if (excludePattern.test(filePath)) {
        continue;
      }
      
      const stat = statSync(filePath);
      
      if (stat && stat.isDirectory()) {
        results.push(...findFiles(filePath, excludePattern));
      } else {
        results.push(filePath);
      }
    }
  } catch (err) {
    console.error(`Ошибка чтения директории ${dir}:`, err);
  }
  
  return results;
}

/**
 * Обновляет импорты после переименования файла
 */
function updateImports(files, oldFile, newFile) {
  const oldBaseName = basename(oldFile);
  const newBaseName = basename(newFile);
  
  // Готовим пути импортов
  const oldPathNoExt = oldFile.replace(/\.[^/.]+$/, '');
  const newPathNoExt = newFile.replace(/\.[^/.]+$/, '');
  
  // Различные паттерны для поиска импортов
  const patterns = [
    new RegExp(`import [^;]* from ['"]([^\'"]*/${oldBaseName.replace(/\.[^/.]+$/, '')})['"]`, 'g'),
    new RegExp(`import [^;]* from ['"]([^\'"]*${oldPathNoExt})['"]`, 'g'),
    new RegExp(`require\\(['"]([^\'"]*${oldPathNoExt})['"]\\)`, 'g')
  ];
  
  let updatedCount = 0;
  
  for (const file of files) {
    try {
      let content = readFileSync(file, 'utf8');
      let updated = false;
      
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          content = content.replace(pattern, (match, path) => {
            updated = true;
            return match.replace(path, path.replace(oldPathNoExt, newPathNoExt));
          });
        }
      }
      
      if (updated) {
        writeFileSync(file, content, 'utf8');
        updatedCount++;
        console.log(`Обновлены импорты в файле: ${file}`);
      }
    } catch (err) {
      console.error(`Ошибка обновления импортов в файле ${file}:`, err);
    }
  }
  
  return updatedCount;
}

/**
 * Переименовывает файл и обновляет импорты
 */
function renameFile(oldPath, newPath, files) {
  if (oldPath === newPath) {
    return;
  }
  
  try {
    renameSync(oldPath, newPath);
    console.log(`\x1b[32m✓\x1b[0m Файл переименован: ${oldPath} -> ${newPath}`);
    
    // Обновляем импорты
    const updatedCount = updateImports(files, oldPath, newPath);
    console.log(`  Обновлено импортов: ${updatedCount}`);
  } catch (err) {
    console.error(`\x1b[31m✗\x1b[0m Не удалось переименовать файл ${oldPath}:`, err);
  }
}

/**
 * Основная функция
 */
async function main() {
  console.log('Поиск файлов для проверки...');
  
  // Находим все файлы
  const serverFiles = findFiles(resolve(__dirname, 'server'));
  const sharedFiles = findFiles(resolve(__dirname, 'shared'));
  const clientFiles = findFiles(resolve(__dirname, 'client'));
  
  const allFiles = [...serverFiles, ...sharedFiles, ...clientFiles];
  
  console.log(`Найдено ${allFiles.length} файлов`);
  
  // Проверяем именование файлов
  const filesToRename = [];
  
  for (const file of allFiles) {
    const { valid, suggestedName } = checkNamingConvention(file);
    
    if (!valid && suggestedName) {
      filesToRename.push({
        oldPath: file,
        newPath: join(dirname(file), suggestedName)
      });
    }
  }
  
  if (filesToRename.length === 0) {
    console.log('\x1b[32m✓\x1b[0m Все файлы соответствуют соглашению об именовании');
    return;
  }
  
  console.log(`\nНайдено ${filesToRename.length} файлов, которые нужно переименовать:`);
  
  // Выводим список файлов для переименования
  filesToRename.forEach(({ oldPath, newPath }, index) => {
    console.log(`${index + 1}. ${basename(oldPath)} -> ${basename(newPath)}`);
    console.log(`   ${oldPath}`);
  });
  
  console.log('\nАвтоматическое переименование файлов...');
  
  // Переименовываем файлы и обновляем импорты
  for (const { oldPath, newPath } of filesToRename) {
    renameFile(oldPath, newPath, allFiles);
  }
  
  console.log('\n\x1b[32m✓\x1b[0m Процесс переименования завершен');
  console.log('Для проверки соответствия соглашению об именовании запустите: node lint.js');
}

// Запускаем скрипт
main().catch(err => {
  console.error('Ошибка выполнения скрипта:', err);
  process.exit(1);
});