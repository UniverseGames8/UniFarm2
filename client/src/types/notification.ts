/**
 * Типы для системы уведомлений
 */

export type NotificationType = 'success' | 'error' | 'info' | 'loading';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  duration?: number; // Длительность показа в мс (если не указано - уведомление не исчезает автоматически)
  autoDismiss?: boolean; // Автоматически скрывать уведомление через duration
}

// Тип для функции отправки уведомления
export interface NotificationOptions {
  message: string;
  duration?: number;
  autoDismiss?: boolean;
}