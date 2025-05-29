/**
 * Скрипт автоматического удаления старых партиций транзакций
 * 
 * Безопасно удаляет партиции транзакций старше 7 дней при соблюдении ряда условий:
 * 1. Должен существовать соответствующий снимок в farming_snapshots
 * 2. Не удаляются партиции за текущий день и предыдущие 2 дня
 * 3. Все действия логируются для аудита
 */

import { db, pool } from '../db';
import { subDays, format, parse, differenceInDays } from 'date-fns';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

// Создаем аналог __dirname для ESM модулей
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execAsync = promisify(exec);
const LOG_DIR = path.join(__dirname, '../../logs/partitions');

// Убедимся, что папка для логов существует
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * Функция логирования в файл
 */
function logToFile(message: string) {
  const now = new Date();
  const logFile = path.join(LOG_DIR, `partition-cleanup-${format(now, 'yyyy-MM-dd')}.log`);
  const logMessage = `[${format(now, 'yyyy-MM-dd HH:mm:ss')}] ${message}\n`;
  
  fs.appendFileSync(logFile, logMessage);
  console.log(message);
}

/**
 * Проверяет наличие снимка в farming_snapshots для указанной даты
 */
async function checkSnapshotExists(date: Date): Promise<boolean> {
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const { rows } = await pool.query(`
      SELECT COUNT(*) as count 
      FROM farming_snapshots 
      WHERE snapshot_date BETWEEN $1 AND $2
    `, [startOfDay, endOfDay]);
    
    return parseInt(rows[0].count, 10) > 0;
  } catch (error: any) {
    logToFile(`ОШИБКА при проверке снимка для даты ${format(date, 'yyyy-MM-dd')}: ${error.message}`);
    return false;
  }
}

/**
 * Создает архив партиции перед удалением (опционально)
 */
async function backupPartitionBeforeDelete(partitionName: string, date: Date): Promise<boolean> {
  try {
    const backupDir = path.join(__dirname, '../../backups/partitions');
    
    // Убедимся, что папка для бэкапов существует
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const backupFile = path.join(backupDir, `${partitionName}_${format(date, 'yyyy-MM-dd')}.sql`);
    
    // Используем pg_dump для создания бэкапа таблицы
    const { stdout, stderr } = await execAsync(
      `pg_dump --table=${partitionName} --schema-only --file=${backupFile} "${process.env.DATABASE_URL}"`
    );
    
    if (stderr) {
      logToFile(`Предупреждение при создании бэкапа ${partitionName}: ${stderr}`);
    }
    
    logToFile(`Создан бэкап структуры партиции ${partitionName} в файле ${backupFile}`);
    
    // Сохраняем данные (опционально, может занять много места)
    // Раскомментируйте, если нужно сохранять и данные тоже
    /*
    const dataBackupFile = path.join(backupDir, `${partitionName}_data_${format(date, 'yyyy-MM-dd')}.sql`);
    await execAsync(
      `pg_dump --table=${partitionName} --data-only --file=${dataBackupFile} "${process.env.DATABASE_URL}"`
    );
    logToFile(`Создан бэкап данных партиции ${partitionName} в файле ${dataBackupFile}`);
    */
    
    return true;
  } catch (error: any) {
    logToFile(`ОШИБКА при создании бэкапа партиции ${partitionName}: ${error.message}`);
    return false;
  }
}

/**
 * Получает количество записей в партиции
 */
async function getPartitionRecordCount(partitionName: string): Promise<number> {
  try {
    const { rows } = await pool.query(`SELECT COUNT(*) as count FROM ${partitionName}`);
    return parseInt(rows[0].count, 10);
  } catch (error: any) {
    logToFile(`ОШИБКА при подсчете записей в партиции ${partitionName}: ${error.message}`);
    return -1;
  }
}

/**
 * Удаляет партицию
 */
async function dropPartition(partitionName: string, date: Date): Promise<boolean> {
  try {
    // Проверяем количество записей перед удалением
    const recordCount = await getPartitionRecordCount(partitionName);
    
    if (recordCount < 0) {
      logToFile(`Не удалось посчитать количество записей в партиции ${partitionName}, удаление отменено`);
      return false;
    }
    
    // Создаем бэкап таблицы перед удалением (опционально)
    const backupSuccess = await backupPartitionBeforeDelete(partitionName, date);
    
    if (!backupSuccess) {
      logToFile(`Не удалось создать бэкап партиции ${partitionName}, удаление отложено`);
      return false;
    }
    
    // Выполняем удаление
    await pool.query(`DROP TABLE IF EXISTS ${partitionName}`);
    
    logToFile(`УСПЕШНО удалена партиция ${partitionName} (${recordCount} записей)`);
    return true;
  } catch (error: any) {
    logToFile(`ОШИБКА при удалении партиции ${partitionName}: ${error.message}`);
    return false;
  }
}

/**
 * Проверяет, существует ли партиция
 */
async function checkPartitionExists(partitionName: string): Promise<boolean> {
  try {
    const { rows } = await pool.query(`
      SELECT 1 
      FROM pg_class c 
      JOIN pg_namespace n ON n.oid = c.relnamespace 
      WHERE c.relname = $1 AND n.nspname = 'public'
    `, [partitionName]);
    
    return rows.length > 0;
  } catch (error: any) {
    logToFile(`ОШИБКА при проверке существования партиции ${partitionName}: ${error.message}`);
    return false;
  }
}

/**
 * Главная функция для удаления старых партиций
 */
async function clearOldPartitions() {
  try {
    logToFile('Начало процесса удаления старых партиций...');
    
    const today = new Date();
    const deletedPartitions = [];
    const skippedPartitions = [];
    
    // Проверяем партиции за последние 30 дней, чтобы найти те, которые можно удалить
    for (let i = 3; i <= 30; i++) {
      const dateToCheck = subDays(today, i);
      const formattedDate = format(dateToCheck, 'yyyy_MM_dd');
      const partitionName = `transactions_${formattedDate}`;
      
      // Проверяем, существует ли партиция
      const partitionExists = await checkPartitionExists(partitionName);
      
      if (!partitionExists) {
        logToFile(`Партиция ${partitionName} не существует, пропускаем`);
        continue;
      }
      
      // Проверяем, есть ли соответствующий снимок в farming_snapshots
      const hasSnapshot = await checkSnapshotExists(dateToCheck);
      
      // Проверяем, прошло ли нужное количество дней (7+)
      const daysOld = differenceInDays(today, dateToCheck);
      
      // Удаляем только партиции старше 7 дней и имеющие снимки
      if (daysOld >= 7 && hasSnapshot) {
        logToFile(`Партиция ${partitionName} соответствует критериям удаления (возраст: ${daysOld} дней, снимок: есть)`);
        
        const success = await dropPartition(partitionName, dateToCheck);
        
        if (success) {
          deletedPartitions.push(partitionName);
        } else {
          skippedPartitions.push(partitionName);
        }
      } else {
        const reason = hasSnapshot ? 
          `возраст недостаточен (${daysOld} дней)` : 
          `отсутствует снимок farming_snapshot`;
        
        logToFile(`Партиция ${partitionName} НЕ удалена: ${reason}`);
        skippedPartitions.push(partitionName);
      }
    }
    
    // Формируем итоговый отчет
    logToFile('\n=== ИТОГОВЫЙ ОТЧЕТ ПО ОЧИСТКЕ ПАРТИЦИЙ ===');
    logToFile(`Дата выполнения: ${format(today, 'yyyy-MM-dd HH:mm:ss')}`);
    logToFile(`Всего удалено партиций: ${deletedPartitions.length}`);
    logToFile(`Удаленные партиции: ${deletedPartitions.join(', ') || 'нет'}`);
    logToFile(`Пропущенные партиции: ${skippedPartitions.join(', ') || 'нет'}`);
    logToFile('=== КОНЕЦ ОТЧЕТА ===\n');
    
    return {
      success: true,
      deletedCount: deletedPartitions.length,
      skippedCount: skippedPartitions.length,
      deletedPartitions,
      skippedPartitions,
    };
  } catch (error: any) {
    logToFile(`КРИТИЧЕСКАЯ ОШИБКА при удалении старых партиций: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Экспортируем функцию для использования в cron-задачах
export default clearOldPartitions;

// Если скрипт запущен напрямую, выполняем удаление партиций
// Используем проверку для ES модулей
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  clearOldPartitions()
    .then((result) => {
      if (result.success) {
        console.log(`Успешно завершено! Удалено партиций: ${result.deletedCount}, пропущено: ${result.skippedCount}`);
      } else {
        console.error(`Произошла ошибка: ${result.error}`);
      }
      process.exit(0);
    })
    .catch((error: any) => {
      console.error('Необработанная ошибка:', error);
      process.exit(1);
    });
}