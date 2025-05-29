/**
 * Интегратор реферальной системы
 * 
 * Этот модуль объединяет оптимизированную и стандартную реферальные системы,
 * предоставляя единый интерфейс для работы с ними и возможность переключения
 * между различными реализациями.
 */

import * as dotenv from "dotenv";
import { 
  StandardReferralTreeService, 
  ReferralTreeService 
} from "./standardReferralTreeService";
import { 
  OptimizedReferralTreeService 
} from "./optimizedReferralTreeService";
import {
  StandardReferralBonusProcessor,
  ReferralBonusProcessor
} from "./standardReferralBonusProcessor";
import {
  OptimizedReferralBonusProcessor
} from "./optimizedReferralBonusProcessor";
import { pool, db } from "../db";

// Загружаем переменные окружения
dotenv.config();

interface ReferralStructureItem {
  level: number;
  count: number;
  total_rewards_uni?: number;
}

interface ReferralSystem {
  // Основные методы для работы с деревом рефералов
  getReferralTree(userId: number): Promise<any>;
  getInviterChain(userId: number): Promise<any[]>;
  getReferralStructure(userId: number): Promise<ReferralStructureItem[]>;
  
  // Методы для работы с бонусами
  queueReferralReward(sourceUserId: number, amount: number, currency: string): Promise<string>;
  processReferralRewards(): Promise<void>;
  
  // Служебные методы
  isOptimizedMode(): boolean;
  enableOptimizedMode(): void;
  disableOptimizedMode(): void;
}

/**
 * Система управления реферальными деревьями и бонусами
 * с поддержкой переключения между стандартной и оптимизированной версиями.
 */
class ReferralSystemIntegrator implements ReferralSystem {
  private _standardTreeService: ReferralTreeService;
  private _optimizedTreeService: OptimizedReferralTreeService;
  
  private _standardBonusProcessor: ReferralBonusProcessor;
  private _optimizedBonusProcessor: OptimizedReferralBonusProcessor;
  
  private _useOptimized: boolean = false;
  
  constructor() {
    // Инициализируем обе реализации
    this._standardTreeService = new StandardReferralTreeService();
    this._optimizedTreeService = new OptimizedReferralTreeService(db);
    
    this._standardBonusProcessor = new StandardReferralBonusProcessor();
    this._optimizedBonusProcessor = new OptimizedReferralBonusProcessor(pool, db);
    
    // Определяем режим работы из переменной окружения
    this._useOptimized = process.env.USE_OPTIMIZED_REFERRALS === "true";
    
    console.log(`[ReferralSystemIntegrator] Initializing ${this._useOptimized ? 'optimized' : 'standard'} referral system...`);
  }
  
  /**
   * Проверяет, используется ли оптимизированная версия системы
   */
  public isOptimizedMode(): boolean {
    return this._useOptimized;
  }
  
  /**
   * Включает использование оптимизированной версии системы
   */
  public enableOptimizedMode(): void {
    console.log("[ReferralSystemIntegrator] Switching to optimized mode");
    this._useOptimized = true;
  }
  
  /**
   * Отключает использование оптимизированной версии системы
   */
  public disableOptimizedMode(): void {
    console.log("[ReferralSystemIntegrator] Switching to standard mode");
    this._useOptimized = false;
  }
  
  /**
   * Получает полное дерево рефералов для пользователя
   */
  public async getReferralTree(userId: number): Promise<any> {
    if (this._useOptimized) {
      return this._optimizedTreeService.getReferralTree(userId);
    } else {
      return this._standardTreeService.getReferralTree(userId);
    }
  }
  
  /**
   * Получает цепочку пригласителей для пользователя
   */
  public async getInviterChain(userId: number): Promise<any[]> {
    if (this._useOptimized) {
      return this._optimizedTreeService.getInviterChain(userId);
    } else {
      return this._standardTreeService.getInviterChain(userId);
    }
  }
  
  /**
   * Получает агрегированную структуру рефералов по уровням
   */
  public async getReferralStructure(userId: number): Promise<ReferralStructureItem[]> {
    if (this._useOptimized) {
      return this._optimizedTreeService.getReferralStructureByLevel(userId);
    } else {
      // В стандартной реализации такой метод отсутствует, эмулируем его
      const tree = await this._standardTreeService.getReferralTree(userId);
      
      // Преобразуем древовидную структуру в плоский список
      const flatList: any[] = [];
      
      function flattenTree(node: any, level: number = 1) {
        if (!node.referrals || node.referrals.length === 0) return;
        
        for (const ref of node.referrals) {
          flatList.push({ ...ref, level });
          if (ref.referrals && ref.referrals.length > 0) {
            flattenTree(ref, level + 1);
          }
        }
      }
      
      flattenTree(tree);
      
      // Группируем по уровням
      const levelMap = new Map<number, { count: number, total_rewards_uni: number }>();
      
      for (const referal of flatList) {
        if (!levelMap.has(referal.level)) {
          levelMap.set(referal.level, { count: 0, total_rewards_uni: 0 });
        }
        
        const levelData = levelMap.get(referal.level)!;
        levelData.count++;
        levelData.total_rewards_uni += parseFloat(referal.reward_uni || "0");
      }
      
      // Преобразуем Map в массив результатов
      const result: ReferralStructureItem[] = [];
      for (const [level, data] of levelMap.entries()) {
        result.push({
          level,
          count: data.count,
          total_rewards_uni: data.total_rewards_uni
        });
      }
      
      return result.sort((a, b) => a.level - b.level);
    }
  }
  
  /**
   * Ставит в очередь реферальное вознаграждение
   */
  public async queueReferralReward(sourceUserId: number, amount: number, currency: string): Promise<string> {
    if (this._useOptimized) {
      return this._optimizedBonusProcessor.queueReferralReward(sourceUserId, amount, currency);
    } else {
      return this._standardBonusProcessor.queueReferralReward(sourceUserId, amount, currency);
    }
  }
  
  /**
   * Обрабатывает все реферальные вознаграждения в очереди
   */
  public async processReferralRewards(): Promise<void> {
    if (this._useOptimized) {
      await this._optimizedBonusProcessor.processReferralRewards();
    } else {
      await this._standardBonusProcessor.processReferralRewards();
    }
  }
  
  /**
   * Инициализирует реферальную систему
   */
  public async initialize(): Promise<void> {
    // Инициализируем оптимизированные компоненты (чтобы они создали нужные индексы и т.д.)
    await this._optimizedTreeService.initialize();
    await this._optimizedBonusProcessor.initialize();
    
    console.log("[ReferralSystemIntegrator] Optimized referral system initialized successfully");
  }
}

// Создаем и экспортируем единственный экземпляр интегратора
export const referralSystem = new ReferralSystemIntegrator();