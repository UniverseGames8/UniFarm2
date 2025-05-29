#!/usr/bin/env node

/**
 * Скрипт для проверки соответствия файлов соглашениям об именовании
 * Версия, не зависящая от ESLint, который имеет проблемы с flat config в текущей версии
 */

import { fileURLToPath } from 'url';
import { dirname, resolve, basename, relative } from 'path';
import { readdirSync, statSync } from 'fs';
import { filenamingRules } from './eslint.config.js';

// Получаем текущую директорию
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Рекурсивно находит все файлы в указанной директории
 */
function findFiles(dir, includePattern = /\.(js|jsx|ts|tsx)$/, excludePattern = /node_modules|\.git|dist/) {
  let results = [];
  
  try {
    const list = readdirSync(dir);
    
    for (const file of list) {
      const filePath = resolve(dir, file);
      const stat = statSync(filePath);
      
      if (excludePattern.test(filePath)) {
        continue;
      }
      
      if (stat && stat.isDirectory()) {
        results = results.concat(findFiles(filePath, includePattern, excludePattern));
      } else if (includePattern.test(file)) {
        results.push(filePath);
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err);
  }
  
  return results;
}

/**
 * Проверяет соответствие файла правилам именования
 */
function checkFilenameRules(filePath) {
  const relPath = relative(__dirname, filePath);
  const fileName = basename(filePath);
  
  for (const [pattern, regex] of Object.entries(filenamingRules)) {
    // Преобразуем паттерн glob в регулярное выражение для проверки пути
    const globToRegex = pattern
      .replace(/\//g, '\\/')
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\{([^}]+)\}/g, '($1)');
    
    const patternRegex = new RegExp(globToRegex);
    
    // Если путь соответствует шаблону, проверяем имя файла по регулярному выражению
    if (patternRegex.test(relPath)) {
      if (!regex.test(fileName)) {
        return {
          valid: false,
          pattern,
          expected: regex.toString()
        };
      }
      return { valid: true };
    }
  }
  
  return { valid: true, skipped: true };
}

/**
 * Выполняет проверку файлов
 */
async function checkFiles() {
  console.log('Поиск файлов для проверки...');
  
  // Находим все файлы
  const serverFiles = findFiles(resolve(__dirname, 'server'));
  const sharedFiles = findFiles(resolve(__dirname, 'shared'));
  const clientFiles = findFiles(resolve(__dirname, 'client'));
  
  const allFiles = [...serverFiles, ...sharedFiles, ...clientFiles];
  
  console.log(`Найдено ${allFiles.length} файлов для проверки`);
  
  // Проверяем каждый файл
  const invalidFiles = [];
  const skippedFiles = [];
  
  for (const filePath of allFiles) {
    const result = checkFilenameRules(filePath);
    
    if (!result.valid) {
      invalidFiles.push({
        path: filePath,
        pattern: result.pattern,
        expected: result.expected
      });
    } else if (result.skipped) {
      skippedFiles.push(filePath);
    }
  }
  
  // Выводим результаты
  if (invalidFiles.length === 0) {
    console.log('\x1b[32m%s\x1b[0m', '✅ Все файлы соответствуют соглашению об именовании!');
  } else {
    console.log('\x1b[31m%s\x1b[0m', `⚠️ Найдено ${invalidFiles.length} файлов с нарушением соглашения об именовании:`);
    
    invalidFiles.forEach(file => {
      console.log('\x1b[31m%s\x1b[0m', `  - ${file.path}`);
      console.log(`    Должно соответствовать шаблону: ${file.expected}`);
      console.log(`    Правило для: ${file.pattern}`);
    });
    
    console.log('\n\x1b[33m%s\x1b[0m', 'Пожалуйста, переименуйте файлы в соответствии с соглашением:');
    console.log('  * Используйте camelCase для файлов сервисов и утилит (например, userService.ts)');
    console.log('  * Используйте PascalCase для компонентов React и типов/интерфейсов');
  }
  
  console.log(`\nПропущено файлов (нет правил для их проверки): ${skippedFiles.length}`);
  
  return invalidFiles.length === 0;
}

// Запускаем проверку
checkFiles().then(valid => {
  process.exit(valid ? 0 : 1);
}).catch(error => {
  console.error('Ошибка выполнения проверки:', error);
  process.exit(1);
});