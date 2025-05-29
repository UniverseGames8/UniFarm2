/**
 * Стандартная реализация сервиса реферального дерева
 * 
 * Обеспечивает базовые операции с реферальным деревом без оптимизаций.
 * Используется как запасной вариант и для сравнения производительности.
 */

import { db } from "../db";
import { users, referrals } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Интерфейс для сервиса управления реферальным деревом
 */
export interface ReferralTreeService {
  getReferralTree(userId: number): Promise<any>;
  getInviterChain(userId: number): Promise<any[]>;
}

/**
 * Стандартная реализация сервиса реферального дерева
 * 
 * Использует простые операции без оптимизаций для чтения реферального дерева
 */
export class StandardReferralTreeService implements ReferralTreeService {
  /**
   * Получает полное дерево рефералов для пользователя
   * Выполняет рекурсивные запросы к БД для построения дерева
   * 
   * @param userId ID пользователя, для которого получаем дерево
   * @returns Дерево рефералов в виде JSON-структуры
   */
  public async getReferralTree(userId: number): Promise<any> {
    try {
      // Получаем информацию о пользователе
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      
      if (!user) {
        throw new Error(`Пользователь с ID ${userId} не найден`);
      }
      
      // Создаем корневой узел дерева
      const tree = {
        id: user.id,
        username: user.username,
        ref_code: user.ref_code,
        created_at: user.created_at,
        referrals: []
      };
      
      // Получаем прямых рефералов пользователя
      await this.loadReferrals(tree);
      
      return tree;
    } catch (error) {
      console.error(`[StandardReferralTreeService] Ошибка при получении дерева рефералов:`, error);
      throw error;
    }
  }
  
  /**
   * Получает цепочку пригласителей для пользователя
   * 
   * @param userId ID пользователя, для которого получаем цепочку
   * @returns Массив пользователей в цепочке пригласителей (от ближайшего к корню)
   */
  public async getInviterChain(userId: number): Promise<any[]> {
    try {
      const chain: any[] = [];
      let currentId = userId;
      
      // Ограничиваем количество итераций для избежания бесконечных циклов
      const maxIterations = 20;
      let iterations = 0;
      
      while (currentId && iterations < maxIterations) {
        // Получаем текущего пользователя
        const [user] = await db.select().from(users).where(eq(users.id, currentId));
        
        if (!user || !user.parent_ref_code) {
          break;
        }
        
        // Находим пригласителя по реферальному коду
        const [inviter] = await db.select().from(users).where(eq(users.ref_code, user.parent_ref_code));
        
        if (!inviter) {
          console.warn(`[StandardReferralTreeService] Не найден пригласитель с кодом ${user.parent_ref_code} для пользователя ${user.id}`);
          break;
        }
        
        // Добавляем пригласителя в цепочку
        chain.push({
          id: inviter.id,
          username: inviter.username,
          ref_code: inviter.ref_code,
          level: iterations + 1 // Уровень в цепочке приглашений
        });
        
        // Переходим к следующему пригласителю
        currentId = inviter.id;
        iterations++;
      }
      
      return chain;
    } catch (error) {
      console.error(`[StandardReferralTreeService] Ошибка при получении цепочки пригласителей:`, error);
      throw error;
    }
  }
  
  /**
   * Рекурсивно загружает рефералов в дерево
   * @param node Узел дерева, для которого загружаем рефералов
   * @param level Текущий уровень глубины (для ограничения глубины рекурсии)
   */
  private async loadReferrals(node: any, level = 0): Promise<void> {
    // Ограничиваем глубину рекурсии
    if (level >= 10) return;
    
    // Получаем пользователей, которые использовали ref_code текущего узла
    const directReferrals = await db.select()
      .from(users)
      .where(eq(users.parent_ref_code, node.ref_code));
    
    if (!directReferrals || directReferrals.length === 0) {
      return;
    }
    
    // Добавляем рефералов в текущий узел
    for (const referral of directReferrals) {
      const referralNode = {
        id: referral.id,
        username: referral.username,
        ref_code: referral.ref_code,
        created_at: referral.created_at,
        referrals: []
      };
      
      node.referrals.push(referralNode);
      
      // Рекурсивно загружаем следующий уровень
      await this.loadReferrals(referralNode, level + 1);
    }
  }
}