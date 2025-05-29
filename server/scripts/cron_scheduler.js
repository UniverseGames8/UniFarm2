/**
 * Планировщик задач для автоматического выполнения скриптов
 * 
 * Этот модуль инициализирует и запускает все необходимые cron задачи:
 * 1. Создание партиций для таблицы transactions (ежедневно в 00:05)
 * 2. Очистка старых партиций (еженедельно по воскресеньям в 01:00)
 * 3. Создание снимков фарминга (ежедневно в 23:55)
 * 4. Создание снимков кошельков (ежедневно в 23:45)
 */

import cron from 'node-cron';
import { createPartitions } from './create_partition_manually.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

// Получаем текущую директорию
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Функция для запуска Node.js скриптов
function runScript(scriptPath, args = []) {
  return new Promise((resolve, reject) => {
    console.log(`[Cron] Running script: ${scriptPath} with args: ${args.join(' ')}`);
    
    const process = spawn('node', [scriptPath, ...args], {
      cwd: __dirname,
      stdio: 'inherit'
    });
    
    process.on('close', (code) => {
      if (code !== 0) {
        console.error(`[Cron] Script ${scriptPath} exited with code ${code}`);
        reject(new Error(`Script exited with code ${code}`));
      } else {
        console.log(`[Cron] Script ${scriptPath} completed successfully`);
        resolve();
      }
    });
    
    process.on('error', (err) => {
      console.error(`[Cron] Failed to start script ${scriptPath}:`, err);
      reject(err);
    });
  });
}

// Инициализация всех cron задач
export function setupCronJobs() {
  console.log('[Cron] Initializing cron jobs...');
  
  // 1. Создание партиций для transactions - каждый день в 00:05
  cron.schedule('5 0 * * *', async () => {
    try {
      console.log('[Cron] Running partition creation task');
      // Создаем партиции на 7 дней вперед
      await createPartitions(7);
      console.log('[Cron] Partition creation completed');
    } catch (error) {
      console.error('[Cron] Error in partition creation task:', error);
    }
  }, {
    scheduled: true,
    timezone: 'UTC'
  });
  
  // 2. Очистка старых партиций - каждое воскресенье в 01:00
  cron.schedule('0 1 * * 0', async () => {
    try {
      console.log('[Cron] Running old partition cleanup task');
      await runScript('./clear_old_partitions.js');
      console.log('[Cron] Old partition cleanup completed');
    } catch (error) {
      console.error('[Cron] Error in partition cleanup task:', error);
    }
  }, {
    scheduled: true,
    timezone: 'UTC'
  });
  
  // 3. Создание снимков фарминга - каждый день в 23:55
  cron.schedule('55 23 * * *', async () => {
    try {
      console.log('[Cron] Running farming snapshot creation task');
      await runScript('./create_farming_snapshots.js');
      console.log('[Cron] Farming snapshot creation completed');
    } catch (error) {
      console.error('[Cron] Error in farming snapshot task:', error);
    }
  }, {
    scheduled: true,
    timezone: 'UTC'
  });
  
  // 4. Создание снимков кошельков - каждый день в 23:45
  cron.schedule('45 23 * * *', async () => {
    try {
      console.log('[Cron] Running wallet snapshot creation task');
      await runScript('./create_wallet_snapshots.js');
      console.log('[Cron] Wallet snapshot creation completed');
    } catch (error) {
      console.error('[Cron] Error in wallet snapshot task:', error);
    }
  }, {
    scheduled: true,
    timezone: 'UTC'
  });
  
  console.log('[Cron] All cron jobs initialized');
}

// Если скрипт запускается напрямую, инициализируем cron задачи
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  setupCronJobs();
}