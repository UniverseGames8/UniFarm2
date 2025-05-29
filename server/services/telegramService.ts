/**
 * ВНИМАНИЕ: Используйте импорт из services/index.ts вместо прямого импорта
 * 
 * Этот файл является прокси-оберткой для обратной совместимости.
 * Для новых разработок используйте инстанс telegramService из services/index.ts
 */

import { telegramServiceInstance } from './telegramServiceInstance';
export * from './telegramServiceInstance';

/**
 * @deprecated Используйте инстанс telegramService из services/index.ts
 */
export class TelegramService {
  /**
   * Обрабатывает webhook от Telegram
   */
  static async handleWebhook(webhookData: any): Promise<{ success: boolean; message: string }> {
    return telegramServiceInstance.handleWebhook(webhookData);
  }

  /**
   * Валидирует данные инициализации Telegram (initData)
   */
  static async validateInitData(initData: string): Promise<any> {
    return telegramServiceInstance.validateInitData(initData);
  }

  /**
   * Получает информацию о мини-приложении
   */
  static getMiniAppInfo(): any {
    return telegramServiceInstance.getMiniAppInfo();
  }

  /**
   * Регистрирует пользователя через Telegram
   */
  static async registerUser(registrationData: any): Promise<any> {
    return telegramServiceInstance.registerUser(registrationData);
  }
}