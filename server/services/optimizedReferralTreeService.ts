/**
 * Оптимизированный сервис реферального дерева
 * 
 * Обеспечивает высокопроизводительные операции с реферальным деревом
 * для больших структур и глубоких деревьев
 */

import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import * as schema from "@shared/schema";

/**
 * Результат запроса структуры рефералов по уровням
 */
interface ReferralStructureItem {
  level: number;
  count: number;
  total_rewards_uni: number;
}

/**
 * Оптимизированная реализация сервиса реферального дерева
 * 
 * Использует рекурсивные CTE-запросы для эффективной работы 
 * с глубокими реферальными структурами
 */
export class OptimizedReferralTreeService {
  private db: NodePgDatabase<typeof schema>;
  
  /**
   * @param db Экземпляр базы данных Drizzle ORM
   */
  constructor(db: NodePgDatabase<typeof schema>) {
    this.db = db;
  }
  
  /**
   * Инициализирует сервис
   * Создаёт необходимые индексы и представления в БД, если их нет
   */
  public async initialize(): Promise<void> {
    // Проверяем и создаём индексы
    try {
      await this.db.execute(sql`
        -- Индекс для ref_code
        CREATE INDEX IF NOT EXISTS users_ref_code_idx 
        ON users (ref_code);
        
        -- Индекс для parent_ref_code
        CREATE INDEX IF NOT EXISTS users_parent_ref_code_idx 
        ON users (parent_ref_code);
        
        -- Составной индекс для эффективной работы с реферальным деревом
        CREATE INDEX IF NOT EXISTS users_ref_combo_idx 
        ON users (ref_code, parent_ref_code);
      `);
      
      console.log("[OptimizedReferralTreeService] Индексы для реферальной системы успешно созданы");
    } catch (error) {
      console.error("[OptimizedReferralTreeService] Ошибка при создании индексов:", error);
      throw error;
    }
  }
  
  /**
   * Получает полное дерево рефералов для пользователя
   * Использует рекурсивные Common Table Expressions (CTE) для построения дерева за один запрос
   * 
   * @param userId ID пользователя, для которого получаем дерево
   * @returns Дерево рефералов в виде JSON-структуры
   */
  public async getReferralTree(userId: number): Promise<any> {
    try {
      // Получаем информацию о пользователе для проверки
      const [userExists] = await this.db.execute<{ exists: boolean }>(sql`
        SELECT EXISTS(SELECT 1 FROM users WHERE id = ${userId}) as exists
      `);
      
      if (!userExists || !userExists.exists) {
        throw new Error(`Пользователь с ID ${userId} не найден`);
      }
      
      // Получаем ref_code пользователя
      const [user] = await this.db.execute<{ ref_code: string }>(sql`
        SELECT ref_code FROM users WHERE id = ${userId}
      `);
      
      // Используем рекурсивный CTE-запрос для построения дерева
      const result = await this.db.execute(sql`
        WITH RECURSIVE referral_tree AS (
          -- Базовый случай: корневой пользователь
          SELECT 
            u.id, 
            u.username, 
            u.ref_code, 
            u.created_at,
            0 as level
          FROM users u
          WHERE u.id = ${userId}
          
          UNION ALL
          
          -- Рекурсивный случай: добавляем рефералов
          SELECT 
            u.id, 
            u.username, 
            u.ref_code, 
            u.created_at,
            rt.level + 1 as level
          FROM users u
          JOIN referral_tree rt ON u.parent_ref_code = rt.ref_code
          WHERE rt.level < 10  -- Ограничиваем глубину дерева
        )
        
        -- Возвращаем дерево с правильной структурой
        SELECT 
          id,
          username,
          ref_code,
          created_at,
          level,
          parent_ref_code
        FROM (
          SELECT 
            r.id, 
            r.username, 
            r.ref_code, 
            r.created_at,
            r.level,
            u.parent_ref_code
          FROM referral_tree r
          JOIN users u ON r.id = u.id
          ORDER BY r.level, r.id
        ) as result
      `);
      
      // Трансформируем плоский результат в иерархическую структуру
      const rootNode = {
        id: userId,
        username: result.length > 0 ? result[0].username : 'Unknown',
        ref_code: user.ref_code,
        created_at: result.length > 0 ? result[0].created_at : null,
        referrals: []
      };
      
      // Строим дерево из плоского списка
      const nodeMap = new Map();
      nodeMap.set(userId, rootNode);
      
      // Обрабатываем все ноды кроме корня (пропускаем первую запись, которая уже обработана)
      for (let i = 1; i < result.length; i++) {
        const item = result[i];
        
        // Находим родительский узел
        const parentNode = this.findParentNode(result, nodeMap, item);
        
        if (parentNode) {
          // Создаем дочерний узел и добавляем его к родителю
          const childNode = {
            id: item.id,
            username: item.username,
            ref_code: item.ref_code,
            created_at: item.created_at,
            referrals: []
          };
          
          parentNode.referrals.push(childNode);
          nodeMap.set(item.id, childNode);
        }
      }
      
      return rootNode;
    } catch (error) {
      console.error(`[OptimizedReferralTreeService] Ошибка при получении дерева рефералов:`, error);
      throw error;
    }
  }
  
  /**
   * Получает цепочку пригласителей для пользователя используя рекурсивный CTE
   * 
   * @param userId ID пользователя, для которого получаем цепочку
   * @returns Массив пользователей в цепочке пригласителей (от ближайшего к корню)
   */
  public async getInviterChain(userId: number): Promise<any[]> {
    try {
      const inviterChain = await this.db.execute(sql`
        WITH RECURSIVE inviter_chain AS (
          -- Базовый случай: начальный пользователь
          SELECT 
            u.id, 
            u.username, 
            u.ref_code,
            u.parent_ref_code,
            1 as level
          FROM users u
          WHERE u.id = ${userId}
          
          UNION ALL
          
          -- Рекурсивный случай: находим пригласителя
          SELECT 
            p.id, 
            p.username, 
            p.ref_code,
            p.parent_ref_code,
            ic.level + 1 as level
          FROM users p
          JOIN inviter_chain ic ON p.ref_code = ic.parent_ref_code
          WHERE ic.parent_ref_code IS NOT NULL
          AND ic.level < 20  -- Защита от циклических ссылок
        )
        
        -- Получаем всех пригласителей (пропускаем начального пользователя)
        SELECT id, username, ref_code, level
        FROM inviter_chain
        WHERE level > 1  -- Исключаем самого пользователя
        ORDER BY level ASC
      `);
      
      return inviterChain;
    } catch (error) {
      console.error(`[OptimizedReferralTreeService] Ошибка при получении цепочки пригласителей:`, error);
      throw error;
    }
  }
  
  /**
   * Получает агрегированную структуру рефералов по уровням
   * 
   * @param userId ID пользователя, для которого получаем структуру
   * @returns Массив объектов со статистикой по каждому уровню
   */
  public async getReferralStructureByLevel(userId: number): Promise<ReferralStructureItem[]> {
    try {
      // Проверяем и получаем ref_code пользователя
      const [user] = await this.db.execute<{ ref_code: string }>(sql`
        SELECT ref_code FROM users WHERE id = ${userId}
      `);
      
      if (!user) {
        throw new Error(`Пользователь с ID ${userId} не найден`);
      }
      
      // Используем рекурсивный CTE для получения всех рефералов по уровням
      const referralStructure = await this.db.execute<ReferralStructureItem>(sql`
        WITH RECURSIVE referral_tree AS (
          -- Базовый случай: пользователи, непосредственно пригашенные текущим пользователем
          SELECT 
            u.id, 
            u.username, 
            u.ref_code, 
            u.created_at,
            1 as level
          FROM users u
          WHERE u.parent_ref_code = ${user.ref_code}
          
          UNION ALL
          
          -- Рекурсивный случай: рефералы рефералов
          SELECT 
            u.id, 
            u.username, 
            u.ref_code, 
            u.created_at,
            rt.level + 1 as level
          FROM users u
          JOIN referral_tree rt ON u.parent_ref_code = rt.ref_code
          WHERE rt.level < 20  -- Ограничиваем глубину дерева
        )
        
        -- Агрегируем данные по уровням
        SELECT 
          level,
          COUNT(*) as count,
          COALESCE(SUM(reward_amount), 0) as total_rewards_uni
        FROM (
          SELECT 
            r.id, 
            r.level,
            (
              SELECT COALESCE(SUM(amount), 0)
              FROM transactions t
              WHERE t.user_id = r.id 
              AND t.type = 'referral_reward'
              AND t.currency = 'UNI'
            ) as reward_amount
          FROM referral_tree r
        ) as reward_data
        GROUP BY level
        ORDER BY level ASC
      `);
      
      return referralStructure;
    } catch (error) {
      console.error(`[OptimizedReferralTreeService] Ошибка при получении структуры рефералов:`, error);
      throw error;
    }
  }
  
  /**
   * Вспомогательный метод для поиска родительского узла при построении дерева
   */
  private findParentNode(items: any[], nodeMap: Map<number, any>, item: any): any {
    // Если у нас есть прямая ссылка на parent_ref_code, находим родителя по нему
    if (item.parent_ref_code) {
      // Ищем родителя в уже построенном дереве
      for (const existingItem of items) {
        if (existingItem.ref_code === item.parent_ref_code) {
          return nodeMap.get(existingItem.id);
        }
      }
    }
    
    // Для случая, когда уровни уже известны, идем на один уровень выше
    if (item.level > 0) {
      for (const existingItem of items) {
        if (existingItem.level === item.level - 1 && 
            nodeMap.has(existingItem.id) && 
            this.isParentChild(items, existingItem.id, item.id)) {
          return nodeMap.get(existingItem.id);
        }
      }
    }
    
    return null;
  }
  
  /**
   * Проверяет, является ли один узел родителем другого
   */
  private isParentChild(items: any[], parentId: number, childId: number): boolean {
    for (const item of items) {
      if (item.id === childId) {
        for (const potentialParent of items) {
          if (potentialParent.id === parentId && 
              item.parent_ref_code === potentialParent.ref_code) {
            return true;
          }
        }
        return false;
      }
    }
    return false;
  }
}