/**
 * Глобальные типы для всего приложения
 * Этот файл содержит глобальные определения типов, которые должны быть доступны
 * во всем приложении без необходимости явного импорта
 */

// Заменяем все глобальные декларации типов на единое определение
// для предотвращения конфликтов типов
declare global {
  // Расширяем глобальный объект Window
  interface Window {
    // Базовое определение для process
    process: any;
    
    // Поддержка TextEncoder для сред, где она может отсутствовать
    TextEncoder: typeof TextEncoder;
    
    // Определение Telegram WebApp API
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
          };
          start_param?: string;
        };
        version: string;
        platform: string;
        colorScheme?: string;
        MainButton?: any;
        BackButton?: any;
        CloudStorage?: {
          getItem: (key: string) => Promise<string | null>;
          setItem: (key: string, value: string) => Promise<void>;
          removeItem: (key: string) => Promise<void>;
          getItems: (keys: string[]) => Promise<Record<string, string | null>>;
          removeItems: (keys: string[]) => Promise<void>;
        };
        sendData?: (data: any) => void;
        onEvent?: (eventType: string, eventHandler: Function) => void;
        offEvent?: (eventType: string, eventHandler: Function) => void;
        setHeaderColor?: (color: string) => void;
        setBackgroundColor?: (color: string) => void;
        openLink?: (url: string) => void;
        showPopup?: (params: any, callback: Function) => void;
        showAlert?: (message: string, callback: Function) => void;
        showConfirm?: (message: string, callback: Function) => void;
        enableClosingConfirmation?: () => void;
        disableClosingConfirmation?: () => void;
      }
    }
  }
}

// Пустой экспорт требуется для превращения файла в модуль
export {};