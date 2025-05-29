import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useReducer } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTonConnectUI } from '@tonconnect/ui-react';
import { correctApiRequest } from '@/lib/correctApiRequest';
import { fetchBalance, type Balance } from '@/services/balanceService';
import { TonConnectUI } from '@tonconnect/ui-react';
import { 
  getWalletAddress, 
  isWalletConnected, 
  connectWallet as connectTonWallet,
  disconnectWallet as disconnectTonWallet
} from '@/services/tonConnectService';

// Интерфейс для API-ответов
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Тип для контекста пользователя
interface UserContextType {
  userId: number | null;
  username: string | null;
  guestId: string | null;
  telegramId: number | null;
  refCode: string | null;
  // Данные баланса
  uniBalance: number;
  tonBalance: number;
  uniFarmingActive: boolean;
  uniDepositAmount: number;
  uniFarmingBalance: number;
  // Данные кошелька
  isWalletConnected: boolean;
  walletAddress: string | null;
  // Функции
  connectWallet: () => Promise<boolean>;
  disconnectWallet: () => Promise<void>;
  refreshBalance: () => void;
  refreshUserData: () => void;
  // Состояния
  isFetching: boolean;
  isBalanceFetching: boolean;
  error: Error | null;
}

// Контекст с начальным значением undefined
const UserContext = createContext<UserContextType | undefined>(undefined);

/**
 * Редизайн - Провайдер контекста пользователя
 */
export function UserProvider({ children }: { children: React.ReactNode }) {
  // Инициализация хуков
  const queryClient = useQueryClient();
  const [tonConnectUI] = useTonConnectUI();
  
  // Состояние конкретных флагов для предотвращения бесконечных циклов
  const refreshInProgressRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(false);
  
  // Упрощенное состояние пользователя и баланса
  const [userId, setUserId] = useState<number | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [telegramId, setTelegramId] = useState<number | null>(null);
  const [refCode, setRefCode] = useState<string | null>(null);
  
  // Другие состояния
  const [walletConnected, setWalletConnected] = useState<boolean>(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  
  // Упрощённое состояние баланса
  const [balanceState, setBalanceState] = useState<Balance>({
    uniBalance: 0,
    tonBalance: 0,
    uniFarmingActive: false,
    uniDepositAmount: 0,
    uniFarmingBalance: 0
  });
  
  // Упрощенные запросы для предотвращения циклов
  const isFetching = false;
  const isBalanceFetching = false;
  
  // Единоразовая инициализация при монтировании
  useEffect(() => {
    console.log('[UserProvider] Инициализация UserProvider');
    isMountedRef.current = true;
    
    // Получаем статус кошелька при монтировании
    const walletStatus = isWalletConnected(tonConnectUI);
    setWalletConnected(walletStatus);
    
    if (walletStatus) {
      const address = getWalletAddress(tonConnectUI);
      setWalletAddress(address);
    }
    
    // Слушатели событий кошелька
    const handleWalletConnected = () => {
      console.log('[UserProvider] Кошелек подключен');
      setWalletConnected(true);
      const address = getWalletAddress(tonConnectUI);
      setWalletAddress(address);
    };
    
    const handleWalletDisconnected = () => {
      console.log('[UserProvider] Кошелек отключен');
      setWalletConnected(false);
      setWalletAddress(null);
    };
    
    // Подписка на события кошелька
    window.addEventListener('ton-connect-wallet-connected', handleWalletConnected);
    window.addEventListener('ton-connect-wallet-disconnected', handleWalletDisconnected);
    
    return () => {
      isMountedRef.current = false;
      window.removeEventListener('ton-connect-wallet-connected', handleWalletConnected);
      window.removeEventListener('ton-connect-wallet-disconnected', handleWalletDisconnected);
    };
  }, [tonConnectUI]); // Только при монтировании и изменении tonConnectUI
  
  // Обновление данных пользователя - функция вызывается явно, а не автоматически
  const refreshUserData = useCallback(async () => {
    // Предотвращение повторных запросов
    if (refreshInProgressRef.current || !isMountedRef.current) {
      return;
    }
    
    refreshInProgressRef.current = true;
    console.log('[UserProvider] Запуск refreshUserData');
    
    try {
      const response = await correctApiRequest('/api/me');
      
      if (response.success && response.data) {
        const user = response.data;
        
        // Обновляем состояние только если компонент всё ещё смонтирован
        if (isMountedRef.current) {
          setUserId(user.id || null);
          setUsername(user.username || null);
          setGuestId(user.guest_id || null);
          setTelegramId(user.telegram_id || null);
          setRefCode(user.ref_code || null);
          setError(null);
        }
      } else {
        if (isMountedRef.current) {
          setError(new Error(response.error || response.message || 'Ошибка загрузки данных пользователя'));
        }
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error('Неизвестная ошибка при загрузке данных пользователя'));
      }
    } finally {
      refreshInProgressRef.current = false;
    }
  }, []);
  
  // Обновление данных баланса - функция вызывается явно, а не автоматически
  const refreshBalance = useCallback(async () => {
    // Предотвращение обновления если пользователь не авторизован
    if (!userId || !isMountedRef.current) {
      return;
    }
    
    // Предотвращение повторных запросов
    if (refreshInProgressRef.current) {
      return;
    }
    
    refreshInProgressRef.current = true;
    console.log('[UserProvider] Запуск refreshBalance');
    
    try {
      const response = await correctApiRequest('/api/wallet/balance');
      
      if (response.success && response.data) {
        const data = response.data;
        
        // Безопасное получение численных значений
        const safeGetNumber = (value: any, defaultValue = 0): number => {
          if (typeof value === 'number' && !isNaN(value)) return value;
          if (typeof value === 'string') {
            const num = parseFloat(value);
            return !isNaN(num) ? num : defaultValue;
          }
          return defaultValue;
        };
        
        // Безопасное получение boolean значений
        const safeGetBoolean = (value: any): boolean => {
          if (typeof value === 'boolean') return value;
          if (typeof value === 'number') return value !== 0;
          if (typeof value === 'string') return value.toLowerCase() === 'true' || value === '1';
          return Boolean(value);
        };
        
        // Обновляем состояние только если компонент всё ещё смонтирован
        if (isMountedRef.current) {
          const newBalance: Balance = {
            uniBalance: Math.max(0, safeGetNumber(data.balance_uni)),
            tonBalance: Math.max(0, safeGetNumber(data.balance_ton)),
            uniFarmingActive: safeGetBoolean(data.uni_farming_active),
            uniDepositAmount: Math.max(0, safeGetNumber(data.uni_deposit_amount)),
            uniFarmingBalance: Math.max(0, safeGetNumber(data.uni_farming_balance))
          };
          
          setBalanceState(newBalance);
          setError(null);
        }
      } else {
        if (isMountedRef.current) {
          setError(new Error(response.error || response.message || 'Ошибка загрузки баланса'));
        }
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error('Неизвестная ошибка при загрузке баланса'));
      }
    } finally {
      refreshInProgressRef.current = false;
    }
  }, [userId]);
  
  // Логически сгруппированные функции кошелька
  const connectWallet = useCallback(async (): Promise<boolean> => {
    if (!tonConnectUI) {
      setError(new Error('TonConnect UI не инициализирован'));
      return false;
    }
    
    try {
      await connectTonWallet(tonConnectUI);
      
      const isConnected = isWalletConnected(tonConnectUI);
      if (isConnected) {
        const address = getWalletAddress(tonConnectUI);
        setWalletConnected(true);
        setWalletAddress(address);
        return true;
      }
      
      return false;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Ошибка подключения кошелька'));
      return false;
    }
  }, [tonConnectUI]);
  
  const disconnectWallet = useCallback(async (): Promise<void> => {
    if (!tonConnectUI) {
      setError(new Error('TonConnect UI не инициализирован'));
      return;
    }
    
    try {
      await disconnectTonWallet(tonConnectUI);
      setWalletConnected(false);
      setWalletAddress(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Ошибка отключения кошелька'));
    }
  }, [tonConnectUI]);
  
  // Сборка контекста
  const contextValue = {
    // Данные пользователя
    userId,
    username,
    guestId,
    telegramId,
    refCode,
    
    // Данные баланса
    uniBalance: balanceState.uniBalance,
    tonBalance: balanceState.tonBalance,
    uniFarmingActive: balanceState.uniFarmingActive,
    uniDepositAmount: balanceState.uniDepositAmount,
    uniFarmingBalance: balanceState.uniFarmingBalance,
    
    // Данные кошелька
    isWalletConnected: walletConnected,
    walletAddress,
    
    // Функции
    connectWallet,
    disconnectWallet,
    refreshBalance,
    refreshUserData,
    
    // Состояния
    isFetching,
    isBalanceFetching,
    error
  };
  
  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  );
}

/**
 * Хук для использования контекста пользователя
 */
export function useUser(): UserContextType {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser должен использоваться внутри UserProvider');
  }
  return context;
}