/**
 * Планировщик для автоматического создания партиций
 * Запускает создание партиций каждый день в заданное время
 */

import cron from 'node-cron';
import { execFile } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Определяем текущую директорию для ESM
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Путь к скрипту создания партиций
const scriptPath = path.resolve(__dirname, '../scripts/scheduled_partition_creator.ts');

// Функция для запуска скрипта создания партиций
function runPartitionCreator() {
  console.log(`[${new Date().toISOString()}] Запуск планового создания партиций...`);
  
  execFile('npx', ['tsx', scriptPath], (error, stdout, stderr) => {
    if (error) {
      console.error(`[Partition Scheduler] Ошибка при выполнении скрипта создания партиций:`, error);
      return;
    }
    
    if (stderr) {
      console.error(`[Partition Scheduler] Ошибки в выводе скрипта:`, stderr);
    }
    
    console.log(`[Partition Scheduler] Результат выполнения скрипта создания партиций:`);
    console.log(stdout);
    console.log(`[Partition Scheduler] Создание партиций завершено.`);
  });
}

// Расписание: запуск каждый день в 00:05
export function schedulePartitionCreation() {
  // Проверка, что node-cron работает
  if (!cron) {
    console.error('[Partition Scheduler] Ошибка: модуль node-cron не загружен. Автоматическое создание партиций не настроено.');
    return false;
  }
  
  try {
    // Основное расписание - каждый день в 00:05
    cron.schedule('5 0 * * *', () => {
      console.log(`[${new Date().toISOString()}] Начало автоматического создания партиций по расписанию...`);
      runPartitionCreator();
    });
    
    console.log('[Partition Scheduler] Автоматическое создание партиций настроено на ежедневное выполнение в 00:05.');
    
    // Также запускаем первичное создание партиций при старте приложения
    console.log('[Partition Scheduler] Запуск первичного создания партиций...');
    runPartitionCreator();
    
    return true;
  } catch (error) {
    console.error('[Partition Scheduler] Ошибка при настройке расписания создания партиций:', error);
    return false;
  }
}

// Экспорт функции для ручного запуска создания партиций
export function manualRunPartitionCreator() {
  console.log('[Partition Scheduler] Запуск создания партиций вручную...');
  runPartitionCreator();
}