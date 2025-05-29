import React, { createContext, useReducer, useContext, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Notification, NotificationType, NotificationOptions } from '@/types/notification';

// Тип действий для reducer
type NotificationAction =
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'REMOVE_NOTIFICATION'; payload: { id: string } };

// Тип контекста уведомлений
interface NotificationContextProps {
  notifications: Notification[];
  showNotification: (type: NotificationType, options: NotificationOptions) => string;
  dismissNotification: (id: string) => void;
}

// Создаем контекст
const NotificationContext = createContext<NotificationContextProps | undefined>(undefined);

// Редьюсер для управления состоянием уведомлений
const notificationReducer = (state: Notification[], action: NotificationAction): Notification[] => {
  switch (action.type) {
    case 'ADD_NOTIFICATION':
      return [...state, action.payload];
    case 'REMOVE_NOTIFICATION':
      return state.filter(notification => notification.id !== action.payload.id);
    default:
      return state;
  }
};

// Провайдер уведомлений
export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, dispatch] = useReducer(notificationReducer, []);

  // Функция для добавления нового уведомления
  const showNotification = (type: NotificationType, options: NotificationOptions): string => {
    const id = uuidv4();
    const notification: Notification = {
      id,
      type,
      message: options.message,
      duration: options.duration || 5000, // по умолчанию 5 секунд
      autoDismiss: options.autoDismiss !== undefined ? options.autoDismiss : true, // по умолчанию true
    };

    dispatch({ type: 'ADD_NOTIFICATION', payload: notification });
    return id;
  };

  // Функция для удаления уведомления
  const dismissNotification = (id: string) => {
    dispatch({ type: 'REMOVE_NOTIFICATION', payload: { id } });
  };

  return (
    <NotificationContext.Provider value={{ notifications, showNotification, dismissNotification }}>
      {children}
    </NotificationContext.Provider>
  );
};

// Хук для использования контекста уведомлений
export const useNotification = (): NotificationContextProps => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export default NotificationProvider;