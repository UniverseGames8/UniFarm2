import { validateTelegramInitData } from '../utils/telegramUtils';
import { ValidationError, UnauthorizedError } from '../middleware/errorHandler';
import { z } from 'zod';

/**
 * Схема валидации параметров Telegram
 */
export const telegramDataSchema = z.object({
  authData: z.string().optional(),
  userId: z.number().optional(),
  startParam: z.string().optional(),
  telegramInitData: z.string().optional()
});

export type TelegramData = z.infer<typeof telegramDataSchema>;

/**
 * Схема валидации заголовков
 */
export const headersSchema = z.object({
  'telegram-init-data': z.string().optional(),
  'x-telegram-init-data': z.string().optional(),
  'telegram-data': z.string().optional(),
  'x-telegram-data': z.string().optional()
});

export type HeadersData = z.infer<typeof headersSchema>;

/**
 * Интерфейс сервиса безопасности
 */
export interface ISecurityService {
  /**
   * Проверяет Telegram данные на валидность
   */
  validateTelegramData(data: TelegramData, isDevelopment?: boolean): Promise<boolean>;

  /**
   * Безопасно парсит Telegram initData
   */
  parseTelegramInitData(initData: string): Record<string, any>;

  /**
   * Извлекает Telegram данные из заголовков
   */
  extractTelegramDataFromHeaders(headers: HeadersData): string | null;

  /**
   * Проверяет на XSS и инъекции
   */
  sanitizeInput(input: string): string;

  /**
   * Проверяет права доступа пользователя
   */
  checkUserPermission(userId: number, requiredPermission: string): Promise<boolean>;
}

/**
 * Реализация сервиса безопасности для проверки и валидации данных
 */
class SecurityServiceImpl implements ISecurityService {
  private BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

  /**
   * Проверяет Telegram данные на валидность
   */
  async validateTelegramData(data: TelegramData, isDevelopment: boolean = false): Promise<boolean> {
    if (!data.authData && !data.telegramInitData) {
      throw new ValidationError('Отсутствуют данные аутентификации Telegram');
    }

    // Проверяем наличие BOT_TOKEN
    if (!this.BOT_TOKEN && !isDevelopment) {
      console.error('[Security] Отсутствует токен бота Telegram');
      throw new Error('Ошибка конфигурации сервера. Пожалуйста, свяжитесь с поддержкой.');
    }

    const authData = data.telegramInitData || data.authData;
    
    // Проверяем валидность данных Telegram
    const validationResult = validateTelegramInitData(
      authData!,
      this.BOT_TOKEN,
      {
        maxAgeSeconds: 86400, // 24 часа по умолчанию
        isDevelopment: isDevelopment,
        requireUserId: !isDevelopment, // В тестовом режиме не требуем userId
        allowFallbackId: isDevelopment // В продакшене запрещаем ID=1
      }
    );

    if (!validationResult.isValid && !isDevelopment) {
      console.error("[Security] Данные инициализации Telegram недействительны:", 
                validationResult.validationErrors);
      throw new UnauthorizedError('Данные аутентификации Telegram недействительны');
    }

    return true;
  }

  /**
   * Безопасно парсит Telegram initData
   */
  parseTelegramInitData(initData: string): Record<string, any> {
    try {
      const params = new URLSearchParams(initData);
      const result: Record<string, any> = {};
      
      params.forEach((value, key) => {
        if (key === 'user') {
          try {
            result[key] = JSON.parse(value);
          } catch (e) {
            result[key] = value;
          }
        } else {
          result[key] = value;
        }
      });
      
      return result;
    } catch (error) {
      console.error("[Security] Ошибка при парсинге Telegram initData:", error);
      throw new ValidationError('Невалидный формат данных Telegram');
    }
  }

  /**
   * Извлекает Telegram данные из заголовков
   */
  extractTelegramDataFromHeaders(headers: HeadersData): string | null {
    return headers['telegram-init-data'] || 
           headers['x-telegram-init-data'] || 
           headers['telegram-data'] || 
           headers['x-telegram-data'] || 
           null;
  }

  /**
   * Проверяет на XSS и инъекции
   */
  sanitizeInput(input: string): string {
    // Реализация базовой защиты от XSS
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * Проверяет права доступа пользователя
   */
  async checkUserPermission(userId: number, requiredPermission: string): Promise<boolean> {
    // Заглушка для будущей реализации
    return true;
  }
}

/**
 * Создает экземпляр сервиса безопасности
 * @returns Экземпляр сервиса безопасности
 */
export function createSecurityService(): ISecurityService {
  return new SecurityServiceImpl();
}

// Создаем единственный экземпляр сервиса
export const securityServiceInstance = createSecurityService();