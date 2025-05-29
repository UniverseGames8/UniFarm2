/**
 * Типы для Telegram WebApp API
 */

interface TelegramWebAppUser {
  id: number;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

interface TelegramWebAppInitData {
  query_id?: string;
  user?: TelegramWebAppUser;
  auth_date?: string;
  hash?: string;
  start_param?: string;
}

interface TelegramWebAppInitDataUnsafe {
  query_id?: string;
  user?: TelegramWebAppUser;
  auth_date?: string;
  hash?: string;
  start_param?: string;
}

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: TelegramWebAppInitDataUnsafe;
  ready(): void;
  close(): void;
  expand(): void;
  MainButton: any;
  BackButton: any;
  ColorScheme: any;
  themeParams: any;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  version?: string;          // Добавлено в Этапе 10.5 для поддержки отладочной страницы
  platform?: string;         // Добавлено в Этапе 10.5 для поддержки отладочной страницы
  sendData(data: any): void;
  onEvent(eventType: string, eventHandler: Function): void;
  offEvent(eventType: string, eventHandler: Function): void;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  openLink(url: string): void;
  showPopup(params: any, callback: Function): void;
  showAlert(message: string, callback: Function): void;
  showConfirm(message: string, callback: Function): void;
  enableClosingConfirmation(): void;
  disableClosingConfirmation(): void;
  startParam?: string;
}

interface TelegramApp {
  WebApp: TelegramWebApp;
}

// Добавляем Telegram в глобальный объект Window
declare global {
  interface Window {
    Telegram?: TelegramApp;
  }
}

export {};