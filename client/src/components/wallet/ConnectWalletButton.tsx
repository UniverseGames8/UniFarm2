import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useUser } from '@/contexts/userContext';
import { useNotification } from '@/contexts/notificationContext';

interface ConnectWalletButtonProps {
  className?: string;
}

/**
 * Компонент кнопки для подключения TON кошелька
 * Использует централизованный userContext
 */
const ConnectWalletButton: React.FC<ConnectWalletButtonProps> = ({ className }) => {
  // Получаем состояние и функции управления кошельком из контекста пользователя
  const { 
    isWalletConnected, 
    walletAddress, 
    connectWallet, 
    disconnectWallet 
  } = useUser();
  
  // Получаем доступ к системе уведомлений
  const { showNotification } = useNotification();
  
  // Локальное состояние для отображения индикатора загрузки
  const [loading, setLoading] = useState(false);
  
  // Обработчик подключения/отключения кошелька
  const handleWalletConnection = async () => {
    setLoading(true);
    
    try {
      if (isWalletConnected) {
        // Отображаем уведомление о процессе отключения
        showNotification('loading', {
          message: 'Отключение кошелька...',
          duration: 2000
        });
        
        // Отключение кошелька
        await disconnectWallet();
        
        // Уведомление об успешном отключении
        showNotification('info', {
          message: 'Кошелёк успешно отключен',
          duration: 3000
        });
      } else {
        // Отображаем уведомление о процессе подключения
        showNotification('loading', {
          message: 'Ожидание подключения кошелька...',
          duration: 2000
        });
        
        // Подключение кошелька
        await connectWallet();
        
        // Уведомление об успешном подключении
        showNotification('success', {
          message: 'Кошелёк успешно подключен',
          duration: 3000
        });
      }
    } catch (error) {
      // Безопасное обращение к свойству message у error
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      console.error('Ошибка управления кошельком:', errorMessage);
      
      // Отображаем уведомление об ошибке
      showNotification('error', {
        message: `Ошибка: ${errorMessage}`,
        duration: 5000
      });
    } finally {
      setLoading(false);
    }
  };

  // Копирование адреса в буфер обмена
  const copyAddressToClipboard = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress)
        .then(() => {
          // Показываем уведомление об успешном копировании
          showNotification('success', {
            message: 'Адрес кошелька скопирован в буфер обмена',
            duration: 2000
          });
        })
        .catch((error) => {
          console.error('Ошибка копирования адреса:', error);
          
          // Показываем уведомление об ошибке копирования
          showNotification('error', {
            message: 'Не удалось скопировать адрес кошелька',
            duration: 3000
          });
        });
    }
  };

  // Форматирование адреса кошелька для отображения (сокращаем для компактности)
  const formatWalletAddress = (address: string): string => {
    if (address.length <= 20) return address;
    return `${address.substring(0, 10)}...${address.substring(address.length - 10)}`;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="default"
            onClick={handleWalletConnection}
            className={`relative px-3 py-2 ${
              isWalletConnected 
                ? 'bg-blue-100 hover:bg-blue-200 text-blue-700 border border-blue-300' 
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            } ${className}`}
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Подключение...
              </span>
            ) : isWalletConnected && walletAddress ? (
              <div className="flex items-center space-x-1" onClick={copyAddressToClipboard}>
                <span className="text-sm font-medium truncate max-w-[280px]">
                  {formatWalletAddress(walletAddress)}
                </span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </div>
            ) : (
              <div className="flex items-center space-x-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>
                  <line x1="12" y1="16" x2="12" y2="16"></line>
                  <line x1="8" y1="12" x2="16" y2="12"></line>
                </svg>
                <span>Connect Wallet</span>
              </div>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isWalletConnected && walletAddress 
            ? 'Нажмите, чтобы скопировать TON-адрес' 
            : 'Подключите TON-кошелек через Tonkeeper или другой совместимый кошелек'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ConnectWalletButton;