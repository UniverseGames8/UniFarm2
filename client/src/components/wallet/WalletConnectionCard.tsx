import React, { useState } from 'react';
import { useUser } from '@/contexts/userContext';
import { useNotification } from '@/contexts/notificationContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * Компонент карточки подключения кошелька
 * Отображает текущий статус подключения и адрес кошелька TON
 * Использует userContext для получения и управления состоянием кошелька
 */
const WalletConnectionCard: React.FC = () => {
  // Получаем данные и методы управления кошельком из контекста пользователя
  const { 
    isWalletConnected, 
    walletAddress, 
    connectWallet, 
    disconnectWallet 
  } = useUser();
  
  // Локальные состояния для UI
  const [loading, setLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Получение доступа к системе уведомлений
  const { showNotification } = useNotification();
  
  /**
   * Обработчик подключения/отключения кошелька
   */
  const handleWalletConnection = async () => {
    setLoading(true);
    
    try {
      if (isWalletConnected) {
        // Отображаем уведомление о процессе отключения
        showNotification('loading', {
          message: 'Отключение кошелька...',
          duration: 2000
        });
        
        // Отключаем кошелек
        await disconnectWallet();
        
        // Показываем уведомление об успешном отключении
        showNotification('info', {
          message: 'TON-кошелек успешно отключен',
          duration: 3000
        });
      } else {
        // Отображаем уведомление о процессе подключения
        showNotification('loading', {
          message: 'Ожидание подключения кошелька...',
          duration: 2000
        });
        
        // Подключаем кошелек
        const success = await connectWallet();
        
        if (success) {
          // Уведомление об успешном подключении
          showNotification('success', {
            message: 'TON-кошелек успешно подключен',
            duration: 3000
          });
        } else {
          // Уведомление об ошибке
          showNotification('error', {
            message: 'Не удалось подключить кошелек',
            duration: 3000
          });
        }
      }
    } catch (error) {
      // Безопасное обращение к свойству message у error
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      
      // Показываем уведомление об ошибке
      showNotification('error', {
        message: `Ошибка: ${errorMessage}`,
        duration: 4000
      });
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Копирует адрес кошелька в буфер обмена
   */
  const copyAddressToClipboard = async () => {
    if (!walletAddress) return;
    
    try {
      await navigator.clipboard.writeText(walletAddress);
      
      // Устанавливаем статус успешного копирования
      setCopySuccess(true);
      
      // Показываем уведомление об успешном копировании
      showNotification('success', {
        message: 'TON-адрес скопирован в буфер обмена',
        duration: 2000
      });
      
      // Сбрасываем статус через 2 секунды
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      // Получаем текст ошибки
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      
      // Показываем уведомление об ошибке
      showNotification('error', {
        message: `Не удалось скопировать адрес кошелька: ${errorMessage}`,
        duration: 3000
      });
      
      // Сбрасываем статус копирования
      setCopySuccess(false);
    }
  };
  
  /**
   * Форматирует адрес кошелька для отображения (сокращаем для компактности)
   * @param address Полный адрес кошелька
   * @returns Сокращенный адрес для отображения
   */
  const formatWalletAddress = (address: string): string => {
    if (!address || address.length <= 10) return address;
    return `${address.substring(0, 6)}...${address.substring(address.length - 6)}`;
  };
  
  return (
    <Card className="mb-6 bg-gray-800 border-gray-700 shadow-lg">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-white">Подключение кошелька</CardTitle>
          
          {/* Индикатор статуса подключения */}
          {isWalletConnected ? (
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-green-500 text-xs font-medium">Подключено</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-gray-500 rounded-full"></span>
              <span className="text-gray-500 text-xs font-medium">Не подключено</span>
            </div>
          )}
        </div>
        <CardDescription>
          {isWalletConnected 
            ? 'Ваш TON-кошелек подключен и готов к использованию'
            : 'Подключите ваш TON-кошелек для отправки и получения TON'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="w-full">
            {isWalletConnected && walletAddress ? (
              <div className="text-sm text-gray-300 w-full">
                <p className="mb-1">Адрес вашего кошелька:</p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div 
                        onClick={copyAddressToClipboard}
                        className={`flex items-center justify-between space-x-2 bg-gray-700 px-3 py-1.5 rounded-md cursor-pointer hover:bg-gray-600 transition-colors overflow-hidden ${copySuccess ? 'bg-green-900/30 border border-green-700' : ''}`}
                      >
                        <span className="text-sm font-mono text-blue-300 truncate">{walletAddress}</span>
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
                          className={`flex-shrink-0 ${copySuccess ? 'text-green-400' : 'text-gray-400'}`}
                        >
                          {copySuccess ? (
                            <path d="M20 6L9 17l-5-5" />
                          ) : (
                            <>
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </>
                          )}
                        </svg>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Нажмите, чтобы скопировать полный адрес</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                Чтобы начать пользоваться TON-фармингом, необходимо подключить кошелек
              </p>
            )}
          </div>
          
          {/* Кнопка подключения/отключения кошелька */}
          <div className="flex-shrink-0">
            <Button
              variant={isWalletConnected ? "destructive" : "default"}
              size="sm"
              onClick={handleWalletConnection}
              disabled={loading}
              className="min-w-[140px]"
            >
              {loading ? (
                <span className="flex items-center space-x-1">
                  <svg className="animate-spin h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {isWalletConnected ? 'Отключение...' : 'Подключение...'}
                </span>
              ) : isWalletConnected ? (
                'Отключить'
              ) : (
                'Подключить'
              )}
            </Button>
          </div>
        </div>
        
        {/* Дополнительная информация о подключении */}
        {isWalletConnected && walletAddress && (
          <div className="mt-4 text-xs text-gray-400 border-t border-gray-700 pt-3">
            <p>Подключен кошелек: <span className="font-medium text-blue-300">{formatWalletAddress(walletAddress)}</span></p>
            <p className="mt-1">Используйте этот кошелек для транзакций в TON и активации TON-фарминга</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WalletConnectionCard;