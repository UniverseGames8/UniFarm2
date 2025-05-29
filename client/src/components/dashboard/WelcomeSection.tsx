import React, { useEffect, useState } from 'react';
import { useTonConnectUI } from '@tonconnect/ui-react';
import { getTelegramUserDisplayName, isTelegramWebApp } from '@/services/telegramService';
import { 
  isWalletConnected, 
  getWalletAddress
} from '@/services/tonConnectService';
import { useQuery } from '@tanstack/react-query';

const WelcomeSection: React.FC = () => {
  const [userName, setUserName] = useState<string>('Пользователь');
  const [walletConnected, setWalletConnected] = useState<boolean>(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [tonConnectUI] = useTonConnectUI();
  
  // Запрос данных о пользователе через API
  const { data: userData } = useQuery<{
    success: boolean;
    data?: {
      id: number;
      username: string;
      // другие поля пользователя
    }
  }>({
    queryKey: ['/api/v2/me'],
    staleTime: 60000, // Кэширование на 1 минуту
    refetchOnWindowFocus: false
  });
  
  // Обновляем состояние кошелька при изменении tonConnectUI
  useEffect(() => {
    if (tonConnectUI) {
      setWalletConnected(isWalletConnected(tonConnectUI));
      setWalletAddress(getWalletAddress(tonConnectUI));
      
      // Создаем обработчик событий изменения кошелька
      const handleWalletUpdate = () => {
        setWalletConnected(isWalletConnected(tonConnectUI));
        setWalletAddress(getWalletAddress(tonConnectUI));
      };
      
      // Подписываемся на события изменения состояния кошелька
      tonConnectUI.onStatusChange(handleWalletUpdate);
      
      return () => {
        // Отписываемся при размонтировании
        // Обратите внимание, что для TonConnectUI нет метода off
        // поэтому здесь не нужен явный cleanup
      };
    }
  }, [tonConnectUI]);
  
  // Обновляем имя пользователя при получении данных или при старте приложения
  useEffect(() => {
    // Если получили данные пользователя через API
    if (userData?.success && userData?.data) {
      // Используем имя пользователя из данных пользователя, если доступно
      if (userData.data.username) {
        setUserName(userData.data.username);
        return;
      }
    }
    
    // Как запасной вариант, используем имя из Telegram
    const displayName = getTelegramUserDisplayName();
    setUserName(displayName);
  }, [userData]);
  
  return (
    <div className="welcome-card-bg subtle-pattern rounded-xl p-5 mb-6 shadow-lg shadow-primary/20 backdrop-blur-md border border-white/10 overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-purple-600/5 via-transparent to-accent/5"></div>
      
      {/* Тонкая светящаяся линия сверху */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
      
      {/* Главный контент с лого и минималистичным дизайном */}
      <div className="relative flex items-start justify-between">
        {/* Лого UniFarm с эффектом парения */}
        <div className="flex items-center float-animation">
          {/* Усовершенствованная монета с буквой U */}
          <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-primary via-purple-600 to-purple-800 flex items-center justify-center mr-3 border-[1.5px] border-white/20 shadow-md shadow-primary/30 unifarm-logo-glow overflow-hidden coin-3d-effect">
            {/* Внутреннее свечение */}
            <div className="absolute inset-1 bg-gradient-to-tr from-accent/30 to-transparent opacity-70 rounded-full"></div>
            
            {/* Эффект блика */}
            <div className="absolute -top-4 -left-4 w-8 h-8 bg-white/40 blur-sm rotate-45 transform"></div>
            
            {/* Концентрические круги для эффекта рельефа монеты */}
            <div className="absolute inset-[3px] border-[0.5px] border-white/10 rounded-full"></div>
            <div className="absolute inset-[5px] border-[0.5px] border-white/5 rounded-full"></div>
            
            {/* Металлический эффект с движущимся бликом */}
            <div className="metallic-effect"></div>
            
            {/* Точечный паттерн для текстуры монеты */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-1/4 left-1/4 w-0.5 h-0.5 bg-white rounded-full"></div>
              <div className="absolute top-1/4 right-1/4 w-0.5 h-0.5 bg-white rounded-full"></div>
              <div className="absolute bottom-1/4 left-1/4 w-0.5 h-0.5 bg-white rounded-full"></div>
              <div className="absolute bottom-1/4 right-1/4 w-0.5 h-0.5 bg-white rounded-full"></div>
              <div className="absolute top-[18%] left-[40%] w-0.5 h-0.5 bg-white rounded-full"></div>
              <div className="absolute top-[45%] right-[18%] w-0.5 h-0.5 bg-white rounded-full"></div>
              <div className="absolute bottom-[18%] left-[35%] w-0.5 h-0.5 bg-white rounded-full"></div>
              <div className="absolute bottom-[45%] right-[20%] w-0.5 h-0.5 bg-white rounded-full"></div>
            </div>
            
            {/* Кольцо вокруг буквы для рельефа */}
            <div className="absolute inset-[3px] bg-gradient-to-br from-primary/50 via-purple-600/30 to-purple-800/50 rounded-full opacity-20"></div>
            
            {/* Буква U с металлическим эффектом */}
            <div className="relative z-10 flex items-center justify-center">
              <span className="relative text-white text-2xl font-extrabold bg-clip-text drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">U</span>
              {/* Блик на букве */}
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-white/70 blur-[1px] rounded-full"></div>
            </div>
            
            {/* Тонкий ободок по краю */}
            <div className="absolute inset-0 rounded-full border border-white/10"></div>
          </div>
          
          {/* Текст "UniFarm" с улучшенным стилем */}
          <div className="text-xl font-bold bg-gradient-to-r from-white via-white/90 to-white/80 bg-clip-text text-transparent drop-shadow-[0_1px_1px_rgba(0,0,0,0.2)]">
            UniFarm
          </div>
        </div>
        
        {/* Иконка кошелька справа */}
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm border border-white/10 hover:bg-white/15 transition-all duration-300">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="18" 
            height="18" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="white" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
            <path d="M4 6v12c0 1.1.9 2 2 2h14v-4" />
            <path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z" />
          </svg>
        </div>
      </div>
      
      {/* Приветствие */}
      <div className="mt-4 mb-2 relative">
        <div className="greeting-text" style={{ animationDelay: '0.1s' }}>
          <p className="text-white/90 text-sm font-light mb-1">
            Добро пожаловать,
          </p>
          <h1 className="text-2xl font-bold text-white">
            {userName}
          </h1>
        </div>
        
        {/* Индикатор подключенного кошелька */}
        {walletConnected && walletAddress && (
          <div className="mt-2 inline-flex items-center greeting-text" style={{ animationDelay: '0.3s' }}>
            <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
            <span className="text-xs text-white/70">
              Кошелек подключен
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default WelcomeSection;