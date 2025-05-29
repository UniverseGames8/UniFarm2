import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTonConnectUI } from '@tonconnect/ui-react';
import { correctApiRequest } from '@/lib/correctApiRequest';
import { fetchBalance, type Balance } from '@/services/balanceService';
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
 * Упрощенная версия UserProvider только с необходимыми функциями
 * Убраны все эффекты для предотвращения бесконечных циклов
 */
export function UserProvider({ children }: { children: React.ReactNode }) {
  // Инициализация хуков
  const queryClient = useQueryClient();
  const [tonConnectUI] = useTonConnectUI();
  
  // Рефы для предотвращения повторных вызовов
  const refreshInProgressRef = useRef<boolean>(false);
  
  // Основные состояния
  const [userId, setUserId] = useState<number | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [telegramId, setTelegramId] = useState<number | null>(null);
  const [refCode, setRefCode] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  
  // Состояние кошелька
  const [walletConnected, setWalletConnected] = useState<boolean>(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  
  // Состояние баланса
  const [balanceState, setBalanceState] = useState<Balance>({
    uniBalance: 0,
    tonBalance: 0,
    uniFarmingActive: false,
    uniDepositAmount: 0,
    uniFarmingBalance: 0
  });
  
  // Обновление данных пользователя - функция вызывается вручную
  const refreshUserData = useCallback(async () => {
    if (refreshInProgressRef.current) {
      return;
    }
    
    refreshInProgressRef.current = true;
    
    try {
      const response = await correctApiRequest('/api/me');
      
      if (response.success && response.data) {
        const user = response.data;
        setUserId(user.id || null);
        setUsername(user.username || null);
        setGuestId(user.guest_id || null);
        setTelegramId(user.telegram_id || null);
        setRefCode(user.ref_code || null);
        setError(null);
      } else {
        setError(new Error(response.error || response.message || 'Ошибка получения данных пользователя'));
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Неизвестная ошибка при загрузке данных пользователя'));
    } finally {
      refreshInProgressRef.current = false;
    }
  }, []);
  
  // Обновление баланса - функция вызывается вручную
  const refreshBalance = useCallback(async () => {
    if (refreshInProgressRef.current || !userId) {
      return;
    }
    
    refreshInProgressRef.current = true;
    
    try {
      const response = await correctApiRequest('/api/wallet/balance');
      
      if (response.success && response.data) {
        const data = response.data;
        
        // Безопасное получение значений
        const safeParseFloat = (value: any, defaultValue = 0) => {
          if (typeof value === 'number' && !isNaN(value)) return value;
          if (typeof value === 'string') {
            const parsed = parseFloat(value);
            return !isNaN(parsed) ? parsed : defaultValue;
          }
          return defaultValue;
        };
        
        const safeBooleanParse = (value: any) => {
          if (typeof value === 'boolean') return value;
          if (typeof value === 'number') return value !== 0;
          if (typeof value === 'string') return value.toLowerCase() === 'true' || value === '1';
          return Boolean(value);
        };
        
        setBalanceState({
          uniBalance: Math.max(0, safeParseFloat(data.balance_uni)),
          tonBalance: Math.max(0, safeParseFloat(data.balance_ton)),
          uniFarmingActive: safeBooleanParse(data.uni_farming_active),
          uniDepositAmount: Math.max(0, safeParseFloat(data.uni_deposit_amount)),
          uniFarmingBalance: Math.max(0, safeParseFloat(data.uni_farming_balance))
        });
        setError(null);
      } else {
        setError(new Error(response.error || response.message || 'Ошибка получения баланса'));
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Неизвестная ошибка при загрузке баланса'));
    } finally {
      refreshInProgressRef.current = false;
    }
  }, [userId]);
  
  // Функции работы с кошельком
  const connectWallet = useCallback(async (): Promise<boolean> => {
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
    try {
      await disconnectTonWallet(tonConnectUI);
      setWalletConnected(false);
      setWalletAddress(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Ошибка отключения кошелька'));
    }
  }, [tonConnectUI]);
  
  // Значение контекста
  const value: UserContextType = {
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
    isFetching: false,
    isBalanceFetching: false,
    error
  };
  
  return (
    <UserContext.Provider value={value}>
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