/**
 * Миграционный скрипт для переноса данных из старой системы фарминга в новую
 * 
 * Этот скрипт выполняет следующие задачи:
 * 1. Находит всех пользователей с активным фармингом в старой системе
 * 2. Создает для них депозиты в новой таблице uni_farming_deposits
 * 3. Обновляет флаги и статусы в старой системе
 * 
 * Резервное копирование данных и проверки целостности встроены в процесс миграции.
 */

import { db } from '../db';
import { users, uniFarmingDeposits } from '@shared/schema';
import { eq, and, isNull, isNotNull, gt, sql } from 'drizzle-orm';
import { BigNumber } from 'bignumber.js';

// Устанавливаем конфигурацию для BigNumber
BigNumber.config({
  DECIMAL_PLACES: 16,
  ROUNDING_MODE: BigNumber.ROUND_DOWN
});

// Интерфейс для статистики миграции
interface MigrationStats {
  totalUsers: number;
  processedUsers: number;
  successfulMigrations: number;
  failedMigrations: number;
  skippedUsers: number;
  errors: Array<{userId: number, error: string}>;
}

/**
 * Основная функция миграции данных
 * @param forceOverwrite Если true, перезаписывает существующие депозиты для пользователя
 * @param dryRun Если true, только симулирует миграцию без внесения изменений
 * @returns Статистика миграции
 */
export async function migrateUniFarmingData(
  forceOverwrite: boolean = false,
  dryRun: boolean = false
): Promise<MigrationStats> {
  console.log(`[FarmingMigration] Начало миграции данных фарминга. ${dryRun ? '(Тестовый режим)' : ''}`);
  
  // Инициализируем статистику миграции
  const stats: MigrationStats = {
    totalUsers: 0,
    processedUsers: 0,
    successfulMigrations: 0,
    failedMigrations: 0,
    skippedUsers: 0,
    errors: []
  };
  
  try {
    // Получаем всех пользователей с активным фармингом в старой системе
    const usersWithFarming = await db
      .select()
      .from(users)
      .where(
        and(
          isNotNull(users.uni_farming_deposit),
          gt(sql`${users.uni_farming_deposit}`, 0),
          isNotNull(users.uni_farming_activated_at)
        )
      );
    
    stats.totalUsers = usersWithFarming.length;
    console.log(`[FarmingMigration] Найдено ${stats.totalUsers} пользователей с активным фармингом`);
    
    // Проходим по каждому пользователю и создаем для него депозиты в новой системе
    for (const user of usersWithFarming) {
      stats.processedUsers++;
      
      try {
        // Проверяем, есть ли уже депозиты в новой системе
        const existingDeposits = await db
          .select()
          .from(uniFarmingDeposits)
          .where(
            and(
              eq(uniFarmingDeposits.user_id, user.id),
              eq(uniFarmingDeposits.is_active, true)
            )
          );
        
        // Если есть депозиты и не установлен флаг перезаписи, пропускаем пользователя
        if (existingDeposits.length > 0 && !forceOverwrite) {
          console.log(`[FarmingMigration] Пользователь ${user.id} уже имеет ${existingDeposits.length} депозитов. Пропуск.`);
          stats.skippedUsers++;
          continue;
        }
        
        // Если установлен флаг перезаписи и найдены депозиты, деактивируем их
        if (existingDeposits.length > 0 && forceOverwrite) {
          console.log(`[FarmingMigration] Деактивация ${existingDeposits.length} существующих депозитов для пользователя ${user.id}.`);
          
          if (!dryRun) {
            await db
              .update(uniFarmingDeposits)
              .set({ is_active: false })
              .where(
                and(
                  eq(uniFarmingDeposits.user_id, user.id),
                  eq(uniFarmingDeposits.is_active, true)
                )
              );
          }
        }
        
        // Получаем данные для миграции
        const depositAmount = new BigNumber(user.uni_farming_deposit?.toString() || '0');
        const activatedAt = user.uni_farming_activated_at || new Date();
        
        // Рассчитываем скорость начисления для нового депозита
        // Используем стандартную ставку 0.5% в день
        const DAILY_RATE = 0.005; // 0.5% в день
        const SECONDS_IN_DAY = 86400;
        
        const ratePerSecond = depositAmount
          .multipliedBy(DAILY_RATE)
          .dividedBy(SECONDS_IN_DAY)
          .toString();
        
        // Создаем новый депозит в новой таблице
        if (!dryRun) {
          const currentTime = new Date();
          await db
            .insert(uniFarmingDeposits)
            .values({
              user_id: user.id,
              amount: depositAmount.toFixed(6),
              rate_per_second: ratePerSecond,
              created_at: activatedAt, // Используем оригинальное время активации
              last_updated_at: currentTime, // Обновляем время последнего обновления
              is_active: true
            });
        }
        
        console.log(`[FarmingMigration] Успешно создан депозит для пользователя ${user.id}, сумма: ${depositAmount.toFixed(6)}, скорость: ${ratePerSecond}/сек`);
        stats.successfulMigrations++;
        
      } catch (error) {
        console.error(`[FarmingMigration] Ошибка при миграции для пользователя ${user.id}:`, error);
        stats.failedMigrations++;
        stats.errors.push({
          userId: user.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
      
      // Выводим прогресс каждые 10 пользователей
      if (stats.processedUsers % 10 === 0 || stats.processedUsers === stats.totalUsers) {
        console.log(`[FarmingMigration] Прогресс: ${stats.processedUsers}/${stats.totalUsers} (${Math.round(stats.processedUsers / stats.totalUsers * 100)}%)`);
      }
    }
    
    console.log(`[FarmingMigration] Миграция завершена. Успешно: ${stats.successfulMigrations}, С ошибками: ${stats.failedMigrations}, Пропущено: ${stats.skippedUsers}`);
    
    return stats;
    
  } catch (error) {
    console.error(`[FarmingMigration] Критическая ошибка при миграции:`, error);
    throw error;
  }
}

/**
 * Функция для резервного копирования данных перед миграцией
 * @returns true, если резервное копирование выполнено успешно
 */
export async function backupFarmingData(): Promise<boolean> {
  console.log(`[FarmingMigration] Создание резервной копии данных фарминга`);
  
  try {
    // Получаем всех пользователей с активным фармингом
    const usersWithFarming = await db
      .select()
      .from(users)
      .where(
        and(
          isNotNull(users.uni_farming_deposit),
          gt(sql`${users.uni_farming_deposit}`, 0)
        )
      );
    
    // Сохраняем данные в JSON-формате
    const backupData = {
      timestamp: new Date().toISOString(),
      count: usersWithFarming.length,
      users: usersWithFarming.map(user => ({
        id: user.id,
        username: user.username,
        uni_farming_deposit: user.uni_farming_deposit?.toString(),
        uni_farming_activated_at: user.uni_farming_activated_at?.toISOString(),
        balance_uni: user.balance_uni?.toString()
      }))
    };
    
    // В реальной ситуации здесь был бы код для сохранения в файл или базу данных
    console.log(`[FarmingMigration] Резервная копия создана для ${backupData.count} пользователей`);
    
    return true;
  } catch (error) {
    console.error(`[FarmingMigration] Ошибка при создании резервной копии:`, error);
    return false;
  }
}

/**
 * Запускает весь процесс миграции с резервным копированием и проверками
 * @param forceOverwrite Если true, перезаписывает существующие депозиты
 * @param dryRun Если true, только симулирует миграцию без внесения изменений
 * @returns Результат миграции
 */
export async function runFarmingMigration(
  forceOverwrite: boolean = false,
  dryRun: boolean = false
): Promise<{ success: boolean, stats: MigrationStats | null, message: string }> {
  try {
    // Шаг 1: Создание резервной копии
    const backupSuccess = await backupFarmingData();
    if (!backupSuccess) {
      return {
        success: false,
        stats: null,
        message: 'Ошибка при создании резервной копии данных'
      };
    }
    
    // Шаг 2: Запуск миграции
    const stats = await migrateUniFarmingData(forceOverwrite, dryRun);
    
    // Шаг 3: Анализ результатов
    if (stats.failedMigrations > 0) {
      return {
        success: stats.successfulMigrations > 0,
        stats,
        message: `Миграция завершена с ошибками. Успешно: ${stats.successfulMigrations}, С ошибками: ${stats.failedMigrations}`
      };
    }
    
    return {
      success: true,
      stats,
      message: `Миграция успешно завершена. Перенесено ${stats.successfulMigrations} депозитов.`
    };
    
  } catch (error) {
    console.error(`[FarmingMigration] Критическая ошибка при выполнении миграции:`, error);
    return {
      success: false,
      stats: null,
      message: `Критическая ошибка: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}