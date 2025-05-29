/**
 * Оптимизированный сервис фоновых задач
 * 
 * Этот сервис использует оптимизированные запросы к базе данных
 * для значительного улучшения производительности обработки пользователей
 */

import { db } from '../db-connect-unified';
import { users, uniFarmingDeposits, tonBoostDeposits } from '@shared/schema';
import { and, ne, isNotNull, eq, sql } from 'drizzle-orm';
import { NewUniFarmingService } from './newUniFarmingService';
import { UniFarmingService } from './uniFarmingService';
import { TonBoostService } from './tonBoostService';

interface UserWithDeposits {
  id: number;
  telegram_id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  uniDepositsCount: number;
  tonDepositsCount: number;
}

/**
 * Оптимизированная обработка фарминга всех пользователей
 * Использует одиночные JOIN запросы вместо множественных запросов в цикле
 */
export class OptimizedBackgroundService {
  
  /**
   * Получает всех активных пользователей с информацией о депозитах одним запросом
   */
  static async getUsersWithDepositsInfo(): Promise<UserWithDeposits[]> {
    try {
      const result = await db
        .select({
          id: users.id,
          telegram_id: users.telegram_id,
          username: users.username,
          first_name: users.first_name,
          last_name: users.last_name,
          uniDepositsCount: sql<number>`COUNT(DISTINCT ${uniFarmingDeposits.id})`.as('uni_deposits_count'),
          tonDepositsCount: sql<number>`COUNT(DISTINCT ${tonBoostDeposits.id})`.as('ton_deposits_count')
        })
        .from(users)
        .leftJoin(
          uniFarmingDeposits, 
          and(
            eq(uniFarmingDeposits.user_id, users.id),
            eq(uniFarmingDeposits.is_active, true)
          )
        )
        .leftJoin(
          tonBoostDeposits,
          and(
            eq(tonBoostDeposits.user_id, users.id),
            eq(tonBoostDeposits.is_active, true)
          )
        )
        .where(
          and(
            ne(users.telegram_id, ''),
            isNotNull(users.telegram_id)
          )
        )
        .groupBy(users.id, users.telegram_id, users.username, users.first_name, users.last_name)
        .having(
          sql`COUNT(DISTINCT ${uniFarmingDeposits.id}) > 0 OR COUNT(DISTINCT ${tonBoostDeposits.id}) > 0`
        );

      return result;
    } catch (error) {
      console.error('[OptimizedBackgroundService] Error fetching users with deposits:', error);
      throw error;
    }
  }

  /**
   * Оптимизированная обработка фарминга для всех пользователей
   */
  static async processAllUsersFarming(): Promise<{
    processedUsers: number;
    uniUpdates: number;
    tonUpdates: number;
    errors: number;
  }> {
    const startTime = Date.now();
    let processedUsers = 0;
    let uniUpdates = 0;
    let tonUpdates = 0;
    let errors = 0;

    try {
      console.log('[OptimizedBackgroundService] 🚀 Starting optimized farming update cycle');
      
      // Получаем всех пользователей с информацией о депозитах одним запросом
      const usersWithDeposits = await this.getUsersWithDepositsInfo();
      
      console.log(`[OptimizedBackgroundService] Found ${usersWithDeposits.length} users with active deposits`);

      // Обрабатываем пользователей параллельно, но с ограничением concurrency
      const batchSize = 10; // Обрабатываем по 10 пользователей параллельно
      
      for (let i = 0; i < usersWithDeposits.length; i += batchSize) {
        const batch = usersWithDeposits.slice(i, i + batchSize);
        
        await Promise.allSettled(
          batch.map(async (user) => {
            try {
              // Обрабатываем UNI фарминг
              if (user.uniDepositsCount > 0) {
                await NewUniFarmingService.calculateAndUpdateUserFarming(user.id);
                uniUpdates++;
              }

              // Обрабатываем TON фарминг
              if (user.tonDepositsCount > 0) {
                const result = await TonBoostService.calculateAndUpdateUserTonFarming(user.id);
                if (result && result.success) {
                  tonUpdates++;
                }
              }

              processedUsers++;
            } catch (userError) {
              console.error(`[OptimizedBackgroundService] Error processing user ${user.id}:`, userError);
              errors++;
            }
          })
        );

        // Небольшая пауза между батчами для снижения нагрузки на БД
        if (i + batchSize < usersWithDeposits.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log('[OptimizedBackgroundService] ✅ Optimized farming update completed:', {
        duration: `${duration}ms`,
        processedUsers,
        uniUpdates,
        tonUpdates,
        errors,
        avgTimePerUser: processedUsers > 0 ? `${(duration / processedUsers).toFixed(1)}ms` : '0ms'
      });

      return { processedUsers, uniUpdates, tonUpdates, errors };

    } catch (error) {
      console.error('[OptimizedBackgroundService] ❌ Critical error in optimized farming update:', error);
      throw error;
    }
  }

  /**
   * Сравнение производительности старого и нового методов
   */
  static async performanceComparison(): Promise<{
    oldMethod: { duration: number; users: number };
    newMethod: { duration: number; users: number };
    improvement: string;
  }> {
    console.log('[OptimizedBackgroundService] 📊 Starting performance comparison');

    // Измеряем время старого метода (имитация)
    const oldStart = Date.now();
    const usersForOldMethod = await db
      .select()
      .from(users)
      .where(and(ne(users.telegram_id, ''), isNotNull(users.telegram_id)))
      .limit(50); // Ограничиваем для тестирования
    const oldEnd = Date.now();

    // Измеряем время нового метода
    const newStart = Date.now();
    const usersWithDeposits = await this.getUsersWithDepositsInfo();
    const newEnd = Date.now();

    const oldDuration = oldEnd - oldStart;
    const newDuration = newEnd - newStart;
    const improvement = ((oldDuration - newDuration) / oldDuration * 100).toFixed(1);

    const result = {
      oldMethod: { duration: oldDuration, users: usersForOldMethod.length },
      newMethod: { duration: newDuration, users: usersWithDeposits.length },
      improvement: `${improvement}% faster`
    };

    console.log('[OptimizedBackgroundService] 📈 Performance comparison results:', result);
    return result;
  }
}

export default OptimizedBackgroundService;