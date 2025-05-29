/**
 * Скрипт создания ежедневных снимков балансов кошельков
 * 
 * Этот скрипт создает ежедневные снимки состояния балансов пользователей в таблице wallet_snapshots,
 * что позволяет отслеживать динамику изменения балансов и анализировать рост проекта.
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
  const logFile = path.join(LOG_DIR, `wallet-snapshots-${format(now, 'yyyy-MM-dd')}.log`);
  const logMessage = `[${format(now, 'yyyy-MM-dd HH:mm:ss')}] ${message}\n`;
  
  fs.appendFileSync(logFile, logMessage);
  console.log(message);
}

/**
 * Функция для создания снимка баланса для одного пользователя
 */
async function createUserWalletSnapshot(userId: number): Promise<boolean> {
  try {
    // Получаем текущий баланс пользователя
    const { rows } = await pool.query(`
      SELECT balance_uni, balance_ton
      FROM users
      WHERE id = $1
    `, [userId]);
    
    if (rows.length === 0) {
      logToFile(`Пользователь ${userId} не найден, снимок не создан`);
      return false;
    }
    
    const { balance_uni, balance_ton } = rows[0];
    const now = new Date();
    
    // Вставляем снимок в таблицу wallet_snapshots
    await pool.query(`
      INSERT INTO wallet_snapshots
      (user_id, balance_uni, balance_ton, snapshot_date)
      VALUES ($1, $2, $3, $4)
    `, [userId, balance_uni, balance_ton, now]);
    
    logToFile(`Успешно создан снимок баланса для пользователя ${userId}: ${balance_uni} UNI, ${balance_ton} TON`);
    return true;
  } catch (error: any) {
    logToFile(`ОШИБКА при создании снимка баланса для пользователя ${userId}: ${error.message}`);
    return false;
  }
}

/**
 * Получает всех пользователей с ненулевым балансом
 */
async function getUsersWithBalance(): Promise<number[]> {
  try {
    const { rows } = await pool.query(`
      SELECT id
      FROM users
      WHERE balance_uni > 0 OR balance_ton > 0
    `);
    
    return rows.map(row => row.id);
  } catch (error: any) {
    logToFile(`ОШИБКА при получении пользователей с балансом: ${error.message}`);
    return [];
  }
}

/**
 * Основная функция создания снимков для всех пользователей
 */
async function createWalletSnapshots(): Promise<any> {
  try {
    logToFile('Начало процесса создания снимков балансов...');
    
    // Получаем всех пользователей с ненулевым балансом
    const usersWithBalance = await getUsersWithBalance();
    logToFile(`Найдено ${usersWithBalance.length} пользователей с ненулевым балансом`);
    
    let successCount = 0;
    const failedUsers = [];
    
    // Создаем снимки для каждого пользователя
    for (const userId of usersWithBalance) {
      const success = await createUserWalletSnapshot(userId);
      
      if (success) {
        successCount++;
      } else {
        failedUsers.push(userId);
      }
    }
    
    // Также создаем общий снимок для всей системы (суммарные показатели)
    const { rows } = await pool.query(`
      SELECT 
        COALESCE(SUM(balance_uni), 0) as total_uni_balance,
        COALESCE(SUM(balance_ton), 0) as total_ton_balance,
        COUNT(*) as total_users_with_balance
      FROM users
      WHERE balance_uni > 0 OR balance_ton > 0
    `);
    
    const { total_uni_balance, total_ton_balance, total_users_with_balance } = rows[0];
    
    // Записываем итоговый отчет
    logToFile('\n=== ИТОГОВЫЙ ОТЧЕТ ПО СОЗДАНИЮ СНИМКОВ БАЛАНСОВ ===');
    logToFile(`Дата выполнения: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}`);
    logToFile(`Всего пользователей обработано: ${usersWithBalance.length}`);
    logToFile(`Успешно создано снимков: ${successCount}`);
    logToFile(`Не удалось создать снимки для пользователей: ${failedUsers.join(', ') || 'нет'}`);
    logToFile(`Общий баланс UNI в системе: ${total_uni_balance}`);
    logToFile(`Общий баланс TON в системе: ${total_ton_balance}`);
    logToFile(`Количество пользователей с балансом: ${total_users_with_balance}`);
    logToFile('=== КОНЕЦ ОТЧЕТА ===\n');
    
    return {
      success: true,
      totalUsers: usersWithBalance.length,
      successCount,
      failedCount: failedUsers.length,
      failedUsers,
      totalUniBalance: total_uni_balance,
      totalTonBalance: total_ton_balance,
      totalUsersWithBalance: total_users_with_balance,
    };
  } catch (error: any) {
    logToFile(`КРИТИЧЕСКАЯ ОШИБКА при создании снимков балансов: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Экспортируем функцию для использования в cron-задачах
export default createWalletSnapshots;

// Если скрипт запущен напрямую, выполняем создание снимков
// Используем проверку для ES модулей
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createWalletSnapshots()
    .then((result) => {
      if (result.success) {
        console.log(`Успешно завершено! Создано снимков балансов: ${result.successCount}/${result.totalUsers}`);
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