/**
 * API-маршрут для застосування оптимізацій реферальної системи
 * Доступен по адресу: /api/admin/apply-referral-optimization
 */

import { Request, Response } from 'express';
import { createReferralOptimizationIndexes, ensureReferralLogTables } from '../../services/optimizedReferralQueries';

export default async function handler(req: Request, res: Response) {
  try {
    console.log('[Referral Optimization API] Застосування оптимізацій реферальної системи');
    
    // Створюємо необхідні індекси
    await createReferralOptimizationIndexes();
    
    // Створюємо таблиці для журналювання
    await ensureReferralLogTables();
    
    // Оновлюємо налаштування для використання оптимізованого режиму
    process.env.USE_OPTIMIZED_REFERRALS = 'true';
    
    // Повертаємо успішний результат
    return res.json({
      success: true,
      data: {
        message: 'Оптимізації реферальної системи успішно застосовані',
        details: {
          indexes_created: true,
          log_tables_created: true,
          optimized_mode_enabled: true
        }
      }
    });
  } catch (error) {
    console.error('[Referral Optimization API] Помилка при застосуванні оптимізацій:', error);
    
    return res.status(500).json({
      success: false,
      error: {
        message: 'Помилка при застосуванні оптимізацій реферальної системи',
        details: error instanceof Error ? error.message : String(error)
      }
    });
  }
}