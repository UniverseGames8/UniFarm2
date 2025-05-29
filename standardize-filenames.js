/**
 * Скрипт для стандартизации импортов в проекте
 * 
 * Этот скрипт анализирует и исправляет все импорты, чтобы они ссылались на
 * файлы с корректным именованием. В нашем проекте уже настроена система
 * файлов-посредников, поэтому мы не переименовываем сами файлы, а только
 * обновляем импорты.
 * 
 * Соглашения об именовании:
 * - Файлы сервисов: camelCase + Service.ts
 * - Файлы контроллеров: camelCase + Controller.ts
 * - Файлы утилит: camelCase.ts
 * - Файлы компонентов React: PascalCase.tsx
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

// Настройки
const CONFIG = {
  // Список импортов для исправления в формате { oldImport: 'импорт/в/неправильном/регистре', newImport: 'импорт/в/правильном/регистре' }
  importFixList: [
    // Сервисы (camelCase)
    { oldImport: './UserService', newImport: './userService' },
    { oldImport: './TransactionService', newImport: './transactionService' },
    { oldImport: './SessionService', newImport: './sessionService' },
    { oldImport: '@server/services/UserService', newImport: '@server/services/userService' },
    { oldImport: '@server/services/TransactionService', newImport: '@server/services/transactionService' },
    { oldImport: '@server/services/SessionService', newImport: '@server/services/sessionService' },
    { oldImport: './services/UserService', newImport: './services/userService' },
    { oldImport: './services/TransactionService', newImport: './services/transactionService' },
    { oldImport: './services/SessionService', newImport: './services/sessionService' },
    
    // Контроллеры (camelCase)
    { oldImport: './UserController', newImport: './userController' },
    { oldImport: './TransactionController', newImport: './transactionController' },
    { oldImport: './SessionController', newImport: './sessionController' },
    { oldImport: '@server/controllers/UserController', newImport: '@server/controllers/userController' },
    { oldImport: '@server/controllers/TransactionController', newImport: '@server/controllers/transactionController' },
    { oldImport: '@server/controllers/SessionController', newImport: '@server/controllers/sessionController' },
    { oldImport: './controllers/UserController', newImport: './controllers/userController' },
    { oldImport: './controllers/TransactionController', newImport: './controllers/transactionController' },
    { oldImport: './controllers/SessionController', newImport: './controllers/sessionController' },
  ],
  
  // Файлы, которые будут удалены после исправления всех импортов
  filesToRemoveAfterFix: [
    'server/services/UserService.ts',
    'server/services/TransactionService.ts',
    'server/services/SessionService.ts',
    'server/controllers/UserController.ts',
    'server/controllers/TransactionController.ts',
    'server/controllers/SessionController.ts',
  ],
  
  // Путь к директории проекта
  projectRoot: './',
  
  // Файлы для поиска импортов - ограничиваем только ключевыми директориями
  filesToSearch: [
    './server/routes.ts',
    './server/routes-new.ts',
    './server/index.ts',
    './server/controllers/*.ts',
    './server/services/*.ts'
  ],
  
  // Исключения - файлы, которые не нужно обновлять
  excludedFiles: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    // Исключаем сами файлы-посредники
    '**/UserService.ts',
    '**/TransactionService.ts',
    '**/SessionService.ts',
    '**/UserController.ts',
    '**/TransactionController.ts',
    '**/SessionController.ts'
  ]
};

// Вспомогательные функции
async function fileExists(filePath) {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch (error) {
    return false;
  }
}

async function createBackupOfFile(filePath) {
  const backupPath = `${filePath}.bak`;
  await fs.promises.copyFile(filePath, backupPath);
  console.log(`✅ Создана резервная копия: ${backupPath}`);
  return backupPath;
}

async function revertFromBackup(backupPath) {
  const originalPath = backupPath.replace('.bak', '');
  await fs.promises.copyFile(backupPath, originalPath);
  console.log(`✅ Восстановлен оригинальный файл из резервной копии: ${originalPath}`);
}

async function getAllFilesToUpdate() {
  let files = [];
  
  for (const pattern of CONFIG.filesToSearch) {
    const matchedFiles = await glob(pattern, { ignore: CONFIG.excludedFiles });
    files.push(...matchedFiles);
  }
  
  return files;
}

// Основные функции
async function moveFile(oldPath, newPath) {
  // Проверить существование исходного файла
  if (!(await fileExists(oldPath))) {
    console.warn(`⚠️ Исходный файл не существует: ${oldPath}`);
    return false;
  }
  
  // Проверить, не существует ли уже файл в новом месте
  if (await fileExists(newPath)) {
    // Файл может уже существовать из-за case-insensitive файловой системы
    const oldContent = await fs.promises.readFile(oldPath, 'utf8');
    const newContent = await fs.promises.readFile(newPath, 'utf8');
    
    if (oldContent === newContent) {
      console.log(`✅ Файл уже существует по новому пути: ${newPath}`);
      return true;
    } else {
      console.error(`❌ Конфликт: файл уже существует с другим содержимым: ${newPath}`);
      return false;
    }
  }
  
  // Создать директорию назначения, если она не существует
  const targetDir = path.dirname(newPath);
  try {
    await fs.promises.mkdir(targetDir, { recursive: true });
  } catch (error) {
    // Игнорируем ошибку, если директория уже существует
  }
  
  // Скопировать файл в новое место
  await fs.promises.copyFile(oldPath, newPath);
  console.log(`✅ Файл успешно скопирован: ${oldPath} -> ${newPath}`);
  
  return true;
}

async function checkAndFixImportsInFile(file) {
  let content = await fs.promises.readFile(file, 'utf8');
  let fileWasUpdated = false;
  
  // Для каждой замены из списка проверяем импорты
  for (const fixItem of CONFIG.importFixList) {
    const { oldImport, newImport } = fixItem;
    
    // Проверяем разные форматы импортов
    const importPatterns = [
      // ES6 именованный импорт: import { something } from 'module-name'
      `import\\s+\\{[^}]*\\}\\s+from\\s+['"]${oldImport}['"]`,
      // ES6 импорт по умолчанию: import Name from 'module-name'
      `import\\s+[^{]*\\s+from\\s+['"]${oldImport}['"]`,
      // ES6 импорт пространства имен: import * as name from 'module-name'
      `import\\s+\\*\\s+as\\s+[^\\s]+\\s+from\\s+['"]${oldImport}['"]`,
      // Только импорт: import 'module-name'
      `import\\s+['"]${oldImport}['"]`,
      // CommonJS импорт: require('module-name')
      `require\\(['"]${oldImport}['"]\\)`
    ];
    
    for (const pattern of importPatterns) {
      const regex = new RegExp(pattern, 'g');
      if (regex.test(content)) {
        // Создать резервную копию перед изменением файла (только один раз)
        if (!fileWasUpdated) {
          await createBackupOfFile(file);
          fileWasUpdated = true;
        }
        
        // Заменяем импорт на правильный
        content = content.replace(regex, (match) => {
          return match.replace(oldImport, newImport);
        });
      }
    }
  }
  
  // Сохранить файл, если были сделаны изменения
  if (fileWasUpdated) {
    await fs.promises.writeFile(file, content, 'utf8');
    console.log(`✅ Обновлены импорты в файле: ${file}`);
    return true;
  }
  
  return false;
}

async function removeProxyFiles() {
  console.log('\n🗑️ Удаление файлов-посредников с верхним регистром...');
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const filePath of CONFIG.filesToRemoveAfterFix) {
    const fullPath = path.join(CONFIG.projectRoot, filePath);
    const fileName = path.basename(filePath, '.ts');
    
    try {
      if (await fileExists(fullPath)) {
        // Перед удалением проверим, используются ли где-то импорты в верхнем регистре
        // Обратите внимание: grep возвращает код 1, если ничего не найдено,
        // что вызывает исключение в execPromise, но это нормально в нашем случае
        try {
          const importsCheckResult = await execPromise(`grep -r "from.*${fileName}" --include="*.ts" --include="*.tsx" ./server`);
          
          if (importsCheckResult.stdout.trim() !== '') {
            console.warn(`⚠️ Найдены импорты для ${filePath}, отмена удаления:`);
            console.warn(importsCheckResult.stdout);
            errorCount++;
            continue;
          }
        } catch (grepError) {
          // Если grep не нашел соответствий - это хорошо!
          // Код возврата 1 означает, что не найдено совпадений
          if (grepError.code !== 1) {
            console.error(`⚠️ Ошибка при проверке импортов для ${filePath}:`);
            console.error(grepError);
            errorCount++;
            continue;
          }
        }
        
        // Удаляем файл
        await fs.promises.unlink(fullPath);
        console.log(`✅ Удален файл-посредник: ${filePath}`);
        successCount++;
      } else {
        console.log(`ℹ️ Файл не существует, пропускаем: ${filePath}`);
      }
    } catch (error) {
      console.error(`❌ Ошибка при удалении файла ${filePath}:`);
      console.error(error);
      errorCount++;
    }
  }
  
  console.log(`✅ Успешно удалено: ${successCount} файлов`);
  console.log(`❌ Ошибок: ${errorCount}`);
  
  return { successCount, errorCount };
}

async function standardizeImports() {
  console.log('🚀 Начинаем стандартизацию импортов...\n');
  
  // Шаг 1: Получить все файлы для обновления
  const filesToUpdate = await getAllFilesToUpdate();
  console.log(`📁 Найдено ${filesToUpdate.length} файлов для проверки и обновления импортов`);
  
  // Шаг 2: Обработать каждый файл
  let updatedCount = 0;
  let errorCount = 0;
  
  for (const file of filesToUpdate) {
    try {
      const wasUpdated = await checkAndFixImportsInFile(file);
      if (wasUpdated) {
        updatedCount++;
      }
    } catch (error) {
      console.error(`❌ Ошибка при обработке файла ${file}:`);
      console.error(error);
      errorCount++;
    }
    
    // Пауза между операциями для снижения нагрузки
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n📊 Итоги стандартизации импортов:');
  console.log(`✅ Обновлено файлов: ${updatedCount}`);
  console.log(`❌ Ошибок: ${errorCount}`);
  
  // Шаг 3: Удалить файлы-посредники если все импорты успешно исправлены
  if (updatedCount > 0 && errorCount === 0) {
    // Дать время файловой системе и TypeScript обновить ссылки
    console.log('\n⏳ Ожидание перед удалением файлов-посредников...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Удаляем файлы-посредники
    const removalResult = await removeProxyFiles();
    
    if (removalResult.successCount > 0 && removalResult.errorCount === 0) {
      console.log('\n✅ Стандартизация импортов успешно завершена!');
    } else {
      console.warn('\n⚠️ Стандартизация импортов частично завершена.');
      console.warn('   Некоторые файлы-посредники не были удалены из-за ошибок.');
    }
  } else if (errorCount > 0) {
    console.warn('\n⚠️ Стандартизация импортов завершена с ошибками.');
    console.warn('   Файлы-посредники не были удалены для сохранения работоспособности приложения.');
  } else {
    console.log('\n✅ Проверка импортов завершена - изменений не потребовалось.');
  }
  
  console.log('\n🔄 Перезапуск сервера рекомендуется после этих изменений.');
}

// Вспомогательная функция для отладки
async function testGrepImports(pattern) {
  try {
    const { stdout, stderr } = await execPromise(`grep -r "from.*${pattern}" --include="*.ts" --include="*.tsx" ./server`);
    console.log(`Найдены импорты для ${pattern}:`);
    console.log(stdout);
    if (stderr) {
      console.error('Ошибки:');
      console.error(stderr);
    }
  } catch (error) {
    console.log(`Импорты не найдены для ${pattern} или произошла ошибка:`);
    if (error.stderr) {
      console.error(error.stderr);
    } else {
      console.error(error);
    }
  }
}

// Запуск стандартизации
//standardizeImports();

// Запуск только удаления файлов-посредников
(async function() {
  console.log('🚀 Начинаем удаление файлов-посредников...\n');
  const result = await removeProxyFiles();
  
  if (result.successCount > 0 && result.errorCount === 0) {
    console.log('\n✅ Удаление файлов-посредников успешно завершено!');
  } else if (result.errorCount > 0) {
    console.warn('\n⚠️ Удаление файлов-посредников завершено с ошибками.');
  } else {
    console.log('\n✅ Файлы-посредники не обнаружены или уже удалены.');
  }
})();