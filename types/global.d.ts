/**
 * Глобальные типы для приложения UniFarm
 */

declare global {
  /**
   * Глобальные переменные для Telegram бота
   */
  var telegramBotInitialized: boolean;

  // Добавляем явное расширение для globalThis
  interface Window {
    telegramBotInitialized?: boolean;
  }

  interface globalThis {
    telegramBotInitialized: boolean;
  }

  /**
   * Расширение интерфейса Express
   */
  namespace Express {
    interface Application {
      locals: {
        storage: {
          executeRawQuery: (query: string, params?: any[]) => Promise<any>;
          [key: string]: any;
        };
      };
    }

    interface Request {
      initData?: string;
      telegramData?: {
        user?: {
          id: number;
          first_name?: string;
          last_name?: string;
          username?: string;
          language_code?: string;
        };
        auth_date?: number;
      };
    }
  }
}

// Для поддержки импортов в TypeScript
export {};