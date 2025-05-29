/**
 * ВНИМАНИЕ: Используйте импорт из services/index.ts вместо прямого импорта
 * 
 * Этот файл является прокси-оберткой для обратной совместимости.
 * Для новых разработок используйте инстанс securityService из services/index.ts
 */
import { securityServiceInstance } from './securityServiceInstance';
import { 
  telegramDataSchema,
  headersSchema
} from './securityServiceInstance';
import { z } from 'zod';

// Определяем типы для совместимости
export type TelegramData = {
  authData?: string;
  userId?: number;
  startParam?: string;
  telegramInitData?: string;
};

export type HeadersData = {
  'telegram-init-data'?: string;
  'x-telegram-init-data'?: string;
  'telegram-data'?: string;
  'x-telegram-data'?: string;
};

// Определяем интерфейс для совместимости
export interface ISecurityService {
  validateTelegramData(data: TelegramData, isDevelopment?: boolean): Promise<boolean>;
  parseTelegramInitData(initData: string): Record<string, any>;
  extractTelegramDataFromHeaders(headers: HeadersData): string | null;
  sanitizeInput(input: string): string;
  checkUserPermission(userId: number, requiredPermission: string): Promise<boolean>;
}

// Реэкспортируем типы для удобства
export { 
  telegramDataSchema,
  headersSchema
};

/**
 * @deprecated Используйте инстанс securityService из services/index.ts вместо статических методов
 */
export class SecurityService {
  /**
   * Проверяет Telegram данные на валидность
   */
  static async validateTelegramData(data: TelegramData, isDevelopment?: boolean): Promise<boolean> {
    return securityServiceInstance.validateTelegramData(data, isDevelopment);
  }

  /**
   * Безопасно парсит Telegram initData
   */
  static parseTelegramInitData(initData: string): Record<string, any> {
    return securityServiceInstance.parseTelegramInitData(initData);
  }

  /**
   * Извлекает Telegram данные из заголовков
   */
  static extractTelegramDataFromHeaders(headers: HeadersData): string | null {
    return securityServiceInstance.extractTelegramDataFromHeaders(headers);
  }

  /**
   * Проверяет на XSS и инъекции
   */
  static sanitizeInput(input: string): string {
    return securityServiceInstance.sanitizeInput(input);
  }

  /**
   * Проверяет права доступа пользователя
   */
  static async checkUserPermission(userId: number, requiredPermission: string): Promise<boolean> {
    return securityServiceInstance.checkUserPermission(userId, requiredPermission);
  }
}