/**
 * Специальный скрипт для фиксации проблем с типами в скриптах партиционирования и кронах
 * 
 * Запустите его через:
 * npx tsx server/scripts/fix-all-types.ts
 */

import fs from 'fs';
import path from 'path';

// Список файлов для исправления
const filesToFix = [
  'clear_old_partitions.ts',
  'create_farming_snapshots.ts',
  'create_wallet_snapshots.ts',
  'cron_scheduler.ts',
];

// Функция для исправления одного файла
function fixFile(filePath: string): void {
  console.log(`Исправление типов в файле: ${filePath}`);
  
  // Читаем содержимое файла
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Заменяем все catch(error) на catch(error: any)
  content = content.replace(/} catch \(error\) {/g, '} catch (error: any) {');
  
  // Заменяем last parameter error без указания типа в .catch((error)
  content = content.replace(/.catch\(\(error\) =>/g, '.catch((error: any) =>');
  
  // Записываем обновленное содержимое
  fs.writeFileSync(filePath, content, 'utf8');
  
  console.log(`✓ Файл исправлен: ${filePath}`);
}

// Главная функция
function main() {
  console.log('Начинаем исправление проблем с типами...');
  
  // Используем import.meta.url вместо __dirname для ESM
  const __filename = new URL(import.meta.url).pathname;
  const scriptsDir = path.dirname(__filename);
  
  // Проверяем и исправляем каждый файл
  for (const fileName of filesToFix) {
    const filePath = path.join(scriptsDir, fileName);
    
    if (fs.existsSync(filePath)) {
      fixFile(filePath);
    } else {
      console.warn(`⚠️ Файл не найден: ${filePath}`);
    }
  }
  
  console.log('Все файлы успешно исправлены!');
}

// Запускаем скрипт
main();