import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { correctApiRequest } from '@/lib/correctApiRequest';
import { useUser } from '@/contexts/userContext';

// Интерфейсы для данных API
interface UniFarmingInfo {
  isActive: boolean;
  depositAmount?: string;
  ratePerSecond?: string;
  depositCount?: number;
  totalDepositAmount?: string;
  totalRatePerSecond?: string;
  dailyIncomeUni?: string;
  startDate?: string | null;
  uni_farming_start_timestamp?: string | null;
}

interface TonFarmingInfo {
  totalTonRatePerSecond: string;
  totalUniRatePerSecond: string;
  dailyIncomeTon: string;
  dailyIncomeUni: string;
  deposits: Array<{
    id: number;
    user_id: number;
    ton_amount: string | number;
    uni_amount?: string | number;
    start_date: string;
    end_date?: string;
    status: string;
    created_at: string;
  }>;
}

const IncomeCardNew: React.FC = () => {
  const { userId } = useUser();
  const validUserId = userId || '1';
  
  // Анимация нарастающего счетчика
  const [displayedHourRate, setDisplayedHourRate] = useState(0);
  const [displayedDayRate, setDisplayedDayRate] = useState(0);
  const [displayedTonHourRate, setDisplayedTonHourRate] = useState(0);
  const [displayedTonDayRate, setDisplayedTonDayRate] = useState(0);
  
  // Состояния для хранения целевых значений из API
  const [targetHourRate, setTargetHourRate] = useState(0);
  const [targetDayRate, setTargetDayRate] = useState(0);
  const [targetTonHourRate, setTargetTonHourRate] = useState(0);
  const [targetTonDayRate, setTargetTonDayRate] = useState(0);
  
  // Рефы для анимации "всплеска"
  const pulseRef = useRef<boolean>(false);
  const [isPulsing, setIsPulsing] = useState(false);
  const [isTonPulsing, setIsTonPulsing] = useState(false);
  
  // Загружаем данные UNI фарминга
  const { data: uniFarmingResponse } = useQuery<{ success: boolean; data: UniFarmingInfo }>({
    queryKey: ['/api/v2/uni-farming/status', validUserId],
    refetchInterval: 15000, // Обновление каждые 15 секунд
    queryFn: async () => {
      return await correctApiRequest<{ success: boolean; data: UniFarmingInfo }>(
        `/api/v2/uni-farming/status?user_id=${validUserId}`,
        'GET'
      );
    }
  });
  
  // Загружаем данные TON фарминга
  const { data: tonFarmingResponse } = useQuery<{ success: boolean; data: TonFarmingInfo }>({
    queryKey: ['/api/v2/ton-farming/info', validUserId],
    refetchInterval: 15000, // Обновление каждые 15 секунд
    queryFn: async () => {
      return await correctApiRequest<{ success: boolean; data: TonFarmingInfo }>(
        `/api/v2/ton-farming/info?user_id=${validUserId}`,
        'GET'
      );
    }
  });
  
  // Обновляем целевые значения при получении новых данных
  useEffect(() => {
    if (uniFarmingResponse?.success && uniFarmingResponse.data) {
      const uniData = uniFarmingResponse.data;
      
      // Рассчитываем часовой доход UNI, преобразуя секундную ставку
      const ratePerSecond = parseFloat(uniData.totalRatePerSecond || '0');
      const hourlyRate = ratePerSecond * 3600; // секунд в часе
      
      // Рассчитываем дневной доход UNI
      const dailyRate = parseFloat(uniData.dailyIncomeUni || '0');
      
      // Добавляем диагностику
      console.log('[DEBUG] UNI Farming rates:', {
        ratePerSecond,
        hourlyRate,
        dailyRate,
        rawData: uniData
      });
      
      // Устанавливаем целевые значения
      setTargetHourRate(hourlyRate);
      setTargetDayRate(dailyRate);
    }
    
    if (tonFarmingResponse?.success && tonFarmingResponse.data) {
      const tonData = tonFarmingResponse.data;
      
      // Рассчитываем часовой доход TON, преобразуя секундную ставку
      const ratePerSecond = parseFloat(tonData.totalTonRatePerSecond || '0');
      const hourlyRate = ratePerSecond * 3600; // секунд в часе
      
      // Рассчитываем дневной доход TON
      const dailyRate = parseFloat(tonData.dailyIncomeTon || '0');
      
      // Добавляем диагностику
      console.log('[DEBUG] TON Farming rates:', {
        ratePerSecond,
        hourlyRate,
        dailyRate,
        rawData: tonData
      });
      
      // Устанавливаем целевые значения
      setTargetTonHourRate(hourlyRate);
      setTargetTonDayRate(dailyRate);
    }
  }, [uniFarmingResponse, tonFarmingResponse]);
  
  // Запускаем анимацию счетчика при изменении целевых значений
  useEffect(() => {
    const animationDuration = 2000; // 2 секунды
    const startTime = Date.now();
    const startUniHour = displayedHourRate;
    const startUniDay = displayedDayRate;
    const startTonHour = displayedTonHourRate;
    const startTonDay = displayedTonDayRate;
    
    const animateCounters = () => {
      const currentTime = Date.now();
      const elapsedTime = currentTime - startTime;
      const progress = Math.min(elapsedTime / animationDuration, 1);
      
      // Используем эффект замедления в конце анимации
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      
      // Обновляем значения с учетом предыдущих значений для плавной анимации
      setDisplayedHourRate(startUniHour + (targetHourRate - startUniHour) * easedProgress);
      setDisplayedDayRate(startUniDay + (targetDayRate - startUniDay) * easedProgress);
      setDisplayedTonHourRate(startTonHour + (targetTonHourRate - startTonHour) * easedProgress);
      setDisplayedTonDayRate(startTonDay + (targetTonDayRate - startTonDay) * easedProgress);
      
      if (progress < 1) {
        requestAnimationFrame(animateCounters);
      }
    };
    
    // Добавляем эффект пульсации при обновлении
    if (!pulseRef.current) {
      pulseRef.current = true;
      setIsPulsing(true);
      setIsTonPulsing(true);
      
      setTimeout(() => {
        pulseRef.current = false;
        setIsPulsing(false);
        setIsTonPulsing(false);
      }, 700);
    }
    
    requestAnimationFrame(animateCounters);
  }, [targetHourRate, targetDayRate, targetTonHourRate, targetTonDayRate]);

  return (
    <div className="bg-card rounded-xl p-4 mb-5 shadow-md border border-primary/10">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-md font-medium text-foreground/90">Прогноз дохода</h2>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-3">
        <div className="bg-background/50 rounded-lg p-3">
          <p className="text-sm text-foreground/60 mb-1">За 1 час</p>
          <div className="flex flex-col">
            <p className={`font-medium transition-transform ${isPulsing ? 'scale-105' : 'scale-100'}`}>
              <span className="text-primary/80">+{displayedHourRate.toFixed(4)}</span> 
              <span className="text-xs ml-1 opacity-70">UNI</span>
            </p>
            {displayedTonHourRate > 0 && (
              <p className={`font-medium transition-transform ${isTonPulsing ? 'scale-105' : 'scale-100'}`}>
                <span className="text-cyan-400/80">+{displayedTonHourRate.toFixed(5)}</span>
                <span className="text-xs ml-1 opacity-70">TON</span>
              </p>
            )}
          </div>
        </div>
        
        <div className="bg-background/50 rounded-lg p-3">
          <p className="text-sm text-foreground/60 mb-1">За 24 часа</p>
          <div className="flex flex-col">
            <p className={`font-medium transition-transform ${isPulsing ? 'scale-105' : 'scale-100'}`}>
              <span className="text-primary/80">+{displayedDayRate.toFixed(3)}</span>
              <span className="text-xs ml-1 opacity-70">UNI</span>
            </p>
            {displayedTonDayRate > 0 && (
              <p className={`font-medium transition-transform ${isTonPulsing ? 'scale-105' : 'scale-100'}`}>
                <span className="text-cyan-400/80">+{displayedTonDayRate.toFixed(4)}</span>
                <span className="text-xs ml-1 opacity-70">TON</span>
              </p>
            )}
          </div>
        </div>
      </div>
      
      <div className="text-xs text-foreground/40 text-center italic">
        Расчет основан на текущих ставках и активных бустах
      </div>
    </div>
  );
};

export default IncomeCardNew;