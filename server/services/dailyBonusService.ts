/**
 * ВНИМАНИЕ: Используйте импорт из services/index.ts вместо прямого импорта
 * 
 * Этот файл является прокси-оберткой для обратной совместимости.
 * Для новых разработок используйте инстанс dailyBonusService из services/index.ts
 */
import { dailyBonusServiceInstance } from './dailyBonusServiceInstance';

export * from './dailyBonusServiceInstance';

/**
 * @deprecated Используйте инстанс dailyBonusService из services/index.ts вместо статических методов
 */
export class DailyBonusService {
  static readonly DAILY_BONUS_AMOUNT = 500;
  
  static async getUserStreakInfo(userId: number) {
    return dailyBonusServiceInstance.getUserStreakInfo(userId);
  }
  
  private static canClaimToday(lastClaimDate: Date | null): boolean {
    // Этот метод приватный и вызывается только из getUserStreakInfo,
    // который теперь делегирует вызов экземпляру
    throw new Error('Этот метод не должен вызываться напрямую');
  }
  
  static async getDailyBonusStatus(userId: number) {
    return dailyBonusServiceInstance.getDailyBonusStatus(userId);
  }
  
  private static async updateUserStreakAndBalance() {
    // Этот метод приватный и вызывается только из claimDailyBonus,
    // который теперь делегирует вызов экземпляру
    throw new Error('Этот метод не должен вызываться напрямую');
  }
  
  private static async createBonusTransaction() {
    // Этот метод приватный и вызывается только из claimDailyBonus,
    // который теперь делегирует вызов экземпляру
    throw new Error('Этот метод не должен вызываться напрямую');
  }
  
  static async claimDailyBonus(userId: number) {
    return dailyBonusServiceInstance.claimDailyBonus(userId);
  }
}