import { getSingleDbConnection } from '../single-db-connection';
import { missions, userMissions, users, transactions, Mission, UserMission } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { NotFoundError, ValidationError, InsufficientFundsError } from '../middleware/errorHandler';

/**
 * Статусы миссий
 */
export enum MissionStatus {
  AVAILABLE = 'available',
  PROCESSING = 'processing',
  COMPLETED = 'completed'
}

/**
 * Интерфейс для результата выполнения миссии 
 */
export interface MissionCompletionResult {
  success: boolean;
  message: string;
  reward?: number;
}

/**
 * Интерфейс для результата проверки миссии 
 */
export interface MissionSubmissionResult {
  success: boolean;
  message: string;
  status: MissionStatus;
  progress?: number;
}

/**
 * Интерфейс для получения статуса миссии
 */
export interface MissionStatusResult {
  id: number;
  status: MissionStatus;
  progress?: number;
  isCompleted: boolean;
  canClaim: boolean;
  completedAt?: Date | null;
}

/**
 * Интерфейс для полных данных миссии с информацией о её выполнении
 */
export interface MissionWithCompletion {
  id: number;
  type: string | null;
  title: string | null;
  description: string | null;
  reward_uni: string | null;
  is_active: boolean | null;
  is_completed: boolean;
  completed_at?: Date | null;
  status?: MissionStatus;
  progress?: number;
}

/**
 * Реализация сервиса для работы с миссиями
 * Содержит всю бизнес-логику для операций с миссиями
 */
class MissionServiceFixed {
  /**
   * Получает все активные миссии
   */
  async getActiveMissions(): Promise<Mission[]> {
    try {
      console.log('[MissionServiceFixed] 🔍 ИССЛЕДОВАНИЕ: Запрос активных миссий через Drizzle ORM');
      
      // Получаем правильное подключение к БД
      const db = await getSingleDbConnection();
      console.log('[MissionServiceFixed] 📡 DB CONNECTION TYPE:', typeof db);
      
      // Тестируем прямой SQL запрос
      const rawResult = await db.execute(sql`SELECT COUNT(*) as count FROM missions WHERE is_active = true`);
      console.log('[MissionServiceFixed] 📊 RAW SQL COUNT:', rawResult);
      
      const activeMissions = await db
        .select()
        .from(missions)
        .where(eq(missions.is_active, true));
      
      console.log('[MissionServiceFixed] 📋 DRIZZLE RESULT:', activeMissions);
      console.log('[MissionServiceFixed] 📊 DRIZZLE COUNT:', activeMissions.length);
      
      return activeMissions;
    } catch (error) {
      console.error('[MissionServiceFixed] ❌ КРИТИЧЕСКАЯ ОШИБКА при получении активных миссий:', error);
      throw new Error('Не удалось загрузить активные миссии');
    }
  }

  /**
   * Получает все выполненные миссии пользователя
   */
  async getUserCompletedMissions(userId: number): Promise<UserMission[]> {
    try {
      const db = await getSingleDbConnection();
      
      const completedMissions = await db
        .select()
        .from(userMissions)
        .where(eq(userMissions.user_id, userId));
      
      return completedMissions;
    } catch (error) {
      console.error('[MissionServiceFixed] Ошибка при получении выполненных миссий:', error);
      throw new Error('Не удалось загрузить выполненные миссии');
    }
  }
}

/**
 * Создает новый экземпляр сервиса миссий
 */
export function createMissionServiceFixed() {
  return new MissionServiceFixed();
}

export const missionServiceFixed = createMissionServiceFixed();