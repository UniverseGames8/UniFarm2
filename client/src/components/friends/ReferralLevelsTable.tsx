import React, { useState, useEffect, useRef } from 'react';
import { Coins } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import apiConfig from '@/config/apiConfig';
import logger from '@/utils/logger';
import { safeFormatAmount } from '@/utils/formatters';
import { correctApiRequest } from '@/lib/correctApiRequest';

/**
 * Таблица уровней реферальной программы
 * ЭТАП 4.2-4.3: Оптимизирован код, удалены условные проверки и лишние параметры,
 * работает стабильно как в Telegram так и в обычной среде
 */

// Интерфейс для данных уровня реферальной программы
interface ReferralLevel {
  level: string;
  friends: number;
  income: {
    uni: string;
    ton: string;
  };
  percent: string;
}

// Константа с процентами выплат по уровням
const LEVEL_PERCENTAGES = [100, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

const ReferralLevelsTable: React.FC = () => {
  // Интерфейс для ответа API
  interface ReferralsResponse {
    data: {
      user_id: number;
      username: string;
      total_referrals: number;
      referral_counts: Record<number, number>;
      level_income: Record<number, { uni: number, ton: number }>;
      referrals: any[];
    };
    success: boolean;
  }

  // Получаем информацию о текущем пользователе из API
  const { data: currentUser, isLoading: isUserLoading } = useQuery({
    queryKey: ['/api/v2/me'],
    queryFn: () => import('@/services/userService').then(module => module.default.getCurrentUser()),
    staleTime: 1000 * 5, // Кэшируем данные только на 5 секунд
    refetchOnWindowFocus: true, // Обновляем при возвращении на страницу
    retry: 2 // Пробуем несколько раз при ошибке
  });
  
  // Логика определения userId из данных пользователя
  // Если ID отсутствует, попробуем получить из guest_id
  const userId = currentUser?.id;
  const guestId = currentUser?.guest_id;
  
  // Логируем информацию о пользователе для отладки
  logger.debug('[ReferralLevelsTable] Данные пользователя для запроса рефералов:', {
    userId,
    guestId,
    hasUserId: !!userId,
    hasGuestId: !!guestId,
    hasRefCode: !!currentUser?.ref_code,
    refCode: currentUser?.ref_code || 'не определен'
  });
  
  // Формируем ключ запроса, учитывая оба возможных идентификатора
  const queryKey = userId ? ['/api/v2/referrals/stats', 'userId', userId] : ['/api/v2/referrals/stats', 'guestId', guestId];
  
  // Запрос на получение структуры рефералов с сервера
  const { data: referralsData, isLoading, error } = useQuery<ReferralsResponse>({
    queryKey,
    queryFn: async () => {
      try {
        // Проверяем наличие идентификаторов
        const hasUserId = !!userId;
        const hasGuestId = !!guestId;
        
        // Создаем безопасную структуру данных для возврата
        const safeResponse = {
          success: true,
          data: {
            user_id: userId || 0,
            username: "",
            total_referrals: 0,
            referral_counts: {},
            level_income: {},
            referrals: []
          }
        };
        
        // Если нет ни userId, ни guestId, возвращаем пустые данные
        if (!hasUserId && !hasGuestId) {
          logger.debug('[ReferralLevelsTable] Нет идентификаторов пользователя для запроса');
          return safeResponse;
        }
        
        // Определяем параметр для запроса: предпочитаем userId, но используем guestId если userId отсутствует
        const queryParam = hasUserId 
          ? `user_id=${userId}` 
          : `guest_id=${guestId}`;
        
        logger.debug(`[ReferralLevelsTable] Используем ${hasUserId ? 'user_id' : 'guest_id'} для запроса рефералов`);

        // Формируем полный URL для запроса с нужным параметром (user_id или guest_id)
        const url = apiConfig.getFullUrl(`/api/v2/referrals/stats?${queryParam}`);
        logger.debug('[ReferralLevelsTable] Запрос данных о рефералах по URL:', url);
        
        try {
          // Используем correctApiRequest для стандартизированного запроса с обработкой ошибок
          logger.debug('[ReferralLevelsTable] Использование correctApiRequest для запроса данных');
          
          // correctApiRequest автоматически устанавливает нужные заголовки и обрабатывает ошибки
          const responseData = await correctApiRequest(url, 'GET');
          
          // Проверяем базовую структуру ответа
          if (!responseData || typeof responseData !== 'object') {
            logger.warn('[ReferralLevelsTable] Неверный формат данных в ответе:', responseData);
            return safeResponse;
          }
          
          // Проверяем наличие данных в ответе
          if (!responseData.data || typeof responseData.data !== 'object') {
            logger.warn('[ReferralLevelsTable] Отсутствуют данные в ответе:', responseData);
            return safeResponse;
          }
          
          // Гарантируем, что все необходимые поля существуют
          if (!responseData.data.referrals) responseData.data.referrals = [];
          if (!responseData.data.level_income) responseData.data.level_income = {};
          if (!responseData.data.referral_counts) responseData.data.referral_counts = {};
          
          return responseData;
        } catch (fetchError) {
          // Обработка ошибок сетевого запроса
          const errorMessage = fetchError instanceof Error ? fetchError.message : 'Неизвестная ошибка';
          const isAborted = fetchError instanceof Error && fetchError.name === 'AbortError';
          
          logger.error(`[ReferralLevelsTable] Ошибка запроса: ${errorMessage} (${isAborted ? 'превышен таймаут' : 'сетевая ошибка'})`);
          return safeResponse;
        }
      } catch (error) {
        // Общая обработка всех остальных ошибок
        logger.error('[ReferralLevelsTable] Критическая ошибка запроса данных:', error);
        return {
          success: true,
          data: {
            user_id: userId || 0,
            username: "",
            total_referrals: 0,
            referral_counts: {},
            level_income: {},
            referrals: []
          }
        };
      }
    },
    // Запрос выполняется если есть userId или guestId
    enabled: (!!userId || !!guestId) && !isUserLoading,
    staleTime: 1000 * 5, // Кэшируем на 5 секунд
    refetchOnWindowFocus: true, // Обновляем при возврате фокуса
    refetchOnMount: true, // Обновляем при монтировании компонента
    retry: (failureCount, error) => {
      // Повторяем запрос не более 2 раз
      if (failureCount >= 2) return false;
      
      // Логируем причину повторного запроса
      logger.debug(`[ReferralLevelsTable] Повторный запрос #${failureCount + 1} из-за ошибки:`, error);
      return true;
    }
  });
  
  // Преобразуем данные с сервера в нужный формат для отображения
  const levels: ReferralLevel[] = React.useMemo(() => {
    // Создаем базовую структуру уровней для отображения
    const defaultLevels = Array.from({ length: 20 }, (_, i) => ({
      level: `Уровень ${i + 1}`,
      friends: 0,
      income: { uni: "0 UNI", ton: "0 TON" },
      percent: `${LEVEL_PERCENTAGES[i]}%`
    }));
    
    // Если данные еще не загружены, возвращаем пустые уровни
    if (!referralsData) {
      return defaultLevels;
    }
    
    try {
      // Проверяем структуру данных
      if (!referralsData.data || typeof referralsData.data !== 'object') {
        logger.warn('[ReferralLevelsTable] Неожиданная структура данных:', referralsData);
        return defaultLevels;
      }
      
      // Получаем количество рефералов по уровням и доходы с безопасными проверками
      const referralCounts = (referralsData.data.referral_counts && typeof referralsData.data.referral_counts === 'object') 
        ? referralsData.data.referral_counts 
        : {};
      
      const levelIncome = (referralsData.data.level_income && typeof referralsData.data.level_income === 'object') 
        ? referralsData.data.level_income 
        : {};
      
      const totalReferrals = typeof referralsData.data.total_referrals === 'number' 
        ? referralsData.data.total_referrals 
        : 0;
      
      logger.debug('[ReferralLevelsTable] API данные:', { 
        referralCounts, 
        levelIncome,
        totalReferrals
      });
      
      // Формируем массив уровней с данными из API
      return Array.from({ length: 20 }, (_, i) => {
        const levelNumber = i + 1;
        
        // Безопасно получаем значения с проверками типов
        const count = (referralCounts && typeof referralCounts === 'object' && referralCounts[levelNumber]) 
          ? Number(referralCounts[levelNumber]) || 0 
          : 0;
        
        // Безопасно получаем доходы от рефералов по уровням
        const safeIncome = (levelIncome && typeof levelIncome === 'object' && levelIncome[levelNumber]) 
          ? levelIncome[levelNumber]
          : { uni: 0, ton: 0 };
        
        const uniIncome = (safeIncome && typeof safeIncome === 'object' && 'uni' in safeIncome) 
          ? safeIncome.uni || 0 
          : 0;
          
        const tonIncome = (safeIncome && typeof safeIncome === 'object' && 'ton' in safeIncome) 
          ? safeIncome.ton || 0 
          : 0;
        
        // Форматируем числа безопасно с использованием глобальной функции
        try {
          // Используем глобальную функцию safeFormatAmount для форматирования
          // Аргументы: значение, десятичные знаки, валюта
          const formattedUniIncome = safeFormatAmount(uniIncome, 8, 'UNI').replace(' UNI', ''); 
          const formattedTonIncome = safeFormatAmount(tonIncome, 6, 'TON').replace(' TON', '');
          
          return {
            level: `Уровень ${levelNumber}`,
            friends: count,
            income: { 
              uni: `${formattedUniIncome} UNI`, 
              ton: `${formattedTonIncome} TON` 
            },
            percent: `${LEVEL_PERCENTAGES[i]}%`
          };
        } catch (formatError) {
          logger.error('[ReferralLevelsTable] Ошибка форматирования доходов:', formatError);
          // Возвращаем безопасные значения в случае ошибки форматирования
          return {
            level: `Уровень ${levelNumber}`,
            friends: count,
            income: { 
              uni: "0 UNI", 
              ton: "0 TON" 
            },
            percent: `${LEVEL_PERCENTAGES[i]}%`
          };
        }
      });
    } catch (error) {
      logger.error('[ReferralLevelsTable] Ошибка обработки данных:', error);
      // В случае ошибки возвращаем пустые уровни
      return defaultLevels;
    }
  }, [referralsData]);
  
  // Состояния для анимаций и эффектов
  const [activeRow, setActiveRow] = useState<number | null>(null);
  const [visibleRows, setVisibleRows] = useState<number[]>([]);
  
  // Ref для скролла
  const tableRef = useRef<HTMLDivElement>(null);
  
  // Функция для плавного скролла вверх/вниз
  const scrollTable = (direction: 'up' | 'down') => {
    if (tableRef.current) {
      const container = tableRef.current;
      const scrollAmount = 200; // пикселей за один скролл
      const targetScroll = direction === 'up' 
        ? container.scrollTop - scrollAmount 
        : container.scrollTop + scrollAmount;
      
      container.scrollTo({
        top: targetScroll,
        behavior: 'smooth'
      });
    }
  };
  
  // Цветовой градиент для уровней
  const getLevelColor = (index: number) => {
    // Создаем градиент от фиолетового к зеленому через 20 уровней
    if (index === 0) return 'bg-primary'; // Первый уровень - фиолетовый
    
    // Рассчитываем позицию в градиенте от 0 до 1
    const position = index / (levels.length - 1);
    
    // Преобразуем позицию в HSL цвет, где hue меняется от 280 (фиолетовый) до 140 (зеленый)
    const hue = 280 - position * 140; 
    const saturation = 80;
    const lightness = 65;
    
    return `bg-[hsl(${hue},${saturation}%,${lightness}%)]`;
  };
  
  // Обработчик для анимированного появления строк таблицы с плавным эффектом
  useEffect(() => {
    // Сбрасываем список видимых строк
    setVisibleRows([]);
    
    // Создаем эффект волны при появлении (быстрее в начале, затем медленнее)
    levels.forEach((_, index) => {
      const initialDelay = 100; // начальная задержка
      const staggerAmount = Math.min(35 + (index * 8), 70); // увеличивающаяся задержка между элементами, максимум 70мс
      
      setTimeout(() => {
        setVisibleRows(prev => [...prev, index]);
        
        // Случайно активируем некоторые строки для эффекта "живого" интерфейса
        if (index === 0 || Math.random() < 0.2) {
          setActiveRow(index);
          setTimeout(() => {
            setActiveRow(null);
          }, 800 + Math.random() * 400);
        }
      }, initialDelay + (index * staggerAmount));
    });
    
    // Устанавливаем эффект случайного мигания уровней в фоне
    const intervalId = setInterval(() => {
      // Случайно выбираем строку для подсветки
      const randomIndex = Math.floor(Math.random() * levels.length);
      setActiveRow(randomIndex);
      
      // И сбрасываем через короткое время
      setTimeout(() => {
        setActiveRow(null);
      }, 500);
    }, 5000); // Каждые 5 секунд
    
    // Очищаем интервал при размонтировании
    return () => clearInterval(intervalId);
  }, []);
  
  return (
    <div className="bg-card rounded-xl p-4 shadow-lg relative overflow-hidden">
      {/* Градиентное свечение по краям */}
      <div 
        className="absolute inset-0 rounded-xl z-0 opacity-60" 
        style={{ 
          background: 'radial-gradient(ellipse at 50% 0%, rgba(162, 89, 255, 0.15) 0%, transparent 70%), radial-gradient(ellipse at 50% 100%, rgba(162, 89, 255, 0.15) 0%, transparent 70%), radial-gradient(ellipse at 0% 50%, rgba(162, 89, 255, 0.15) 0%, transparent 70%), radial-gradient(ellipse at 100% 50%, rgba(162, 89, 255, 0.15) 0%, transparent 70%)'
        }}
      ></div>
      
      {/* Пульсирующий декоративный фоновый элемент */}
      <div 
        className="absolute -right-16 -bottom-16 w-32 h-32 bg-primary/10 rounded-full blur-xl"
        style={{ animation: 'pulse-fade 4s infinite ease-in-out' }}
      ></div>
      
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center">
          <h2 className="text-md font-medium">Уровни партнерской программы</h2>
          
          {/* Индикатор загрузки */}
          {isLoading && (
            <div className="ml-2 animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
          )}
          
          {/* Индикатор ошибки */}
          {error && (
            <div className="ml-2 text-red-500 text-xs">
              <span className="flex items-center">
                <i className="fas fa-exclamation-circle mr-1"></i>
                Ошибка загрузки
              </span>
            </div>
          )}
        </div>
        
        {/* Иконка вопроса с всплывающей подсказкой */}
        <div className="relative group">
          <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center cursor-pointer text-xs">
            <i className="fas fa-question"></i>
          </div>
          
          <div className="absolute right-0 top-6 w-64 bg-card p-3 rounded-md shadow-lg text-xs opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-30">
            <p className="mb-2">
              <span className="font-medium">Как работает доход от бустов?</span>
            </p>
            <p className="mb-1">Вы получаете процент от покупок бустов приглашенных пользователей до 20 уровней в глубину!</p>
            <p>С первого уровня – 100%, со 2-го по 20-й от 2% до 20% соответственно.</p>
          </div>
        </div>
      </div>
      
      {/* Скроллируемая таблица со всеми уровнями - показываем всегда */}
      <div 
        ref={tableRef}
        className="overflow-y-auto max-h-[350px] relative scrollbar-none pr-2 transition-all duration-300"
        style={{
          boxShadow: 'inset 0 -10px 10px -10px rgba(0,0,0,0.3), inset 0 10px 10px -10px rgba(0,0,0,0.3)',
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%)'
        }}
      >
        <table className="w-full">
          <thead className="sticky top-0 bg-card z-10">
            <tr className="border-b border-muted">
              <th className="py-2 text-left text-sm text-foreground opacity-70">Уровень</th>
              <th className="py-2 text-left text-sm text-foreground opacity-70">Друзей</th>
              <th className="py-2 text-left text-sm text-foreground opacity-70">Доход</th>
              <th className="py-2 text-right text-sm text-foreground opacity-70">Выплаты</th>
            </tr>
          </thead>
          
          <tbody>
            {levels.map((item, index) => {
              const isVisible = visibleRows.includes(index);
              const isActive = activeRow === index;
              
              return (
                <tr 
                  key={index} 
                  className={`
                    relative
                    transition-all duration-300
                    ${isVisible ? 'opacity-100' : 'opacity-0'}
                    ${isActive ? 'bg-primary/5' : 'hover:bg-primary/5'}
                    ${index % 2 === 0 ? 'bg-black/5' : ''}
                  `}
                  style={{
                    transform: isVisible ? 'translateY(0)' : 'translateY(10px)',
                    transitionDelay: `${index * 30}ms`,
                    boxShadow: isActive ? '0 0 10px rgba(162, 89, 255, 0.1)' : 'none'
                  }}
                  onMouseEnter={() => setActiveRow(index)}
                  onMouseLeave={() => setActiveRow(null)}
                >
                  <td className="py-2 text-sm px-2 border-b border-muted/20">
                    <div className="flex items-center">
                      <div className={`w-2 h-2 rounded-full mr-2 ${getLevelColor(index)}`}></div>
                      <span className="font-medium">{item.level}</span>
                    </div>
                  </td>
                  <td className="py-2 text-sm px-2 border-b border-muted/20">
                    <span className={`${item.friends > 0 ? 'text-accent font-medium' : 'text-muted-foreground'}`}>
                      {item.friends}
                    </span>
                  </td>
                  <td className="py-2 text-sm px-2 border-b border-muted/20">
                    <div className="flex flex-col">
                      <span className="text-xs">
                        <span className="text-blue-400">{item.income.ton}</span>
                      </span>
                      <span className="text-xs opacity-80">
                        <span className="text-purple-400">{item.income.uni}</span>
                      </span>
                    </div>
                  </td>
                  <td className="py-2 text-sm px-2 border-b border-muted/20 text-right">
                    <span className={`
                      px-2 py-1 rounded text-xs 
                      ${index === 0 ? 'bg-gradient-to-r from-primary to-purple-500 text-white' : 
                                     'bg-black/10 text-foreground'}
                    `}>
                      {item.percent}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Кнопки скролла и общее количество друзей */}
      <div className="flex justify-between items-center mt-4">
        <div className="text-sm text-muted-foreground">
          <span className="text-primary font-medium">
            {referralsData?.data?.total_referrals || 0}
          </span> друзей в сети
        </div>
        
        <div className="flex space-x-2">
          <button 
            className="bg-muted/50 hover:bg-muted p-1.5 rounded-full"
            onClick={() => scrollTable('up')}
          >
            <i className="fas fa-chevron-up text-xs"></i>
          </button>
          <button 
            className="bg-muted/50 hover:bg-muted p-1.5 rounded-full"
            onClick={() => scrollTable('down')}
          >
            <i className="fas fa-chevron-down text-xs"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReferralLevelsTable;