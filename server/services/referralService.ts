/**
 * Прокси-модуль для доступа к сервису работы с рефералами
 * 
 * Это файл использует паттерн прокси для перенаправления вызовов статических методов
 * к методам экземпляра IReferralService из referralServiceInstance.
 * 
 * Такой подход позволяет сохранить обратную совместимость с кодом, использующим
 * статические методы, но при этом использовать преимущества инстанс-паттерна.
 */

import { Referral, InsertReferral } from '@shared/schema';
import { ValidationError } from '../middleware/errorHandler';

// Типы данных для реферальной системы
export interface RefTreeNode {
  id: number;
  username: string | null;
  ref_code: string | null;
  level: number;
}

export interface ReferralRewardInfo {
  level: number;
  uni: number;
  ton: number;
}

export interface ReferralData {
  user_id: number;
  username: string | null;
  ref_code: string | null;
  total_referrals: number;
  referral_counts: Record<number, number>;
  level_income: Record<number, { uni: number, ton: number }>;
  referrals: Referral[];
}

export interface ReferralRelationshipResult {
  referral: Referral | null;
  success: boolean;
  isNewConnection: boolean;
  message: string;
}

export interface StartParamProcessResult {
  inviterId: number | null;
  refCode: string | null;
}

// Тип для безопасного доступа к свойству message у ошибок
type ErrorWithMessage = { message: string };

/**
 * Интерфейс сервиса для работы с реферальной системой
 * 
 * Все методы могут выбрасывать исключения:
 * @throws {ValidationError} Если переданы некорректные параметры
 * @throws {Error} При ошибке в работе сервиса
 */
export interface IReferralService {
  /**
   * Строит реферальный путь для пользователя (Этап 4.1)
   * @param userId ID пользователя, для которого нужно построить ref_path
   * @returns Массив ID пригласителей [inviter_id, inviter_inviter_id, ...]
   */
  buildRefPath(userId: number): Promise<number[]>;
  
  /**
   * Получает все реферальные связи пользователя
   * @param userId ID пользователя
   * @returns Массив реферальных связей (пустой массив, если рефералов нет)
   */
  getUserReferrals(userId: number): Promise<Referral[]>;
  
  /**
   * Создает новую реферальную связь
   * @param referralData Данные реферальной связи
   * @returns Созданная реферальная связь
   * @throws {Error} При ошибке создания связи
   */
  createReferral(referralData: InsertReferral): Promise<Referral>;
  
  /**
   * Получает реферальное дерево пользователя
   * @param userId ID пользователя
   * @returns Реферальное дерево
   * @throws {ValidationError} Если пользователь не найден
   * @throws {Error} При ошибке получения данных
   */
  getReferralTree(userId: number): Promise<any>;
  
  /**
   * Получает статистику реферальной программы для пользователя
   * @param userId ID пользователя
   * @returns Статистика по рефералам
   * @throws {ValidationError} Если пользователь не найден
   * @throws {Error} При ошибке получения данных
   */
  getReferralStats(userId: number): Promise<any>;
  
  /**
   * Проверяет, есть ли у пользователя пригласитель
   * @param userId ID пользователя
   * @returns Реферальная связь или undefined, если пригласителя нет
   */
  getUserInviter(userId: number): Promise<Referral | undefined>;
  
  /**
   * Получает количество рефералов пользователя по уровням
   * @param userId ID пользователя
   * @returns Объект с количеством рефералов по уровням (пустой объект, если нет рефералов)
   */
  getReferralCounts(userId: number): Promise<Record<number, number>>;
  
  /**
   * Получает данные о доходах пользователя от рефералов по уровням
   * @param userId ID пользователя
   * @returns Объект с доходами по уровням (пустой объект, если нет доходов)
   */
  getLevelIncomeData(userId: number): Promise<Record<number, { uni: number, ton: number }>>;
  
  /**
   * Создает или проверяет реферальную связь между пользователями
   * @param userId ID пользователя, которого приглашают
   * @param inviterId ID пригласителя
   * @param level Уровень реферальной связи (по умолчанию 1)
   * @returns Результат операции с информацией о связи
   * @throws {ValidationError} Если переданы некорректные параметры
   * @throws {Error} При ошибке создания связи
   */
  createReferralRelationship(
    userId: number, 
    inviterId: number, 
    level?: number
  ): Promise<ReferralRelationshipResult>;
}

// Импортируем экземпляр сервиса для прокси-функций
import { referralService } from './index.js';

/**
 * Прокси-класс для совместимости с существующим кодом.
 * Перенаправляет все статические методы к методам экземпляра referralService
 */
export class ReferralService {
  /**
   * Строит реферальный путь для пользователя
   * @param userId ID пользователя
   * @returns Массив ID пригласителей
   */
  static async buildRefPath(userId: number): Promise<number[]> {
    try {
      return await referralService.buildRefPath(userId);
    } catch (error) {
      console.error(`[ReferralService Proxy] Error in buildRefPath:`, error);
      return []; // В случае ошибки возвращаем пустой массив
    }
  }
  
  /**
   * Получает все реферальные связи пользователя
   * @param userId ID пользователя
   * @returns Массив реферальных связей
   */
  static async getUserReferrals(userId: number): Promise<Referral[]> {
    try {
      return await referralService.getUserReferrals(userId);
    } catch (error) {
      console.error(`[ReferralService Proxy] Error in getUserReferrals:`, error);
      return []; // В случае ошибки возвращаем пустой массив
    }
  }
  
  /**
   * Создает новую реферальную связь
   * @param referralData Данные реферальной связи
   * @returns Созданная реферальная связь
   */
  static async createReferral(referralData: InsertReferral): Promise<Referral> {
    return await referralService.createReferral(referralData);
  }
  
  /**
   * Получает реферальное дерево пользователя
   * @param userId ID пользователя
   * @returns Реферальное дерево
   */
  static async getReferralTree(userId: number): Promise<any> {
    return await referralService.getReferralTree(userId);
  }
  
  /**
   * Получает статистику реферальной программы для пользователя
   * @param userId ID пользователя
   * @returns Статистика по рефералам
   */
  static async getReferralStats(userId: number): Promise<any> {
    return await referralService.getReferralStats(userId);
  }
  
  /**
   * Проверяет, есть ли у пользователя пригласитель
   * @param userId ID пользователя
   * @returns Реферальная связь или undefined, если пригласителя нет
   */
  static async getUserInviter(userId: number): Promise<Referral | undefined> {
    try {
      return await referralService.getUserInviter(userId);
    } catch (error) {
      console.error(`[ReferralService Proxy] Error in getUserInviter:`, error);
      return undefined;
    }
  }
  
  /**
   * Получает количество рефералов пользователя по уровням
   * @param userId ID пользователя
   * @returns Объект с количеством рефералов по уровням
   */
  static async getReferralCounts(userId: number): Promise<Record<number, number>> {
    try {
      return await referralService.getReferralCounts(userId);
    } catch (error) {
      console.error(`[ReferralService Proxy] Error in getReferralCounts:`, error);
      return {}; // В случае ошибки возвращаем пустой объект
    }
  }
  
  /**
   * Получает данные о доходах пользователя от рефералов по уровням
   * @param userId ID пользователя
   * @returns Объект с доходами по уровням
   */
  static async getLevelIncomeData(userId: number): Promise<Record<number, { uni: number, ton: number }>> {
    try {
      return await referralService.getLevelIncomeData(userId);
    } catch (error) {
      console.error(`[ReferralService Proxy] Error in getLevelIncomeData:`, error);
      return {}; // В случае ошибки возвращаем пустой объект
    }
  }
  
  /**
   * Создает или проверяет реферальную связь между пользователями
   * @param userId ID пользователя, которого приглашают
   * @param inviterId ID пригласителя
   * @param level Уровень реферальной связи (по умолчанию 1)
   * @returns Результат операции с информацией о связи
   */
  static async createReferralRelationship(
    userId: number, 
    inviterId: number, 
    level?: number
  ): Promise<ReferralRelationshipResult> {
    return await referralService.createReferralRelationship(userId, inviterId, level);
  }
}