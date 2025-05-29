/**
 * Скрипт для последовательного выполнения миграций партиционирования
 * 
 * Выполняет следующие шаги:
 * 1. Создает таблицу partition_logs для логирования операций с партициями
 * 2. Создает партиционированную таблицу transactions_partitioned
 * 3. Переносит данные из существующей таблицы transactions
 * 4. Создает партиции на ближайшие несколько дней
 */

import { runMigration as createPartitionLogs } from './server/migrations/create_partition_logs';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

// Функция для выполнения Node.js скриптов
function runScript(scriptPath) {
  return new Promise((resolve, reject) => {
    console.log(`Запуск скрипта: ${scriptPath}`);
    
    const process = spawn('node', [scriptPath], {
      stdio: 'inherit'
    });
    
    process.on('close', (code) => {
      if (code !== 0) {
        console.error(`Скрипт ${scriptPath} завершился с кодом ${code}`);
        reject(new Error(`Скрипт завершился с кодом ${code}`));
      } else {
        console.log(`Скрипт ${scriptPath} успешно выполнен`);
        resolve(code);
      }
    });
    
    process.on('error', (err) => {
      console.error(`Не удалось запустить скрипт ${scriptPath}:`, err);
      reject(err);
    });
  });
}

async function setupPartitioning() {
  try {
    console.log('=== НАСТРОЙКА ПАРТИЦИОНИРОВАНИЯ ТРАНЗАКЦИЙ ===');
    
    // Шаг 1: Создание таблицы partition_logs
    console.log('\n--- Шаг 1: Создание таблицы partition_logs ---');
    await createPartitionLogs();
    
    // Шаг 2: Создание партиционированной таблицы и перенос данных
    console.log('\n--- Шаг 2: Создание партиционированной таблицы и перенос данных ---');
    await runScript('./server/scripts/setup_partitioned_table.js');
    
    // Шаг 3: Создание партиций на ближайшие дни
    console.log('\n--- Шаг 3: Создание партиций на ближайшие дни ---');
    await runScript('./server/scripts/create_partition_manually.js');
    
    console.log('\n=== НАСТРОЙКА ПАРТИЦИОНИРОВАНИЯ ЗАВЕРШЕНА ===');
    console.log('Таблица transactions успешно партиционирована по дате');
    console.log('Партиции созданы на несколько дней вперед');
    console.log('Система готова к обработке миллионов транзакций в день');
    
    return { success: true };
  } catch (error: any) {
    console.error('Ошибка при настройке партиционирования:', error);
    return { 
      success: false, 
      error: error.message,
      stack: error.stack
    };
  }
}

// Если скрипт запущен напрямую, выполняем настройку партиционирования
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  setupPartitioning()
    .then((result) => {
      console.log('Выполнение завершено:', result.success ? 'успешно' : 'с ошибками');
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Критическая ошибка:', error);
      process.exit(1);
    });
}

export default setupPartitioning;