/**
 * Скрипт создания ежедневных снимков фарминга
 * 
 * Этот скрипт создает ежедневные снимки состояния фарминга в таблице farming_snapshots,
 * что необходимо для безопасного удаления старых партиций транзакций.
 */

import { db, pool } from '../db';
import { format } from 'date-fns';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Создаем аналог __dirname для ESM модулей
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_DIR = path.join(__dirname, '../../logs/snapshots');

// Убедимся, что папка для логов существует
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * Функция логирования в файл
 */
function logToFile(message: string) {
  const now = new Date();
  const logFile = path.join(LOG_DIR, `snapshots-${format(now, 'yyyy-MM-dd')}.log`);
  const logMessage = `[${format(now, 'yyyy-MM-dd HH:mm:ss')}] ${message}\n`;
  
  fs.appendFileSync(logFile, logMessage);
  console.log(message);
}

/**
 * Функция для получения общего заработка от фарминга по пользователю
 */
async function getUserTotalEarnings(userId: number): Promise<number> {
  try {
    const { rows } = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as total_earned
      FROM transactions
      WHERE user_id = $1 AND type = 'farming_reward' AND currency = 'UNI'
    `, [userId]);
    
    return parseFloat(rows[0].total_earned);
  } catch (error: any) {
    logToFile(`ОШИБКА при получении общих заработков пользователя ${userId}: ${error.message}`);
    return 0;
  }
}

/**
 * Функция для создания снимка фарминга для одного пользователя
 */
async function createUserFarmingSnapshot(userId: number): Promise<boolean> {
  try {
    const totalEarned = await getUserTotalEarnings(userId);
    const now = new Date();
    
    // Вставляем снимок в таблицу farming_snapshots
    await pool.query(`
      INSERT INTO farming_snapshots
      (user_id, total_earned, snapshot_date)
      VALUES ($1, $2, $3)
    `, [userId, totalEarned, now]);
    
    logToFile(`Успешно создан снимок для пользователя ${userId}: ${totalEarned} UNI`);
    return true;
  } catch (error: any) {
    logToFile(`ОШИБКА при создании снимка для пользователя ${userId}: ${error.message}`);
    return false;
  }
}

/**
 * Получает всех активных пользователей с депозитами в фарминге
 */
async function getActiveUsers(): Promise<number[]> {
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT user_id
      FROM uni_farming_deposits
      WHERE is_active = true
    `);
    
    return rows.map(row => row.user_id);
  } catch (error: any) {
    logToFile(`ОШИБКА при получении активных пользователей: ${error.message}`);
    return [];
  }
}

/**
 * Основная функция создания снимков для всех пользователей
 */
async function createFarmingSnapshots(): Promise<any> {
  try {
    logToFile('Начало процесса создания снимков фарминга...');
    
    // Получаем всех активных пользователей
    const activeUsers = await getActiveUsers();
    logToFile(`Найдено ${activeUsers.length} активных пользователей`);
    
    let successCount = 0;
    const failedUsers = [];
    
    // Создаем снимки для каждого пользователя
    for (const userId of activeUsers) {
      const success = await createUserFarmingSnapshot(userId);
      
      if (success) {
        successCount++;
      } else {
        failedUsers.push(userId);
      }
    }
    
    // Также создаем общий снимок для всей системы (суммарные показатели)
    const { rows } = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as total_system_earned
      FROM transactions
      WHERE type = 'farming_reward' AND currency = 'UNI'
    `);
    
    const totalSystemEarned = parseFloat(rows[0].total_system_earned);
    
    // Записываем итоговый отчет
    logToFile('\n=== ИТОГОВЫЙ ОТЧЕТ ПО СОЗДАНИЮ СНИМКОВ ===');
    logToFile(`Дата выполнения: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}`);
    logToFile(`Всего пользователей обработано: ${activeUsers.length}`);
    logToFile(`Успешно создано снимков: ${successCount}`);
    logToFile(`Не удалось создать снимки для пользователей: ${failedUsers.join(', ') || 'нет'}`);
    logToFile(`Общий доход в системе: ${totalSystemEarned} UNI`);
    logToFile('=== КОНЕЦ ОТЧЕТА ===\n');
    
    return {
      success: true,
      totalUsers: activeUsers.length,
      successCount,
      failedCount: failedUsers.length,
      failedUsers,
      totalSystemEarned,
    };
  } catch (error: any) {
    logToFile(`КРИТИЧЕСКАЯ ОШИБКА при создании снимков фарминга: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Экспортируем функцию для использования в cron-задачах
export default createFarmingSnapshots;

// Если скрипт запущен напрямую, выполняем создание снимков
// Используем проверку для ES модулей
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createFarmingSnapshots()
    .then((result) => {
      if (result.success) {
        console.log(`Успешно завершено! Создано снимков: ${result.successCount}/${result.totalUsers}`);
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