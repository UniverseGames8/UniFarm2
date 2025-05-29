import { referrals, Referral, InsertReferral, users, User } from '@shared/schema';
import { eq, sql, and } from 'drizzle-orm';
import { ValidationError } from '../middleware/errorHandler';
import { IExtendedStorage } from '../storage-interface';

// Максимальная глубина реферальной цепочки согласно ТЗ
const MAX_REFERRAL_PATH_DEPTH = 20;

/**
 * Типы данных для реферальной системы
 */
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

/**
 * Интерфейс сервиса для работы с реферальной системой
 */
export interface IReferralService {
  buildRefPath(userId: number): Promise<number[]>;
  getUserReferrals(userId: number): Promise<Referral[]>;
  createReferral(referralData: InsertReferral): Promise<Referral>;
  getReferralTree(userId: number): Promise<any>;
  getReferralStats(userId: number): Promise<any>;
  getUserInviter(userId: number): Promise<Referral | undefined>;
  getReferralCounts(userId: number): Promise<Record<number, number>>;
  getLevelIncomeData(userId: number): Promise<Record<number, { uni: number, ton: number }>>;
  createReferralRelationship(
    userId: number, 
    inviterId: number, 
    level?: number
  ): Promise<{
    referral: Referral | null;
    success: boolean;
    isNewConnection: boolean;
    message: string;
  }>;
}

/**
 * Сервис для работы с реферальной системой
 * Реализует бизнес-логику работы с рефералами согласно SOLID принципам
 */
export class ReferralService implements IReferralService {
  constructor(private storage: IExtendedStorage) {}
  
  /**
   * Строит реферальный путь для пользователя (Этап 4.1)
   * Рекурсивно проходит вверх по цепочке приглашений до 20 уровня
   * 
   * @param userId ID пользователя, для которого нужно построить ref_path
   * @returns Массив ID пригласителей [inviter_id, inviter_inviter_id, ...]
   */
  async buildRefPath(userId: number): Promise<number[]> {
    if (!userId) {
      console.log('[ReferralService] Cannot build ref_path for null userId');
      return [];
    }
    
    try {
      // Новый подход с использованием parent_ref_code
      try {
        const refPath: number[] = [];
        
        // Получаем пользователя и его parent_ref_code
        const currentUser = await this.storage.getUser(userId);
        
        // Если у пользователя нет parent_ref_code, возвращаем пустой массив
        if (!currentUser || !currentUser.parent_ref_code) {
          console.log(`[ReferralService] User ${userId} has no parent_ref_code`);
          return [];
        }
        
        let depth = 0;
        let tempUser = currentUser;
        
        // Итеративно поднимаемся вверх по цепочке пригласителей
        while (tempUser && tempUser.parent_ref_code && depth < MAX_REFERRAL_PATH_DEPTH) {
          // Находим пользователя с ref_code = parent_ref_code текущего пользователя
          const inviter = await this.storage.getUserByRefCode(tempUser.parent_ref_code);
              
          if (inviter) {
            // Добавляем ID пригласителя в путь
            refPath.push(inviter.id);
            
            // Переходим к следующему пригласителю
            tempUser = inviter;
          } else {
            // Если пригласитель не найден, прерываем цикл
            break;
          }
          
          depth++;
        }
        
        console.log(`[referral] Построен ref_path с parent_ref_code: [${refPath.join(', ')}]`);
        return refPath;
      } catch (innerError) {
        console.error('[ReferralService] Error building ref_path with parent_ref_code:', innerError);
        
        // Старый метод через таблицу referrals
        console.log('[ReferralService] Falling back to legacy ref_path building');
        const refPath: number[] = [];
        let currentUserInviter = await this.getUserInviter(userId);
        
        // Если у пользователя нет пригласителя, возвращаем пустой массив
        if (!currentUserInviter) {
          console.log(`[ReferralService] No inviter found for user ${userId}`);
          return [];
        }
        
        // Итеративно поднимаемся вверх по цепочке пригласителей
        let depth = 0;
        let currentUserId = userId;
        
        while (currentUserInviter && depth < MAX_REFERRAL_PATH_DEPTH) {
          // Добавляем ID пригласителя в путь
          if (currentUserInviter.inviter_id) {
            refPath.push(currentUserInviter.inviter_id);
            
            // Переходим к пригласителю текущего пригласителя
            currentUserId = currentUserInviter.inviter_id;
            currentUserInviter = await this.getUserInviter(currentUserId);
          } else {
            // Если по какой-то причине inviter_id не определен, прерываем цикл
            break;
          }
          
          depth++;
        }
        
        console.log(`[referral] Построен ref_path через legacy метод: [${refPath.join(', ')}]`);
        return refPath;
      }
    } catch (error) {
      console.error(`[ReferralService] Error building ref_path for user ${userId}:`, error);
      return []; // В случае ошибки возвращаем пустой массив
    }
  }
  
  /**
   * Получает все реферальные связи пользователя
   * @param userId ID пользователя
   * @returns Массив реферальных связей (пустой массив, если рефералов нет)
   */
  async getUserReferrals(userId: number): Promise<Referral[]> {
    try {
      if (!userId || typeof userId !== 'number' || userId <= 0) {
        console.log('[ReferralService] Invalid userId:', userId);
        return []; // Возвращаем пустой массив при некорректном userId
      }
      
      try {
        // Сначала получаем ref_code пользователя
        const user = await this.storage.getUser(userId);
            
        if (!user || !user.ref_code) {
          console.log(`[ReferralService] User ${userId} has no ref_code`);
          return [];
        }
        
        // Получаем всех пользователей через хранилище
        // Теперь ищем всех пользователей, у которых parent_ref_code равен ref_code пользователя
        // Примечание: здесь потребуется расширение интерфейса хранилища для getUsersByParentRefCode
        // Пока что используем обходное решение через getUserReferrals из хранилища
        
        // Временное решение, пока нет соответствующего метода в хранилище
        const userReferrals = await this.storage.getUserReferrals(userId);
        
        console.log(`[ReferralService] Found ${userReferrals.length} referrals for user ${userId} using storage method`);
        return userReferrals;
      } catch (innerError) {
        console.error('[ReferralService] Error in getUserReferrals with storage method:', innerError);
        
        // В случае ошибки возвращаем пустой массив
        return [];
      }
    } catch (error) {
      console.error('[ReferralService] Error in getUserReferrals:', error);
      return []; // В случае ошибки также возвращаем пустой массив
    }
  }

  /**
   * Создает новую реферальную связь
   * @param referralData Данные реферальной связи
   * @returns Созданная реферальная связь
   */
  async createReferral(referralData: InsertReferral): Promise<Referral> {
    return this.storage.createReferral(referralData);
  }
  
  /**
   * Получает реферальное дерево пользователя
   * @param userId ID пользователя
   * @returns Реферальное дерево
   */
  async getReferralTree(userId: number): Promise<any> {
    try {
      // Получаем пользователя
      const user = await this.storage.getUser(userId);
      if (!user) {
        throw new ValidationError('Пользователь не найден', { userId });
      }

      // Получаем прямых рефералов пользователя через parent_ref_code
      const directReferrals = await this.getUserReferrals(userId);
      
      // Формируем результат
      return {
        user_id: userId,
        ref_code: user.ref_code || 'Unknown',
        username: user.username || 'user',
        referrals: directReferrals.map(ref => ({
          id: ref.user_id,
          username: ref.username || 'user',
          ref_code: ref.ref_code || 'Unknown',
          created_at: ref.created_at,
          level: ref.level || 1
        })),
        total_count: directReferrals.length
      };
    } catch (error) {
      console.error('[ReferralService] Error in getReferralTree:', error);
      throw error;
    }
  }
  
  /**
   * Получает статистику реферальной программы для пользователя
   * @param userId ID пользователя
   * @returns Статистика по рефералам
   */
  async getReferralStats(userId: number): Promise<any> {
    try {
      // Получаем пользователя
      const user = await this.storage.getUser(userId);
      if (!user) {
        throw new ValidationError('Пользователь не найден', { userId });
      }

      // Получаем количество рефералов по уровням
      const referralCounts = await this.getReferralCounts(userId);
      
      // Получаем данные о доходах по уровням
      const levelIncome = await this.getLevelIncomeData(userId);
      
      // Получаем общее количество рефералов
      const totalReferrals = Object.values(referralCounts).reduce((sum, count) => sum + count, 0);
      
      // Получаем общий доход от рефералов
      const totalIncome = {
        uni: Object.values(levelIncome).reduce((sum, income) => sum + income.uni, 0),
        ton: Object.values(levelIncome).reduce((sum, income) => sum + income.ton, 0)
      };
      
      // Формируем результат
      return {
        user_id: userId,
        ref_code: user.ref_code || null,
        username: user.username || 'user',
        total_referrals: totalReferrals,
        referral_counts: referralCounts,
        level_income: levelIncome,
        total_income: totalIncome,
        status: totalReferrals > 0 ? 'active' : 'inactive'
      };
    } catch (error) {
      console.error('[ReferralService] Error in getReferralStats:', error);
      throw error;
    }
  }

  /**
   * Проверяет, есть ли у пользователя пригласитель
   * @param userId ID пользователя
   * @returns Реферальная связь или undefined, если пригласителя нет
   */
  async getUserInviter(userId: number): Promise<Referral | undefined> {
    try {
      // Получаем пользователя
      const user = await this.storage.getUser(userId);
      
      if (user && user.parent_ref_code) {
        // Если у пользователя есть parent_ref_code, ищем пользователя с таким ref_code
        const inviter = await this.storage.getUserByRefCode(user.parent_ref_code);
            
        if (inviter) {
          console.log(`[ReferralService] Found inviter by parent_ref_code: user ${userId} invited by ${inviter.id}`);
          
          // Проверяем, существует ли уже запись в таблице referrals
          const existingReferral = await this.storage.getReferralByUserId(userId);
          if (existingReferral) {
            return existingReferral;
          }
          
          // Создаем объект, совместимый с Referral
          const referral: Referral = {
            id: 0, // Временный ID
            user_id: userId,
            inviter_id: inviter.id,
            level: 1, // По умолчанию уровень 1
            ref_path: [], // Пустой ref_path
            created_at: new Date(),
            reward_uni: null // Нет информации о наградах
          };
          
          return referral;
        }
      }
      
      // Если новый подход не дал результатов, используем старый через таблицу referrals
      console.log(`[ReferralService] No parent_ref_code found for user ${userId}, using referrals table`);
      const referral = await this.storage.getReferralByUserId(userId);
      
      return referral;
    } catch (error) {
      console.error('[ReferralService] Error in getUserInviter:', error);
      return undefined;
    }
  }

  /**
   * Получает количество рефералов пользователя по уровням
   * @param userId ID пользователя
   * @returns Объект с количеством рефералов по уровням (пустой объект, если нет рефералов)
   */
  async getReferralCounts(userId: number): Promise<Record<number, number>> {
    try {
      if (!userId || typeof userId !== 'number' || userId <= 0) {
        console.log('[ReferralService] Invalid userId in getReferralCounts:', userId);
        return {}; // Возвращаем пустой объект при некорректном userId
      }
      
      // Получаем рефералов пользователя 
      const userReferrals = await this.getUserReferrals(userId);
      
      if (!userReferrals.length) {
        return {};
      }
      
      // Группируем рефералов по уровням
      const result: Record<number, number> = {};
      for (const referral of userReferrals) {
        const level = referral.level || 1;
        result[level] = (result[level] || 0) + 1;
      }
      
      return result;
    } catch (error) {
      console.error('[ReferralService] Error in getReferralCounts:', error);
      return {}; // В случае ошибки возвращаем пустой объект
    }
  }

  /**
   * Получает данные о доходах пользователя от рефералов по уровням
   * @param userId ID пользователя
   * @returns Объект с доходами по уровням (пустой объект, если нет доходов)
   */
  async getLevelIncomeData(userId: number): Promise<Record<number, { uni: number, ton: number }>> {
    try {
      if (!userId || typeof userId !== 'number' || userId <= 0) {
        console.log('[ReferralService] Invalid userId in getLevelIncomeData:', userId);
        return {}; // Возвращаем пустой объект при некорректном userId
      }
      
      // Получаем все транзакции пользователя типа "referral_bonus"
      const transactionData = await this.storage.getUserTransactions(userId);
      
      // Обрабатываем результат, который может быть либо массивом, либо объектом вида { transactions: [], total: 0 }
      let transactionsArray = [];
      
      if (Array.isArray(transactionData)) {
        transactionsArray = transactionData;
      } else if (transactionData && typeof transactionData === 'object') {
        // Если это объект с полем transactions
        if (Array.isArray(transactionData.transactions)) {
          transactionsArray = transactionData.transactions;
        } else {
          // Менее агрессивный лог - просто информация о том, что транзакции не найдены
          console.log(`[ReferralService] No transactions found for user ${userId}`);
          return {}; 
        }
      } else {
        console.log(`[ReferralService] No transactions data found for user ${userId}`);
        return {};
      }
      
      const referralTransactions = transactionsArray.filter(tx => tx && tx.type === 'referral_bonus');
      
      if (!referralTransactions.length) {
        return {};
      }
      
      // Группируем транзакции по уровням из поля data (если доступно)
      const result: Record<number, { uni: number, ton: number }> = {};
      
      for (const tx of referralTransactions) {
        let level = 1; // По умолчанию уровень 1
        
        // Пытаемся извлечь уровень из поля data, если оно есть
        if (tx.data) {
          try {
            const data = typeof tx.data === 'string' ? JSON.parse(tx.data) : tx.data;
            if (data.level) {
              level = Number(data.level);
            }
          } catch (parseError) {
            console.error('[ReferralService] Error parsing transaction data:', parseError);
          }
        }
        
        // Инициализируем запись для уровня, если её ещё нет
        if (!result[level]) {
          result[level] = { uni: 0, ton: 0 };
        }
        
        // Добавляем сумму транзакции к соответствующей валюте
        const amount = parseFloat(tx.amount);
        if (tx.currency === 'uni') {
          result[level].uni += amount;
        } else if (tx.currency === 'ton') {
          result[level].ton += amount;
        }
      }
      
      return result;
    } catch (error) {
      console.error('[ReferralService] Error in getLevelIncomeData:', error);
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
  async createReferralRelationship(
    userId: number, 
    inviterId: number, 
    level: number = 1
  ): Promise<{
    referral: Referral | null;
    success: boolean;
    isNewConnection: boolean;
    message: string;
  }> {
    if (!userId || !inviterId) {
      console.error(`[ReferralService] Invalid userId (${userId}) or inviterId (${inviterId})`);
      return {
        referral: null,
        success: false,
        isNewConnection: false,
        message: 'Недопустимый ID пользователя или пригласителя'
      };
    }
    
    if (userId === inviterId) {
      console.error(`[ReferralService] Cannot create self-referral: userId ${userId} equals inviterId ${inviterId}`);
      return {
        referral: null,
        success: false,
        isNewConnection: false,
        message: 'Невозможно создать реферальную связь с самим собой'
      };
    }
    
    try {
      // Проверяем, существует ли уже связь для этого пользователя
      const existingReferral = await this.getUserInviter(userId);
      
      if (existingReferral) {
        // Важно! Реализация задания из ТЗ (Этап 3.1)
        // При повторной попытке привязки возвращаем существующую связь, но флаг isNewConnection = false
        console.warn(`[referral] Ref_code ignored, user ${userId} already bound to inviter ${existingReferral.inviter_id}`);
        
        const sameInviter = existingReferral.inviter_id === inviterId;
        const logMessage = sameInviter
          ? `[referral] Попытка повторной привязки к тому же пригласителю: ${inviterId}`
          : `[referral] Отмена: пользователь ${userId} уже привязан к другому пригласителю: ${existingReferral.inviter_id}`;
        
        console.log(logMessage);
        
        return {
          referral: existingReferral,
          success: true,
          isNewConnection: false,
          message: 'Пользователь уже привязан к пригласителю'
        };
      }
      
      // Создаем новую реферальную связь
      console.log(`[ReferralService] Creating referral relationship: user ${userId} invited by ${inviterId} at level ${level}`);
      
      // Строим реферальный путь для пользователя
      const refPath = [inviterId]; // Начинаем с непосредственного приглашающего
      
      // Если inviterId имеет свой ref_path, добавляем его элементы
      // Сначала строим ref_path для пригласителя
      const inviterRefPath = await this.buildRefPath(inviterId);
      if (inviterRefPath.length > 0) {
        // Объединяем пути
        refPath.push(...inviterRefPath);
      }
      
      // Ограничиваем длину пути до 20 элементов
      const limitedRefPath = refPath.slice(0, MAX_REFERRAL_PATH_DEPTH);
      
      const referralData: InsertReferral = {
        user_id: userId,
        inviter_id: inviterId,
        level,
        ref_path: limitedRefPath,
        created_at: new Date()
      };
      
      const referral = await this.createReferral(referralData);
      console.log(`[referral] Привязка успешно: user ${userId} → inviter ${inviterId}`);
      console.log(`[referral] Цепочка построена для user_id: ${userId} → [${limitedRefPath.join(', ')}]`);
      
      return {
        referral,
        success: true,
        isNewConnection: true,
        message: 'Реферальная связь успешно создана'
      };
    } catch (error) {
      console.error(`[ReferralService] Error creating referral relationship: `, error);
      return {
        referral: null,
        success: false,
        isNewConnection: false,
        message: `Ошибка при создании реферальной связи: ${error}`
      };
    }
  }
}

// Создаем единственный экземпляр сервиса
import { extendedStorage as storageInstance } from '../storage-adapter-extended';
export const referralServiceInstance = new ReferralService(storageInstance);

/**
 * Фабричная функция для создания экземпляра ReferralService
 * @returns Экземпляр сервиса работы с рефералами
 */
export function createReferralService(): IReferralService {
  return referralServiceInstance;
}