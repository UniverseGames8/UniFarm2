/**
 * Компонент кнопки закрытия Telegram Mini App
 * 
 * Предоставляет пользователю возможность корректно закрыть приложение
 * через официальный Telegram.WebApp.close() API
 */

import React from 'react';
import { Button } from "@/components/ui/button";
import { SafeTelegramAPI } from '../../services/telegramErrorService';

interface TelegramCloseButtonProps {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
  showIcon?: boolean;
}

const TelegramCloseButton: React.FC<TelegramCloseButtonProps> = ({
  variant = 'outline',
  size = 'default',
  className = '',
  showIcon = true
}) => {
  
  const handleClose = async () => {
    try {
      console.log('[TG CLOSE BUTTON] 🚪 Пользователь нажал кнопку закрытия');
      
      // Вызываем безопасный метод закрытия
      const success = await SafeTelegramAPI.close();
      
      if (success) {
        console.log('[TG CLOSE BUTTON] ✅ Приложение успешно закрыто');
      } else {
        console.warn('[TG CLOSE BUTTON] ⚠️ Закрытие недоступно (возможно, не в Telegram)');
        
        // Fallback для браузера
        if (typeof window !== 'undefined' && window.history.length > 1) {
          window.history.back();
        }
      }
    } catch (error) {
      console.error('[TG ERROR] TelegramCloseButton — Failed to close app:', error);
    }
  };

  return (
    <Button
      onClick={handleClose}
      variant={variant}
      size={size}
      className={className}
    >
      {showIcon && <span className="mr-2">🚪</span>}
      Закрыть UniFarm
    </Button>
  );
};

export default TelegramCloseButton;