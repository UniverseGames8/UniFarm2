/**
 * Инстанс-ориентированная имплементация сервиса логирования запусков Mini App
 * 
 * Этот файл содержит реализацию сервиса логирования запусков,
 * который работает с таблицей launch_logs и обеспечивает отслеживание запусков приложения
 */

import { db } from '../db';
import { launchLogs, type InsertLaunchLog, type LaunchLog } from '@shared/schema';
import crypto from 'crypto';
import { eq, gt, and } from 'drizzle-orm';

/**
 * Интерфейс для сервиса логирования запусков
 */
export interface ILaunchLogService {
  /**
   * Записывает информацию о запуске Mini App
   * @param logData Данные о запуске
   * @returns Созданная запись
   */
  logLaunch(logData: InsertLaunchLog): Promise<LaunchLog>;

  /**
   * Получает все записи о запусках для определенного пользователя
   * @param telegramUserId ID пользователя в Telegram
   * @returns Список запусков
   */
  getUserLaunches(telegramUserId: number): Promise<LaunchLog[]>;

  /**
   * Получает статистику запусков приложения
   * @param daysLimit Количество дней для выборки (по умолчанию 30)
   * @returns Статистика запусков
   */
  getAppLaunchStatistics(daysLimit?: number): Promise<any>;
  
  /**
   * Проверяет, не превышен ли лимит запусков для пользователя
   * @param telegramUserId ID пользователя в Telegram
   * @returns true если пользователя нужно ограничить, false если нет
   */
  shouldThrottleUser(telegramUserId: number | null | undefined): Promise<boolean>;
}

/**
 * Создает сервис логирования запусков
 * @returns Экземпляр сервиса ILaunchLogService
 */
export function createLaunchLogService(): ILaunchLogService {
  /**
   * Максимальное количество запусков для одного пользователя за минуту
   * (для предотвращения спама)
   */
  const MAX_LAUNCHES_PER_MINUTE = 5;

  return {
    /**
     * Записывает информацию о запуске Mini App
     * @param logData Данные о запуске
     * @returns Созданная запись
     */
    async logLaunch(logData: InsertLaunchLog): Promise<LaunchLog> {
      try {
        // Создаем уникальный идентификатор запроса, если он не передан
        if (!logData.request_id) {
          logData.request_id = crypto.randomUUID();
        }

        // Проверяем, не слишком ли часто поступают запросы от этого пользователя
        if (await this.shouldThrottleUser(logData.telegram_user_id)) {
          console.warn(`[LaunchLog] Throttling excessive launch logs for user ${logData.telegram_user_id}`);
          throw new Error('Rate limit exceeded for this user');
        }

        console.log(`[launch] Новый запуск: { user_id: ${logData.telegram_user_id}, platform: ${logData.platform}, timestamp: ${logData.timestamp || new Date()} }`);

        // Записываем запуск приложения в базу данных
        const [log] = await db
          .insert(launchLogs)
          .values(logData)
          .returning();

        return log;
      } catch (error) {
        console.error('[LaunchLogService] Error logging launch:', error);
        throw error;
      }
    },

    /**
     * Получает все записи о запусках для определенного пользователя
     * @param telegramUserId ID пользователя в Telegram
     * @returns Список запусков
     */
    async getUserLaunches(telegramUserId: number): Promise<LaunchLog[]> {
      try {
        const logs = await db
          .select()
          .from(launchLogs)
          .where(eq(launchLogs.telegram_user_id, telegramUserId));
          
        // Сортировка выполняется через JavaScript вместо SQL
        return logs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      } catch (error) {
        console.error('[LaunchLogService] Error fetching user launches:', error);
        return [];
      }
    },

    /**
     * Проверяет, не превышен ли лимит запусков для пользователя
     * @param telegramUserId ID пользователя в Telegram
     * @returns true если пользователя нужно ограничить, false если нет
     */
    async shouldThrottleUser(telegramUserId: number | null | undefined): Promise<boolean> {
      try {
        if (!telegramUserId) {
          return false; // Не ограничиваем, если ID не определен
        }

        // Получаем количество запусков за последнюю минуту
        const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
        
        const logs = await db
          .select()
          .from(launchLogs)
          .where(
            and(
              eq(launchLogs.telegram_user_id, telegramUserId),
              gt(launchLogs.timestamp, oneMinuteAgo)
            )
          );

        return logs.length >= MAX_LAUNCHES_PER_MINUTE;
      } catch (error) {
        console.error('[LaunchLogService] Error checking throttle:', error);
        return false; // В случае ошибки не ограничиваем, чтобы не блокировать легитимных пользователей
      }
    },

    /**
     * Получает статистику запусков приложения
     * @param daysLimit Количество дней для выборки (по умолчанию 30)
     * @returns Статистика запусков
     */
    async getAppLaunchStatistics(daysLimit: number = 30): Promise<any> {
      try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysLimit);
        
        // Запрос к базе для получения статистики
        const logs = await db
          .select()
          .from(launchLogs)
          .where(gt(launchLogs.timestamp, startDate));
        
        // Группировка по дате
        const groupedByDate: Record<string, any> = {};
        
        logs.forEach(log => {
          const date = log.timestamp.toISOString().split('T')[0];
          if (!groupedByDate[date]) {
            groupedByDate[date] = {
              date,
              count: 0,
              uniqueUsers: new Set(),
              platforms: {}
            };
          }
          
          groupedByDate[date].count++;
          
          if (log.telegram_user_id) {
            groupedByDate[date].uniqueUsers.add(log.telegram_user_id);
          }
          
          if (log.platform) {
            if (!groupedByDate[date].platforms[log.platform]) {
              groupedByDate[date].platforms[log.platform] = 0;
            }
            groupedByDate[date].platforms[log.platform]++;
          }
        });
        
        // Преобразование для ответа API
        return Object.values(groupedByDate).map((dateStats: any) => ({
          ...dateStats,
          uniqueUsers: dateStats.uniqueUsers.size,
          platforms: Object.entries(dateStats.platforms).map(([name, count]: [string, any]) => ({
            name,
            count
          }))
        }));
      } catch (error) {
        console.error('[LaunchLogService] Error getting app launch statistics:', error);
        return [];
      }
    }
  };
}