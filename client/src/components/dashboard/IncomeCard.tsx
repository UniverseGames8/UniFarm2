import React, { useState, useEffect, useRef } from 'react';

const IncomeCard: React.FC = () => {
  // Анимация нарастающего счетчика
  const [displayedHourRate, setDisplayedHourRate] = useState(0);
  const [displayedDayRate, setDisplayedDayRate] = useState(0);
  const [displayedTonHourRate, setDisplayedTonHourRate] = useState(0);
  const [displayedTonDayRate, setDisplayedTonDayRate] = useState(0);
  const targetHourRate = 0.0972; // Целевое значение UNI/час
  const targetDayRate = 2.332; // Целевое значение UNI/день
  const targetTonHourRate = 0.00083; // Целевое значение TON/час
  const targetTonDayRate = 0.0198; // Целевое значение TON/день
  
  // Рефы для анимации "всплеска"
  const pulseRef = useRef<boolean>(false);
  const [isPulsing, setIsPulsing] = useState(false);
  const [isTonPulsing, setIsTonPulsing] = useState(false);
  
  // Запускаем анимацию счетчика при первой загрузке
  useEffect(() => {
    const animationDuration = 2000; // 2 секунды
    const startTime = Date.now();
    
    const animateCounters = () => {
      const currentTime = Date.now();
      const elapsedTime = currentTime - startTime;
      const progress = Math.min(elapsedTime / animationDuration, 1);
      
      // Используем эффект замедления в конце анимации
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      
      setDisplayedHourRate(targetHourRate * easedProgress);
      setDisplayedDayRate(targetDayRate * easedProgress);
      setDisplayedTonHourRate(targetTonHourRate * easedProgress);
      setDisplayedTonDayRate(targetTonDayRate * easedProgress);
      
      if (progress < 1) {
        requestAnimationFrame(animateCounters);
      }
    };
    
    requestAnimationFrame(animateCounters);
  }, []);
  
  // Периодически добавляем эффект "всплеска" для имитации обновления значений
  useEffect(() => {
    const interval = setInterval(() => {
      if (!pulseRef.current) {
        pulseRef.current = true;
        setIsPulsing(true);
        setIsTonPulsing(true);
        
        // Через 700ms убираем эффект всплеска
        setTimeout(() => {
          pulseRef.current = false;
          setIsPulsing(false);
          setIsTonPulsing(false);
        }, 700);
      }
    }, 5000); // Каждые 5 секунд
    
    return () => clearInterval(interval);
  }, []);

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

export default IncomeCard;
