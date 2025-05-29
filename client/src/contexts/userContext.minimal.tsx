import React, { createContext, useContext } from 'react';

// Очень простая версия контекста пользователя, предотвращающая циклы обновлений
interface UserContextType {
  userId: number | null;
  username: string | null;
  guestId: string | null;
  telegramId: number | null;
  refCode: string | null;
  uniBalance: number;
  tonBalance: number;
  uniFarmingActive: boolean;
  uniDepositAmount: number;
  uniFarmingBalance: number;
  isWalletConnected: boolean;
  walletAddress: string | null;
  connectWallet: () => Promise<boolean>;
  disconnectWallet: () => Promise<void>;
  refreshBalance: () => void;
  refreshUserData: () => void;
  isFetching: boolean;
  isBalanceFetching: boolean;
  error: Error | null;
}

// Статичные значения заглушек для предотвращения циклов
const defaultContextValue: UserContextType = {
  userId: 1, // Временное значение для отладки
  username: 'debug_user',
  guestId: null,
  telegramId: null,
  refCode: null,
  uniBalance: 0,
  tonBalance: 0,
  uniFarmingActive: false,
  uniDepositAmount: 0,
  uniFarmingBalance: 0,
  isWalletConnected: false,
  walletAddress: null,
  // Функции-заглушки
  connectWallet: async () => false,
  disconnectWallet: async () => {/* noop */},
  refreshBalance: () => {/* noop */},
  refreshUserData: () => {/* noop */},
  isFetching: false,
  isBalanceFetching: false,
  error: null
};

// Создание контекста с начальным значением
const UserContext = createContext<UserContextType>(defaultContextValue);

/**
 * Минимальная версия UserProvider без хуков состояния и эффектов
 * для предотвращения циклов обновления
 */
export function UserProvider({ children }: { children: React.ReactNode }) {
  // Просто возвращаем компонент без изменений состояния
  return (
    <UserContext.Provider value={defaultContextValue}>
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