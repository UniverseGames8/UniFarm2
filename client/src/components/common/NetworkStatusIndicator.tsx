import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useWebSocket } from '@/contexts/webSocketContext';
import { 
  Alert,
  AlertTitle,
  AlertDescription
} from '@/components/ui/alert';
import { WifiIcon, WifiOffIcon, ServerIcon, ServerOffIcon } from 'lucide-react';

type AlertType = 'online' | 'offline' | 'wsConnected' | 'wsDisconnected' | 'hidden';

/**
 * Компонент для отображения статуса сетевого соединения и WebSocket
 * Показывает уведомление при потере соединения
 */
const NetworkStatusIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [alertType, setAlertType] = useState<AlertType>('hidden');
  const [alertVisible, setAlertVisible] = useState<boolean>(false);
  const { connectionStatus } = useWebSocket();

  // Обновляем статус онлайн/оффлайн
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setAlertType('online');
      setAlertVisible(true);
      
      // Автоматически скрываем уведомление об успешном подключении через 3 секунды
      setTimeout(() => {
        setAlertVisible(false);
      }, 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setAlertType('offline');
      setAlertVisible(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Обновляем статус WebSocket соединения
  useEffect(() => {
    if (connectionStatus === 'connected') {
      setAlertType('wsConnected');
      setAlertVisible(true);
      
      // Автоматически скрываем уведомление об успешном подключении через 3 секунды
      setTimeout(() => {
        setAlertVisible(false);
      }, 3000);
    } else if (connectionStatus === 'disconnected') {
      setAlertType('wsDisconnected');
      setAlertVisible(true);
    } else {
      // Если статус 'connecting', не показываем уведомление
    }
  }, [connectionStatus]);

  // Если нет проблем с соединением, ничего не показываем
  if (!alertVisible) {
    return null;
  }

  const alertContent = {
    online: {
      icon: <WifiIcon className="h-4 w-4 text-green-600" />,
      title: "Соединение восстановлено",
      description: "Интернет-соединение успешно восстановлено.",
      variant: "default" as const
    },
    offline: {
      icon: <WifiOffIcon className="h-4 w-4 text-red-600" />,
      title: "Нет интернет-соединения",
      description: "Проверьте ваше подключение к интернету.",
      variant: "destructive" as const
    },
    wsConnected: {
      icon: <ServerIcon className="h-4 w-4 text-green-600" />,
      title: "Соединение с сервером установлено",
      description: "Данные обновляются в реальном времени.",
      variant: "default" as const
    },
    wsDisconnected: {
      icon: <ServerOffIcon className="h-4 w-4 text-red-600" />,
      title: "Ошибка соединения с сервером",
      description: "Попытка переподключения...",
      variant: "destructive" as const
    },
    hidden: {
      icon: null,
      title: "",
      description: "",
      variant: "default" as const
    }
  };

  const { icon, title, description, variant } = alertContent[alertType];

  return (
    <div className="fixed top-16 left-0 right-0 z-50 mx-auto w-full max-w-md px-4">
      <Alert 
        variant={variant === 'default' ? 'default' : 'destructive'}
        className={cn(
          "border shadow-lg transition-opacity duration-300",
          alertType === 'online' || alertType === 'wsConnected' ? 'bg-green-50 dark:bg-green-950' : '',
          alertType === 'offline' || alertType === 'wsDisconnected' ? 'bg-red-50 dark:bg-red-950' : ''
        )}
      >
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <AlertTitle>{title}</AlertTitle>
            <AlertDescription>{description}</AlertDescription>
          </div>
        </div>
      </Alert>
    </div>
  );
};

export default NetworkStatusIndicator;