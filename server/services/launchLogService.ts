import { type InsertLaunchLog, type LaunchLog } from '@shared/schema';
import { launchLogService } from './index';
import { type ILaunchLogService } from './launchLogServiceInstance';

/**
 * Сервис для логирования запусков Mini App (Этап 5.1)
 * 
 * ЗАМЕТКА: Этот класс является прокси для сервиса с инстансами из launchLogServiceInstance.ts
 * для обеспечения обратной совместимости со старым кодом.
 */
export class LaunchLogService {
  /**
   * Записывает информацию о запуске Mini App
   * @param logData Данные о запуске
   * @returns Созданная запись
   */
  static async logLaunch(logData: InsertLaunchLog): Promise<LaunchLog> {
    return launchLogService.logLaunch(logData);
  }

  /**
   * Получает все записи о запусках для определенного пользователя
   * @param telegramUserId ID пользователя в Telegram
   * @returns Список запусков
   */
  static async getUserLaunches(telegramUserId: number): Promise<LaunchLog[]> {
    return launchLogService.getUserLaunches(telegramUserId);
  }

  /**
   * Получает статистику запусков по платформам
   * @returns Объект с количеством запусков по платформам
   */
  static async getPlatformStats(): Promise<Record<string, number>> {
    try {
      // Получаем статистику через новый сервис
      const stats = await launchLogService.getAppLaunchStatistics(30);
      
      // Преобразуем в старый формат для совместимости
      const platformStats: Record<string, number> = {};
      
      // Собираем данные по платформам из всех дней
      stats.forEach((dayStat: any) => {
        dayStat.platforms.forEach((platform: {name: string, count: number}) => {
          platformStats[platform.name] = (platformStats[platform.name] || 0) + platform.count;
        });
      });
      
      return platformStats;
    } catch (error) {
      console.error('[LaunchLogService] Error fetching platform stats:', error);
      return {};
    }
  }
}