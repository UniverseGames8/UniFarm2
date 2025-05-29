import React from 'react';
import { useNotification } from '@/contexts/notificationContext';
import Notification from './Notification';

const NotificationContainer: React.FC = () => {
  const { notifications, dismissNotification } = useNotification();

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col items-end space-y-2 pointer-events-none">
      <div className="flex flex-col items-end space-y-2 pointer-events-auto">
        {notifications.map((notification) => (
          <Notification
            key={notification.id}
            notification={notification}
            onDismiss={dismissNotification}
          />
        ))}
      </div>
    </div>
  );
};

export default NotificationContainer;