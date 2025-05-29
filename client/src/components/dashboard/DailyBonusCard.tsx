import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { invalidateQueryWithUserId } from '@/lib/queryClient';
import { apiGet, apiPost } from '@/lib/apiService';
import { useUser } from '@/contexts/userContext';

// Типы для статуса бонуса
type DailyBonusStatus = {
  canClaim: boolean;
  streak: number;
  bonusAmount: number;
}

// Типы для результата получения бонуса
type ClaimBonusResult = {
  success: boolean;
  message: string;
  amount?: number;
  streak?: number;
}

const DailyBonusCard: React.FC = () => {
  // Получаем доступ к toast для уведомлений
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userId } = useUser(); // Получаем ID пользователя из контекста
  
  // Состояние для анимаций и эффектов
  const [isButtonHovered, setIsButtonHovered] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [reward, setReward] = useState('');
  
  // Запрос на получение статуса ежедневного бонуса
  const { data: bonusStatus, isLoading, refetch } = useQuery({
    queryKey: ['dailyBonusStatus', userId], // Добавляем userId в ключ запроса
    queryFn: async () => {
      try {
        // Используем новый унифицированный метод apiGet
        const endpoint = `/api/v2/daily-bonus/status?user_id=${userId || 1}`;
        console.log('[DailyBonusCard] Запрос статуса бонуса:', endpoint);
        
        const response = await apiGet<DailyBonusStatus>(endpoint);
        
        if (!response.success) {
          throw new Error(response.error || 'Ошибка при получении статуса бонуса');
        }
        
        return response.data as DailyBonusStatus;
      } catch (error: any) {
        console.error('[ERROR] DailyBonusCard - Ошибка при получении статуса бонуса:', error);
        throw new Error(`Ошибка при получении статуса бонуса: ${error.message || 'Неизвестная ошибка'}`);
      }
    },
    retry: 1,
    refetchOnWindowFocus: false,
    enabled: !!userId // Запрос активен только если есть userId
  });
  
  // Получаем значение стрика (серии дней) из данных API или показываем 0
  const streak = bonusStatus?.streak || 0;
  
  // Мутация для получения ежедневного бонуса
  const claimBonusMutation = useMutation({
    mutationFn: async () => {
      try {
        // Используем новый унифицированный метод apiPost
        const endpoint = '/api/v2/daily-bonus/claim';
        console.log('[DailyBonusCard] Отправка запроса на получение бонуса:', endpoint);
        
        // Отправляем POST запрос с корректными заголовками
        const response = await apiPost<ClaimBonusResult>(
          endpoint, 
          { user_id: userId || 1 } // Используем динамический userId
        );
        
        if (!response.success) {
          throw new Error(response.error || response.message || 'Ошибка при получении бонуса');
        }
        
        return response;
      } catch (error: any) {
        console.error('[ERROR] DailyBonusCard - Ошибка при получении бонуса:', error);
        throw new Error(`Ошибка при получении бонуса: ${error.message || 'Неизвестная ошибка'}`);
      }
    },
    onSuccess: (data) => {
      try {
        if (data.success) {
          // Показываем анимацию с конфетти
          setShowConfetti(true);
          setReward(`${data.amount || bonusStatus?.bonusAmount || 500} UNI`);
          
          // Обновляем данные о статусе бонуса с учетом userId
          invalidateQueryWithUserId('/api/v2/daily-bonus/status');
          
          // Также обновляем данные баланса пользователя и транзакции
          invalidateQueryWithUserId('/api/v2/wallet/balance');
          invalidateQueryWithUserId('/api/v2/transactions');
          
          // Скрываем конфетти через 4 секунды
          setTimeout(() => {
            try {
              setShowConfetti(false);
              setReward('');
            } catch (error) {
              console.error('[ERROR] DailyBonusCard - Ошибка при удалении анимации:', error);
            }
          }, 4000);
          
          // Показываем уведомление
          toast({
            title: "Бонус получен!",
            description: data.message || "Ежедневный бонус успешно зачислен.",
          });
        } else {
          // Показываем уведомление об ошибке
          toast({
            title: "Ошибка",
            description: data.message || "Не удалось получить бонус.",
            variant: "destructive",
          });
        }
      } catch (error: any) {
        console.error('[ERROR] DailyBonusCard - Ошибка в onSuccess:', error);
        // Даже при ошибке пытаемся обновить данные интерфейса
        try {
          invalidateQueryWithUserId('/api/v2/daily-bonus/status');
          invalidateQueryWithUserId('/api/v2/wallet/balance');
          
          // Информируем пользователя
          toast({
            title: "Бонус зачислен, но произошла ошибка",
            description: "Бонус был зачислен, но произошла ошибка отображения. Обновите страницу.",
            variant: "default",
          });
        } catch (err) {
          console.error('[ERROR] DailyBonusCard - Критическая ошибка при восстановлении:', err);
        }
      }
    },
    onError: (error) => {
      try {
        console.error('[ERROR] DailyBonusCard - Ошибка при получении бонуса:', error);
        
        toast({
          title: "Ошибка",
          description: "Не удалось получить бонус. Попробуйте позже.",
          variant: "destructive",
        });
        
        // В любом случае обновляем данные
        invalidateQueryWithUserId('/api/v2/daily-bonus/status');
      } catch (err) {
        console.error('[ERROR] DailyBonusCard - Ошибка в обработчике onError:', err);
        // Последняя попытка показать уведомление
        try {
          toast({
            title: "Произошла ошибка",
            description: "Не удалось получить бонус. Проверьте соединение.",
            variant: "destructive",
          });
        } catch {}
      }
    },
  });
  
  // Обработка нажатия на кнопку получения бонуса
  const handleClaimBonus = () => {
    try {
      if (bonusStatus?.canClaim) {
        claimBonusMutation.mutate();
      } else {
        // Если бонус уже получен, показываем уведомление
        toast({
          title: "Бонус уже получен",
          description: "Вы уже получили бонус сегодня. Возвращайтесь завтра!",
        });
      }
    } catch (error: any) {
      console.error('[ERROR] DailyBonusCard - Ошибка при клике на кнопку получения бонуса:', error);
      
      // Информируем пользователя о проблеме
      toast({
        title: "Ошибка системы",
        description: "Произошла ошибка при получении бонуса. Попробуйте обновить страницу.",
        variant: "destructive",
      });
    }
  };
  
  // Создаем частицы-конфетти (только визуальный эффект)
  const confettiParticles = Array(20).fill(0).map((_, i) => ({
    id: i,
    size: Math.random() * 6 + 4,
    x: Math.random() * 90 + 5,
    y: -10 - Math.random() * 20,
    color: i % 3 === 0 ? '#A259FF' : (i % 3 === 1 ? '#00FF99' : '#B368F7'),
    velocity: {
      x: (Math.random() - 0.5) * 4,
      y: 5 + Math.random() * 3
    },
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 8
  }));
  
  // Анимировать индикаторы дней
  const [animateDayIndicator, setAnimateDayIndicator] = useState<number | null>(null);
  
  useEffect(() => {
    try {
      if (showConfetti) {
        // Поочередно анимируем индикаторы дней
        for (let i = 0; i < 7; i++) {
          setTimeout(() => {
            try {
              setAnimateDayIndicator(i);
              
              // Убираем анимацию через короткое время
              setTimeout(() => {
                try {
                  if (i === 6) {
                    setAnimateDayIndicator(null);
                  }
                } catch (error) {
                  console.error('[ERROR] DailyBonusCard - Ошибка при сбросе анимации индикатора:', error);
                }
              }, 300);
            } catch (error) {
              console.error('[ERROR] DailyBonusCard - Ошибка в таймере анимации индикатора:', error);
            }
          }, i * 150);
        }
      }
    } catch (error) {
      console.error('[ERROR] DailyBonusCard - Ошибка при настройке анимации:', error);
    }
  }, [showConfetti]);
  
  // Проверяем статус бонуса каждую полночь с улучшенной обработкой ошибок
  useEffect(() => {
    let timerId: number | NodeJS.Timeout;
    
    try {
      // Функция для безопасного получения миллисекунд до полуночи
      const getMsUntilMidnight = (): number => {
        try {
          const now = new Date();
          
          // Проверка, что мы получили корректный объект Date
          if (!(now instanceof Date) || isNaN(now.getTime())) {
            console.error('[ERROR] DailyBonusCard - Некорректная дата:', now);
            // Возвращаем резервное значение - обновление через 1 час (3600000 мс)
            return 3600000;
          }
          
          try {
            const midnight = new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate() + 1,
              0, 0, 0
            );
            
            // Проверка, что мы создали корректную дату полуночи
            if (!(midnight instanceof Date) || isNaN(midnight.getTime())) {
              console.error('[ERROR] DailyBonusCard - Некорректная дата полуночи:', midnight);
              // Резервное значение
              return 3600000;
            }
            
            const diff = midnight.getTime() - now.getTime();
            
            // Проверка, что разница имеет смысл
            if (diff <= 0 || diff > 86400000) { // больше 24 часов быть не должно
              console.error('[ERROR] DailyBonusCard - Некорректная разница времени:', diff);
              // Резервное значение
              return 3600000;
            }
            
            return diff;
          } catch (dateError) {
            console.error('[ERROR] DailyBonusCard - Ошибка при создании даты полуночи:', dateError);
            // Резервное значение
            return 3600000;
          }
        } catch (error) {
          console.error('[ERROR] DailyBonusCard - Глобальная ошибка в getMsUntilMidnight:', error);
          // Резервное значение при любой ошибке
          return 3600000;
        }
      };
      
      // Функция для обновления бонуса после полуночи с улучшенной обработкой ошибок
      const scheduleRefresh = () => {
        try {
          const msUntilMidnight = getMsUntilMidnight();
          console.log('[DailyBonusCard] Следующее обновление бонуса через:', msUntilMidnight, 'мс');
          
          // Устанавливаем безопасный таймаут
          try {
            timerId = setTimeout(() => {
              try {
                // Пытаемся обновить данные
                refetch().catch(err => {
                  console.error('[ERROR] DailyBonusCard - Ошибка при обновлении данных бонуса:', err);
                });
                
                // Запускаем планирование снова
                scheduleRefresh();
              } catch (refreshError) {
                console.error('[ERROR] DailyBonusCard - Ошибка в таймере обновления бонуса:', refreshError);
                
                // Пытаемся восстановиться даже при ошибке
                try {
                  scheduleRefresh();
                } catch (recoveryError) {
                  console.error('[ERROR] DailyBonusCard - Критическая ошибка при восстановлении расписания бонуса:', recoveryError);
                }
              }
            }, msUntilMidnight);
            
            return timerId;
          } catch (timeoutError) {
            console.error('[ERROR] DailyBonusCard - Ошибка при установке таймера:', timeoutError);
            return null;
          }
        } catch (scheduleError) {
          console.error('[ERROR] DailyBonusCard - Ошибка в функции scheduleRefresh:', scheduleError);
          return null;
        }
      };
      
      // Запускаем планирование
      timerId = scheduleRefresh() || setTimeout(() => {}, 0); // Фиктивный таймер если произошла ошибка
    } catch (globalError) {
      console.error('[ERROR] DailyBonusCard - Критическая ошибка в useEffect для обновления бонуса:', globalError);
      // Создаем фиктивный таймер для корректной очистки
      timerId = setTimeout(() => {}, 0);
    }
    
    // Функция очистки с защитой от ошибок
    return () => {
      try {
        if (timerId) {
          clearTimeout(timerId);
        }
      } catch (cleanupError) {
        console.error('[ERROR] DailyBonusCard - Ошибка при очистке таймера:', cleanupError);
      }
    };
  }, [refetch]);
  
  // Если данные загружаются, показываем скелетон
  if (isLoading) {
    return (
      <div className="bg-card rounded-xl p-4 mb-5 shadow-lg">
        <Skeleton className="h-6 w-1/3 mb-2" />
        <Skeleton className="h-4 w-full mb-4" />
        <div className="flex justify-between mb-4">
          {Array(7).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-8 w-8 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    );
  }
  
  return (
    <div className="bg-card rounded-xl p-4 mb-5 shadow-lg card-hover-effect relative overflow-hidden">
      {/* Фоновые декоративные элементы */}
      <div className="absolute -right-12 -top-12 w-32 h-32 bg-primary/5 rounded-full blur-xl"></div>
      <div className="absolute -left-16 -bottom-16 w-32 h-32 bg-primary/5 rounded-full blur-xl"></div>
      
      <div className="flex justify-between items-start mb-2">
        <h2 className="text-md font-medium">Check-in</h2>
        <div className="flex items-center">
          <span className="text-xs text-foreground opacity-70 mr-2">Серия: </span>
          <span className="text-sm font-medium text-primary">{streak} дн.</span>
        </div>
      </div>
      
      <p className="text-xs text-foreground opacity-70 mb-4">
        Возвращайся каждый день, чтобы собирать бонусы!
      </p>
      
      {/* Дни недели */}
      <div className="flex justify-between mb-4">
        {Array(7).fill(0).map((_, index) => {
          const isActive = index < streak;
          const isAnimating = animateDayIndicator === index;
          
          return (
            <div 
              key={index} 
              className={`
                w-8 h-8 rounded-full flex items-center justify-center text-xs
                transition-all duration-300
                ${isActive 
                  ? 'bg-primary/20 text-primary' 
                  : 'bg-muted text-foreground opacity-60'
                }
                ${isAnimating ? 'scale-125' : ''}
              `}
            >
              {index + 1}
            </div>
          );
        })}
      </div>
      
      <button 
        className={`
          w-full py-3 rounded-lg font-medium relative overflow-hidden
          ${isButtonHovered && bonusStatus?.canClaim
            ? 'shadow-lg translate-y-[-2px]' 
            : 'shadow'
          }
          transition-all duration-300
          ${!bonusStatus?.canClaim ? 'opacity-70 cursor-not-allowed' : ''}
        `}
        style={{
          background: bonusStatus?.canClaim
            ? (isButtonHovered 
                ? 'linear-gradient(90deg, #A259FF 0%, #B368F7 100%)' 
                : 'linear-gradient(45deg, #A259FF 0%, #B368F7 100%)')
            : 'linear-gradient(45deg, #666666, #888888)'
        }}
        onMouseEnter={(e) => {
          try {
            setIsButtonHovered(true);
          } catch (error) {
            console.error('[ERROR] DailyBonusCard - Ошибка при обработке onMouseEnter:', error);
          }
        }}
        onMouseLeave={(e) => {
          try {
            setIsButtonHovered(false);
          } catch (error) {
            console.error('[ERROR] DailyBonusCard - Ошибка при обработке onMouseLeave:', error);
          }
        }}
        onClick={(e) => {
          try {
            e.preventDefault();
            handleClaimBonus();
          } catch (error) {
            console.error('[ERROR] DailyBonusCard - Ошибка при обработке onClick:', error);
            // Пытаемся обработать клик даже при ошибке
            try {
              handleClaimBonus();
            } catch (secondError) {
              console.error('[ERROR] DailyBonusCard - Повторная ошибка при обработке клика:', secondError);
            }
          }
        }}
        disabled={claimBonusMutation.isPending || !bonusStatus?.canClaim}
      >
        {/* Эффект блеска на кнопке при наведении */}
        {isButtonHovered && bonusStatus?.canClaim && (
          <div 
            className="absolute inset-0 w-full h-full" 
            style={{
              background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0) 100%)',
              transform: 'translateX(-100%)',
              animation: 'shimmer 1.5s infinite'
            }}
          ></div>
        )}
        
        <span className="relative z-10 text-white">
          {claimBonusMutation.isPending 
            ? 'Загрузка...' 
            : bonusStatus?.canClaim 
              ? `Получить ${bonusStatus.bonusAmount} UNI` 
              : 'Уже получено сегодня'}
        </span>
      </button>
      
      {/* Конфетти при получении бонуса */}
      {(() => {
        try {
          // Проверка на активность конфетти
          if (!showConfetti) {
            return null;
          }
          
          return (
            <>
              {/* Сообщение о награде */}
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="text-center animate-bounce">
                  <div className="text-2xl font-bold text-primary mb-2">
                    {(() => {
                      try {
                        // Безопасно отображаем награду
                        if (!reward || reward.trim() === '') {
                          return '+UNI';
                        }
                        
                        // Проверка на формат награды, добавляем + если его нет
                        if (!reward.startsWith('+')) {
                          return `+${reward}`;
                        }
                        
                        return reward;
                      } catch (rewardError) {
                        console.error('[ERROR] DailyBonusCard - Ошибка при форматировании награды:', rewardError);
                        return '+UNI'; // Запасное значение при ошибке
                      }
                    })()}
                  </div>
                  <div className="text-sm text-white">
                    Ежедневный бонус получен!
                  </div>
                </div>
              </div>
              
              {/* Конфетти-частицы */}
              {(() => {
                try {
                  if (!Array.isArray(confettiParticles)) {
                    console.error('[ERROR] DailyBonusCard - confettiParticles не является массивом');
                    return null;
                  }
                  
                  // Только для проверки, не слишком ли много частиц
                  if (confettiParticles.length > 100) {
                    console.warn('[WARNING] DailyBonusCard - Слишком много частиц конфетти:', confettiParticles.length);
                    // Ограничиваем количество частиц, чтобы избежать проблем с производительностью
                    return confettiParticles.slice(0, 100).map((particle) => {
                      try {
                        if (!particle || typeof particle !== 'object') {
                          return null; // Пропускаем некорректные частицы
                        }
                        
                        return (
                          <div
                            key={particle.id || Math.random()}
                            className="absolute"
                            style={{
                              width: `${particle.size || 5}px`,
                              height: `${particle.size || 5}px`,
                              backgroundColor: particle.color || '#A259FF',
                              left: `${particle.x || 50}%`,
                              top: `${particle.y || 0}%`,
                              transform: `rotate(${particle.rotation || 0}deg)`,
                              borderRadius: '2px',
                              zIndex: 20,
                              animation: `fall 3s forwards`,
                              animationTimingFunction: 'ease-out',
                              animationDelay: `${(particle.id || 0) * 0.05}s`,
                            }}
                          ></div>
                        );
                      } catch (particleError) {
                        console.error('[ERROR] DailyBonusCard - Ошибка при рендеринге частицы:', particleError);
                        return null; // Пропускаем частицу при ошибке
                      }
                    });
                  }
                  
                  // Стандартный рендеринг частиц
                  return confettiParticles.map((particle) => {
                    try {
                      if (!particle || typeof particle !== 'object') {
                        return null; // Пропускаем некорректные частицы
                      }
                      
                      return (
                        <div
                          key={particle.id || Math.random()}
                          className="absolute"
                          style={{
                            width: `${particle.size || 5}px`,
                            height: `${particle.size || 5}px`,
                            backgroundColor: particle.color || '#A259FF',
                            left: `${particle.x || 50}%`,
                            top: `${particle.y || 0}%`,
                            transform: `rotate(${particle.rotation || 0}deg)`,
                            borderRadius: '2px',
                            zIndex: 20,
                            animation: `fall 3s forwards`,
                            animationTimingFunction: 'ease-out',
                            animationDelay: `${(particle.id || 0) * 0.05}s`,
                          }}
                        ></div>
                      );
                    } catch (particleError) {
                      console.error('[ERROR] DailyBonusCard - Ошибка при рендеринге частицы:', particleError);
                      return null; // Пропускаем частицу при ошибке
                    }
                  });
                } catch (confettiError) {
                  console.error('[ERROR] DailyBonusCard - Ошибка при рендеринге конфетти:', confettiError);
                  return null; // Возвращаем пустой фрагмент при ошибке
                }
              })()}
            </>
          );
        } catch (globalError) {
          console.error('[ERROR] DailyBonusCard - Критическая ошибка в рендеринге конфетти:', globalError);
          return null; // Возвращаем пустой фрагмент при ошибке
        }
      })()}
    </div>
  );
};

export default DailyBonusCard;
