import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect } from 'react';
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
  refreshBalance: (forceRefresh?: boolean) => void;
  refreshUserData: () => void;
  // Состояния
  isFetching: boolean;
  isBalanceFetching: boolean;
  error: Error | null;
}

// Тип состояния для useReducer
interface UserState {
  // Данные пользователя
  userId: number | null;
  username: string | null;
  guestId: string | null;
  telegramId: number | null;
  refCode: string | null;
  
  // Данные баланса
  balanceState: Balance;
  
  // Состояние кошелька
  walletConnected: boolean;
  walletAddress: string | null;
  
  // Состояния загрузки и ошибок
  isFetching: boolean;
  isBalanceFetching: boolean;
  error: Error | null;
}

// Начальное состояние
const initialState: UserState = {
  userId: null,
  username: null,
  guestId: null,
  telegramId: null,
  refCode: null,
  
  balanceState: {
    uniBalance: 0,
    tonBalance: 0,
    uniFarmingActive: false,
    uniDepositAmount: 0,
    uniFarmingBalance: 0
  },
  
  walletConnected: false,
  walletAddress: null,
  
  isFetching: false,
  isBalanceFetching: false,
  error: null
};

// Типы действий для reducer
type UserAction =
  | { type: 'SET_USER_DATA'; payload: Partial<UserState> }
  | { type: 'SET_BALANCE'; payload: Balance }
  | { type: 'SET_WALLET_CONNECTED'; payload: { connected: boolean; address: string | null } }
  | { type: 'SET_LOADING'; payload: { field: 'isFetching' | 'isBalanceFetching'; value: boolean } }
  | { type: 'SET_ERROR'; payload: Error | null };

// Reducer функция для обработки действий
function userReducer(state: UserState, action: UserAction): UserState {
  switch (action.type) {
    case 'SET_USER_DATA':
      return { ...state, ...action.payload };
      
    case 'SET_BALANCE':
      return {
        ...state,
        balanceState: action.payload
      };
      
    case 'SET_WALLET_CONNECTED':
      return {
        ...state,
        walletConnected: action.payload.connected,
        walletAddress: action.payload.address
      };
      
    case 'SET_LOADING':
      return {
        ...state,
        [action.payload.field]: action.payload.value
      };
      
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload
      };
      
    default:
      return state;
  }
}

// Контекст с начальным значением undefined
const UserContext = createContext<UserContextType | undefined>(undefined);

/**
 * Провайдер контекста пользователя с использованием useReducer
 * для предотвращения бесконечных циклов обновления
 */
export function UserProvider({ children }: { children: React.ReactNode }) {
  // Инициализация хуков
  const queryClient = useQueryClient();
  const [tonConnectUI] = useTonConnectUI();
  
  // Создаем состояние с помощью useReducer
  const [state, dispatch] = useReducer(userReducer, initialState);
  
  // Рефы для предотвращения повторных вызовов
  const refreshInProgressRef = useRef<boolean>(false);
  const initializedRef = useRef<boolean>(false);
  
  // Обновление данных пользователя
  const refreshUserData = useCallback(async () => {
    if (refreshInProgressRef.current) {
      return;
    }
    
    refreshInProgressRef.current = true;
    dispatch({ type: 'SET_LOADING', payload: { field: 'isFetching', value: true } });
    
    try {
      // Пытаемся получить userId из localStorage, если там есть сохраненная сессия
      let userId = null;
      try {
        const lastSessionStr = localStorage.getItem('unifarm_last_session');
        if (lastSessionStr) {
          const lastSession = JSON.parse(lastSessionStr);
          userId = lastSession.user_id;
          console.log('[UserContext] Найден user_id в localStorage:', userId);
        }
      } catch (e) {
        console.warn('[UserContext] Ошибка при попытке получить user_id из localStorage:', e);
      }
      
      // Делаем запрос с явно указанным user_id, если он доступен
      const response = await correctApiRequest(userId ? `/api/me?user_id=${userId}` : '/api/me');
      
      if (response.success && response.data) {
        const user = response.data;
        
        dispatch({
          type: 'SET_USER_DATA',
          payload: {
            userId: user.id || null,
            username: user.username || null,
            guestId: user.guest_id || null,
            telegramId: user.telegram_id || null,
            refCode: user.ref_code || null
          }
        });
        
        dispatch({ type: 'SET_ERROR', payload: null });
        
        // Сохраняем обновленные данные в localStorage
        try {
          localStorage.setItem('unifarm_last_session', JSON.stringify({
            timestamp: new Date().toISOString(),
            user_id: user.id || userId,
            username: user.username || null,
            refCode: user.ref_code || null
          }));
        } catch (e) {
          console.warn('[UserContext] Ошибка при сохранении данных пользователя в localStorage:', e);
        }
      } else {
        // Если запрос не удался, сначала проверяем, если user_id есть в localStorage
        if (userId) {
          console.log('[UserContext] Используем информацию о пользователе из localStorage:', userId);
          // Установим минимально необходимые данные из localStorage
          dispatch({
            type: 'SET_USER_DATA',
            payload: {
              userId: userId,
              username: null,
              guestId: null,
              telegramId: null,
              refCode: null
            }
          });
          dispatch({ type: 'SET_ERROR', payload: null });
        } else {
          const errorMsg = response.error || response.message || 'Ошибка получения данных пользователя';
          console.error('[UserContext] Ошибка получения данных пользователя:', errorMsg);
          dispatch({ type: 'SET_ERROR', payload: new Error(errorMsg) });
        }
      }
    } catch (err) {
      // Проверяем, если есть данные пользователя в localStorage
      try {
        const lastSessionStr = localStorage.getItem('unifarm_last_session');
        if (lastSessionStr) {
          const lastSession = JSON.parse(lastSessionStr);
          if (lastSession.user_id) {
            console.log('[UserContext] Восстановление данных из localStorage после ошибки:', lastSession.user_id);
            dispatch({
              type: 'SET_USER_DATA',
              payload: {
                userId: lastSession.user_id,
                username: lastSession.username || null,
                guestId: null,
                telegramId: null,
                refCode: lastSession.refCode || null
              }
            });
            dispatch({ type: 'SET_ERROR', payload: null });
          }
        }
      } catch (e) {
        console.warn('[UserContext] Ошибка при попытке восстановить данные из localStorage:', e);
      }
      
      const error = err instanceof Error ? err : new Error('Ошибка получения данных пользователя');
      console.error('[UserContext] Ошибка получения данных пользователя:', error);
      dispatch({ type: 'SET_ERROR', payload: error });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { field: 'isFetching', value: false } });
      refreshInProgressRef.current = false;
    }
  }, []);
  
  // Обновление баланса
  const refreshBalance = useCallback(async (forceRefresh: boolean = false) => {
    if (refreshInProgressRef.current || !state.userId) {
      return;
    }
    
    refreshInProgressRef.current = true;
    dispatch({ type: 'SET_LOADING', payload: { field: 'isBalanceFetching', value: true } });
    
    try {
      // Используем улучшенный сервис с поддержкой forceRefresh
      console.log('[UserContext] Запрос баланса с forceRefresh:', forceRefresh);
      const balance = await fetchBalance(state.userId, forceRefresh);
      
      // Обновляем состояние баланса
      dispatch({ type: 'SET_BALANCE', payload: balance });
      dispatch({ type: 'SET_ERROR', payload: null });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Ошибка получения баланса');
      console.error('[UserContext] Ошибка получения баланса:', error);
      dispatch({ type: 'SET_ERROR', payload: error });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { field: 'isBalanceFetching', value: false } });
      refreshInProgressRef.current = false;
    }
  }, [state.userId]);
  
  // Функции работы с кошельком
  const connectWallet = useCallback(async (): Promise<boolean> => {
    try {
      await connectTonWallet(tonConnectUI);
      
      const connected = isWalletConnected(tonConnectUI);
      if (connected) {
        const address = getWalletAddress(tonConnectUI);
        
        dispatch({
          type: 'SET_WALLET_CONNECTED',
          payload: { connected: true, address }
        });
        
        return true;
      }
      
      return false;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Ошибка подключения кошелька');
      dispatch({ type: 'SET_ERROR', payload: error });
      return false;
    }
  }, [tonConnectUI]);
  
  const disconnectWallet = useCallback(async (): Promise<void> => {
    try {
      await disconnectTonWallet(tonConnectUI);
      
      dispatch({
        type: 'SET_WALLET_CONNECTED',
        payload: { connected: false, address: null }
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Ошибка отключения кошелька');
      dispatch({ type: 'SET_ERROR', payload: error });
    }
  }, [tonConnectUI]);
  
  // Проверяем статус подключения кошелька
  useEffect(() => {
    if (initializedRef.current) return;
    
    try {
      // Проверяем, подключен ли кошелек
      const connected = isWalletConnected(tonConnectUI);
      if (connected) {
        const address = getWalletAddress(tonConnectUI);
        
        // Кошелек уже подключен, устанавливаем состояние
        dispatch({
          type: 'SET_WALLET_CONNECTED',
          payload: { connected: true, address }
        });
      }
    } catch (err) {
      console.error('[UserContext] Ошибка при проверке статуса кошелька:', err);
    }
    
    initializedRef.current = true;
  }, [tonConnectUI]);
  
  // Автоматическая загрузка данных пользователя при первом рендере
  useEffect(() => {
    const loadInitialUserData = async () => {
      console.log('[UserContext] Автоматическая загрузка данных пользователя...');
      try {
        // Сначала запрашиваем данные пользователя
        await refreshUserData();
        
        // Затем, если получили userId, запрашиваем баланс
        if (state.userId) {
          console.log('[UserContext] Данные пользователя получены, запрашиваем баланс...');
          await refreshBalance();
        }
      } catch (err) {
        console.error('[UserContext] Ошибка при загрузке начальных данных:', err);
      }
    };
    
    loadInitialUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [/* Пустой массив зависимостей, чтобы эффект выполнился только при первом рендере */]);
  
  // Значение контекста
  const value: UserContextType = {
    // Данные пользователя
    userId: state.userId,
    username: state.username,
    guestId: state.guestId,
    telegramId: state.telegramId,
    refCode: state.refCode,
    
    // Данные баланса
    uniBalance: state.balanceState.uniBalance,
    tonBalance: state.balanceState.tonBalance,
    uniFarmingActive: state.balanceState.uniFarmingActive,
    uniDepositAmount: state.balanceState.uniDepositAmount,
    uniFarmingBalance: state.balanceState.uniFarmingBalance,
    
    // Данные кошелька
    isWalletConnected: state.walletConnected,
    walletAddress: state.walletAddress,
    
    // Функции
    connectWallet,
    disconnectWallet,
    refreshBalance,
    refreshUserData,
    
    // Состояния
    isFetching: state.isFetching,
    isBalanceFetching: state.isBalanceFetching,
    error: state.error
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