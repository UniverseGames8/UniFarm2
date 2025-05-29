import React, { useEffect } from 'react';
import { Notification as NotificationType } from '@/types/notification';

interface NotificationProps {
  notification: NotificationType;
  onDismiss: (id: string) => void;
}

const Notification: React.FC<NotificationProps> = ({ notification, onDismiss }) => {
  const { id, type, message, duration, autoDismiss } = notification;
  
  // Автоматически скрываем уведомление через duration, если autoDismiss = true
  useEffect(() => {
    if (autoDismiss && duration) {
      const timer = setTimeout(() => {
        onDismiss(id);
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [id, duration, autoDismiss, onDismiss]);
  
  // Выбираем цвет фона, иконку и эмодзи в зависимости от типа уведомления
  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          bgClass: 'bg-success/10 border-l-4 border-success border-y border-r border-success/30',
          textClass: 'text-success',
          icon: 'fas fa-check-circle',
          emoji: '🎉',
          title: 'Отлично!'
        };
      case 'error':
        return {
          bgClass: 'bg-destructive/10 border-l-4 border-destructive border-y border-r border-destructive/30',
          textClass: 'text-destructive',
          icon: 'fas fa-exclamation-circle',
          emoji: '❌',
          title: 'Ошибка!'
        };
      case 'info':
        return {
          bgClass: 'bg-primary/10 border-l-4 border-primary border-y border-r border-primary/30',
          textClass: 'text-primary',
          icon: 'fas fa-info-circle',
          emoji: '💡',
          title: 'Информация'
        };
      case 'loading':
        return {
          bgClass: 'bg-muted/10 border-l-4 border-muted/50 border-y border-r border-muted/30',
          textClass: 'text-muted-foreground',
          icon: 'fas fa-spinner fa-spin',
          emoji: '⏳',
          title: 'Загрузка...'
        };
      default:
        return {
          bgClass: 'bg-muted/10 border-l-4 border-muted/50 border-y border-r border-muted/30',
          textClass: 'text-muted-foreground',
          icon: 'fas fa-bell',
          emoji: '🔔',
          title: 'Уведомление'
        };
    }
  };
  
  const styles = getTypeStyles();
  
  // Функция для обработки эмодзи в сообщении
  const formatMessage = (msg: string) => {
    // Простая проверка на наличие эмодзи в сообщении
    const hasEmoji = (str: string) => {
      const emojiRanges = [
        0x1F600, 0x1F64F, // Emoticons
        0x1F300, 0x1F5FF, // Misc Symbols & Pictographs
        0x1F680, 0x1F6FF, // Transport & Map
        0x2600, 0x26FF,   // Misc symbols
        0x2700, 0x27BF,   // Dingbats
        0xFE00, 0xFE0F,   // Variation Selectors
        0x1F900, 0x1F9FF, // Supplemental Symbols and Pictographs
        0x1F1E6, 0x1F1FF  // Flags
      ];
      
      for (let i = 0; i < str.length; i++) {
        const code = str.codePointAt(i);
        if (!code) continue;
        
        for (let j = 0; j < emojiRanges.length; j += 2) {
          if (code >= emojiRanges[j] && code <= emojiRanges[j + 1]) {
            return true;
          }
        }
      }
      return false;
    };

    // Если в сообщении уже есть эмодзи, то возвращаем как есть
    if (hasEmoji(msg)) {
      return msg;
    }
    
    // Добавляем контекстные эмодзи в зависимости от содержания сообщения
    if (msg.includes('UNI') || msg.includes('монет')) {
      return msg.replace(/([\d.,]+)\s*UNI/g, '$1 UNI 💰');
    }
    if (msg.includes('TON')) {
      return msg.replace(/([\d.,]+)\s*TON/g, '$1 TON 💎');
    }
    if (msg.includes('кошелёк') || msg.includes('кошелек')) {
      return msg.replace(/(кошелёк|кошелек)/g, '$1 👛');
    }
    if (msg.includes('бонус') || msg.includes('награда')) {
      return msg + ' 🎁';
    }
    if (msg.includes('миссия') || msg.includes('задание')) {
      return msg + ' ✅';
    }
    
    return msg;
  };
  
  return (
    <div 
      className={`rounded-lg shadow-lg backdrop-blur-sm px-4 py-3 ${styles.bgClass} min-w-[300px] max-w-sm mb-2 animate-slideInRight`}
      role="alert"
    >
      <div className="flex items-start">
        <div className={`mr-3 ${styles.textClass} flex items-center justify-center`}>
          <span className="text-xl mr-1">{styles.emoji}</span>
          <i className={styles.icon}></i>
        </div>
        <div className="flex-1 text-sm">
          <p className={`${styles.textClass} font-semibold mb-0.5`}>{styles.title}</p>
          <p className="text-foreground">{formatMessage(message)}</p>
        </div>
        <button 
          onClick={() => onDismiss(id)} 
          className="ml-2 text-gray-400 hover:text-gray-500 transition-colors"
          aria-label="Закрыть"
        >
          <i className="fas fa-times"></i>
        </button>
      </div>
    </div>
  );
};

export default Notification;