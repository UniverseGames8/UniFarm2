import { Request, Response, NextFunction } from 'express';
import { missionServiceFixed } from '../services/missionServiceFixed';

/**
 * Контроллер для работы с миссиями (ИСПРАВЛЕННАЯ ВЕРСИЯ)
 */
export class MissionControllerFixed {
  /**
   * Получает все активные миссии
   */
  static async getActiveMissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      console.log('[MissionControllerFixed] 🚀 Запрос активных миссий');
      
      const activeMissions = await missionServiceFixed.getActiveMissions();
      
      console.log('[MissionControllerFixed] ✅ Возвращаем миссии:', activeMissions.length);
      
      // Принудительно очищаем кэш для получения актуальных миссий
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Last-Modified': new Date().toUTCString()
      });
      
      res.status(200).json({
        success: true,
        data: activeMissions,
        message: 'Активные миссии успешно получены'
      });
    } catch (error) {
      console.error('[MissionControllerFixed] ❌ Ошибка при получении активных миссий:', error);
      
      res.status(500).json({
        success: false,
        error: 'Ошибка при получении активных миссий',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Получает выполненные миссии пользователя
   */
  static async getUserCompletedMissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseInt(req.query.user_id as string) || 1;
      console.log('[MissionControllerFixed] 🚀 Запрос выполненных миссий для пользователя:', userId);
      
      const completedMissions = await missionServiceFixed.getUserCompletedMissions(userId);
      
      console.log('[MissionControllerFixed] ✅ Возвращаем выполненные миссии:', completedMissions.length);
      
      res.status(200).json({
        success: true,
        data: completedMissions,
        message: 'Выполненные миссии успешно получены'
      });
    } catch (error) {
      console.error('[MissionControllerFixed] ❌ Ошибка при получении выполненных миссий:', error);
      
      res.status(500).json({
        success: false,
        error: 'Ошибка при получении выполненных миссий',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Завершает миссию и начисляет награду
   */
  static async completeMission(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user_id, mission_id } = req.body;
      
      if (!user_id || !mission_id) {
        return res.status(400).json({
          success: false,
          error: 'Не указан ID пользователя или ID миссии'
        });
      }

      console.log('[MissionControllerFixed] 🚀 Завершение миссии:', { user_id, mission_id });
      
      // Завершаем миссию и получаем информацию о награде
      const result = await missionServiceFixed.completeMission(Number(user_id), Number(mission_id));
      
      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.message || 'Не удалось завершить миссию'
        });
      }

      console.log('[MissionControllerFixed] ✅ Миссия успешно завершена:', result);
      
      res.status(200).json({
        success: true,
        data: {
          mission_id: Number(mission_id),
          user_id: Number(user_id),
          reward: result.reward || 500, // REDMAP: 500 UNI за миссию
          completed_at: new Date().toISOString(),
          new_balance: result.new_balance
        },
        message: `Миссия завершена! Получена награда: ${result.reward || 500} UNI`
      });
    } catch (error) {
      console.error('[MissionControllerFixed] ❌ Ошибка при завершении миссии:', error);
      
      res.status(500).json({
        success: false,
        error: 'Ошибка при завершении миссии',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Получает миссии с информацией о завершении для пользователя
   */
  static async getMissionsWithCompletion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.query.user_id || req.params.userId;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'Не указан ID пользователя'
        });
      }

      console.log('[MissionControllerFixed] 🚀 Запрос миссий с завершением для пользователя:', userId);
      
      const missions = await missionServiceFixed.getActiveMissions();
      const userCompletedMissions = await missionServiceFixed.getUserCompletedMissions(Number(userId));
      
      // Добавляем информацию о завершении к каждой миссии
      const missionsWithCompletion = missions.map(mission => ({
        ...mission,
        isCompleted: userCompletedMissions.some(completed => completed.mission_id === mission.id),
        completedAt: userCompletedMissions.find(completed => completed.mission_id === mission.id)?.completed_at || null
      }));
      
      console.log('[MissionControllerFixed] ✅ Возвращаем миссии с завершением:', missionsWithCompletion.length);
      
      res.status(200).json({
        success: true,
        data: missionsWithCompletion,
        message: 'Миссии с информацией о завершении успешно получены'
      });
    } catch (error) {
      console.error('[MissionControllerFixed] ❌ Ошибка при получении миссий с завершением:', error);
      
      res.status(500).json({
        success: false,
        error: 'Ошибка при получении миссий с завершением',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Проверяет завершение конкретной миссии пользователем
   */
  static async checkMissionCompletion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, missionId } = req.params;
      
      if (!userId || !missionId) {
        return res.status(400).json({
          success: false,
          error: 'Не указан ID пользователя или ID миссии'
        });
      }

      console.log('[MissionControllerFixed] 🚀 Проверка завершения миссии:', { userId, missionId });
      
      const userCompletedMissions = await missionServiceFixed.getUserCompletedMissions(Number(userId));
      const isCompleted = userCompletedMissions.some(completed => completed.mission_id === Number(missionId));
      const completionData = userCompletedMissions.find(completed => completed.mission_id === Number(missionId));
      
      console.log('[MissionControllerFixed] ✅ Проверка завершена:', { isCompleted, completionData });
      
      res.status(200).json({
        success: true,
        data: {
          userId: Number(userId),
          missionId: Number(missionId),
          isCompleted,
          completedAt: completionData?.completed_at || null,
          reward: completionData?.reward || null
        },
        message: isCompleted ? 'Миссия завершена' : 'Миссия не завершена'
      });
    } catch (error) {
      console.error('[MissionControllerFixed] ❌ Ошибка при проверке завершения миссии:', error);
      
      res.status(500).json({
        success: false,
        error: 'Ошибка при проверке завершения миссии',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
}