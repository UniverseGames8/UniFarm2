/**
 * Скрипт планировщика для автоматического выполнения задач по расписанию
 * 
 * Этот скрипт запускает задачи по расписанию:
 * - Создание будущих партиций (ежедневно в 00:01)
 * - Создание снимков фарминга (ежедневно в 00:05)
 * - Создание снимков кошельков (ежедневно в 00:10)
 * - Удаление старых партиций (ежедневно в 03:00)
 */

import { schedule } from 'node-cron';
import { format } from 'date-fns';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Создаем аналог __dirname для ESM модулей
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Импортируем наши задачи
import createFarmingSnapshots from './create_farming_snapshots';
import createWalletSnapshots from './create_wallet_snapshots';
import clearOldPartitions from './clear_old_partitions';
import createPartitionsJob from './create_partitions';

const LOG_DIR = path.join(__dirname, '../../logs/cron');

// Убедимся, что папка для логов существует
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * Функция логирования в файл
 */
function logToFile(message: string) {
  const now = new Date();
  const logFile = path.join(LOG_DIR, `cron-${format(now, 'yyyy-MM-dd')}.log`);
  const logMessage = `[${format(now, 'yyyy-MM-dd HH:mm:ss')}] ${message}\n`;
  
  fs.appendFileSync(logFile, logMessage);
  console.log(message);
}

/**
 * Запуск создания снимков фарминга
 */
function runFarmingSnapshotsJob() {
  logToFile('Запуск задачи создания снимков фарминга...');
  
  createFarmingSnapshots()
    .then((result) => {
      if (result.success) {
        logToFile(`Создание снимков фарминга успешно завершено: ${result.successCount}/${result.totalUsers}`);
      } else {
        logToFile(`ОШИБКА при создании снимков фарминга: ${result.error}`);
      }
    })
    .catch((error: any) => {
      logToFile(`Необработанная ошибка при создании снимков фарминга: ${error.message}`);
    });
}

/**
 * Запуск создания снимков кошельков
 */
function runWalletSnapshotsJob() {
  logToFile('Запуск задачи создания снимков кошельков...');
  
  createWalletSnapshots()
    .then((result) => {
      if (result.success) {
        logToFile(`Создание снимков кошельков успешно завершено: ${result.successCount}/${result.totalUsers}`);
      } else {
        logToFile(`ОШИБКА при создании снимков кошельков: ${result.error}`);
      }
    })
    .catch((error: any) => {
      logToFile(`Необработанная ошибка при создании снимков кошельков: ${error.message}`);
    });
}

/**
 * Запуск удаления старых партиций
 */
function runClearOldPartitionsJob() {
  logToFile('Запуск задачи удаления старых партиций...');
  
  clearOldPartitions()
    .then((result) => {
      if (result.success) {
        logToFile(`Удаление старых партиций успешно завершено: удалено ${result.deletedCount}, пропущено ${result.skippedCount}`);
      } else {
        logToFile(`ОШИБКА при удалении старых партиций: ${result.error}`);
      }
    })
    .catch((error: any) => {
      logToFile(`Необработанная ошибка при удалении старых партиций: ${error.message}`);
    });
}

/**
 * Запуск создания партиций на будущие дни
 */
function runCreatePartitionsJob() {
  logToFile('Запуск задачи создания партиций на будущие дни...');
  
  createPartitionsJob()
    .then(() => {
      logToFile('Задача создания партиций успешно выполнена');
    })
    .catch((error: any) => {
      logToFile(`Необработанная ошибка при создании партиций: ${error.message}`);
    });
}

/**
 * Настройка расписания для задач
 */
function setupCronJobs() {
  // Создание партиций на будущие даты в 00:01 каждый день
  schedule('1 0 * * *', () => {
    runCreatePartitionsJob();
  });
  
  // Создание снимков фарминга в 00:05 каждый день
  schedule('5 0 * * *', () => {
    runFarmingSnapshotsJob();
  });
  
  // Создание снимков кошельков в 00:10 каждый день
  schedule('10 0 * * *', () => {
    runWalletSnapshotsJob();
  });
  
  // Удаление старых партиций в 03:00 каждый день
  schedule('0 3 * * *', () => {
    runClearOldPartitionsJob();
  });
  
  logToFile('Cron-задачи успешно настроены:');
  logToFile('- Создание партиций: ежедневно в 00:01');
  logToFile('- Создание снимков фарминга: ежедневно в 00:05');
  logToFile('- Создание снимков кошельков: ежедневно в 00:10');
  logToFile('- Удаление старых партиций: ежедневно в 03:00');
}

// Экспортируем функцию настройки задач
export { setupCronJobs };

// Если скрипт запущен напрямую, запускаем настройку задач
// Используем проверку для ES модулей
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  logToFile('Запуск планировщика задач...');
  setupCronJobs();
  
  // Для удобства разработки и тестирования, можно сразу запустить задачи в режиме отладки
  const args = process.argv.slice(2);
  if (args.includes('--run-now') || args.includes('-r')) {
    logToFile('Запуск задач немедленно (режим отладки)...');
    
    if (args.includes('--farming') || args.includes('-f')) {
      runFarmingSnapshotsJob();
    }
    
    if (args.includes('--wallet') || args.includes('-w')) {
      runWalletSnapshotsJob();
    }
    
    if (args.includes('--cleanup') || args.includes('-c')) {
      runClearOldPartitionsJob();
    }
    
    if (args.includes('--partitions') || args.includes('-p')) {
      runCreatePartitionsJob();
    }
    
    // Если не указаны конкретные задачи, запускаем все
    if (!args.some(arg => ['--farming', '-f', '--wallet', '-w', '--cleanup', '-c', '--partitions', '-p'].includes(arg))) {
      runCreatePartitionsJob();
      setTimeout(runFarmingSnapshotsJob, 3000);
      setTimeout(runWalletSnapshotsJob, 6000); // Запускаем с небольшой задержкой
      setTimeout(runClearOldPartitionsJob, 9000);
    }
  } else {
    logToFile('Планировщик запущен. Задачи будут выполняться по расписанию.');
    logToFile('Для немедленного запуска используйте флаг --run-now или -r');
  }
}