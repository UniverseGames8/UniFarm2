import React, { useState, useEffect, useRef } from 'react';
import { BOOST_PACKAGES } from '@/lib/constants';

const BoostOptions: React.FC = () => {
  // Состояния для анимаций и эффектов
  const [hoveredPackId, setHoveredPackId] = useState<number | null>(null);
  const [showTooltip, setShowTooltip] = useState<boolean>(false);
  const [currentYield, setCurrentYield] = useState<string>("0.00000");
  const [animateYield, setAnimateYield] = useState<boolean>(false);
  
  // Ref для хранения интервала анимации
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Функция для отображения tooltip с описанием boost
  const toggleTooltip = () => {
    setShowTooltip(!showTooltip);
  };
  
  // Функция имитации обновления дохода в реальном времени
  useEffect(() => {
    // Стартовое значение
    let yieldValue = 0.00000;
    
    // Запускаем интервал с обновлением каждые 2 секунды
    intervalRef.current = setInterval(() => {
      // Увеличиваем значение на случайную величину
      yieldValue += Math.random() * 0.00002 + 0.00001;
      
      // Форматируем число с 5 знаками после запятой
      const formattedValue = yieldValue.toFixed(5);
      
      // Обновляем состояние
      setCurrentYield(formattedValue);
      
      // Запускаем анимацию
      setAnimateYield(true);
      setTimeout(() => setAnimateYield(false), 500);
      
    }, 2000);
    
    // Очищаем интервал при размонтировании компонента
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
  
  return (
    <div className="mb-6">
      {/* Основной UNI пакет (бесплатный) */}
      <div className="mb-5">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold text-white flex items-center">
            <i className="fas fa-seedling text-green-400 mr-2"></i>
            Основной UNI пакет
          </h2>
        </div>
        
        <div 
          className={`
            bg-card rounded-xl p-4 mb-3
            transition-all duration-500 relative overflow-hidden
            border border-purple-300/10
            shadow-md hover:shadow-lg hover:shadow-primary/10
          `}
          style={{
            transition: 'transform 0.3s ease, box-shadow 0.3s ease',
            background: 'linear-gradient(135deg, rgba(25, 25, 30, 1) 0%, rgba(30, 25, 35, 1) 100%)'
          }}
        >
          {/* Фоновый эффект свечения */}
          <div 
            className="absolute inset-0 opacity-50 z-0 rounded-xl"
            style={{
              background: 'radial-gradient(ellipse at 30% 20%, rgba(162, 89, 255, 0.07) 0%, transparent 70%), radial-gradient(ellipse at 70% 80%, rgba(72, 205, 115, 0.07) 0%, transparent 70%)',
              opacity: '0.6',
              transition: 'opacity 0.5s ease'
            }}
          ></div>
          
          <div className="grid grid-cols-2 gap-4 relative z-10">
            <div>
              {/* UNI Yield */}
              <div className="mb-2">
                <div className="text-xs font-bold text-primary mb-1">UNI Yield:</div>
                <div className="font-bold text-green-400 flex items-center text-lg">
                  <i className="fas fa-chart-line mr-1 text-sm"></i>
                  0.5% Daily
                </div>
              </div>
              
              {/* Счетчик текущего дохода */}
              <div className="mt-2 mb-2 flex items-center">
                <div 
                  className={`
                    text-green-400 font-medium flex items-center
                    transition-all duration-300
                    ${animateYield ? 'scale-110' : 'scale-100'}
                  `}
                >
                  <i className="fas fa-plus text-[10px] mr-1"></i>
                  <span className="mr-1">{currentYield}</span>
                  <span className="text-xs">UNI</span>
                </div>
              </div>
              
              <p className="text-xs text-gray-500 italic mt-1">
                Доход начисляется каждую секунду
              </p>
            </div>
            
            <div className="flex items-center justify-end">
              <button 
                className={`
                  relative z-10 transition-all duration-300
                  overflow-hidden px-6 py-2.5 rounded-lg font-medium
                  flex items-center justify-center
                  bg-transparent border border-primary text-primary hover:bg-primary/10
                  shadow-md shadow-primary/10
                `}
              >
                {/* Эффект свечения кнопки */}
                <div 
                  className="absolute inset-0 w-full h-full overflow-hidden" 
                  style={{
                    background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0) 100%)',
                    transform: 'translateX(-100%)',
                    animation: 'shimmer 3s infinite'
                  }}
                ></div>
                
                <span className="relative z-10">Фармить</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Заголовок Boost-пакетов */}
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold text-white flex items-center">
          <i className="fas fa-rocket text-primary mr-2"></i>
          Airdrop Boost Пакеты
        </h2>
        
        {/* Иконка вопроса с всплывающей подсказкой */}
        <div className="relative">
          <div 
            className="w-5 h-5 rounded-full bg-muted flex items-center justify-center cursor-pointer text-xs"
            onMouseEnter={toggleTooltip}
            onMouseLeave={toggleTooltip}
          >
            <i className="fas fa-question"></i>
          </div>
          
          {showTooltip && (
            <div className="absolute right-0 top-6 w-64 bg-card p-3 rounded-md shadow-lg text-xs z-20">
              <p className="mb-2">
                <span className="font-medium">Что такое Boost?</span>
              </p>
              <p className="mb-1">Boost - это ускоритель фарминга UNI и TON токенов для участия в Airdrop.</p>
              <p className="mb-1">
                <span className="inline-flex items-center font-medium">
                  <i className="fas fa-bolt text-primary mr-1"></i> Доходность
                </span> 
                - это ежедневный процент от начисления токенов UNI и TON.
              </p>
            </div>
          )}
        </div>
      </div>
      
      {BOOST_PACKAGES.map((pack) => {
        const isHovered = hoveredPackId === pack.id;
        
        return (
          <div 
            key={pack.id}
            className={`
              bg-card rounded-xl p-4 mb-3
              transition-all duration-500 relative overflow-hidden
              border border-purple-900/30
              shadow-md hover:shadow-lg hover:shadow-primary/10
            `}
            onMouseEnter={() => setHoveredPackId(pack.id)}
            onMouseLeave={() => setHoveredPackId(null)}
            style={{
              transition: 'transform 0.3s ease, box-shadow 0.3s ease',
              background: 'linear-gradient(135deg, rgba(20, 20, 25, 1) 0%, rgba(25, 20, 30, 1) 100%)'
            }}
          >
            {/* Фоновый эффект свечения по краям */}
            <div 
              className="absolute inset-0 opacity-50 z-0 rounded-xl"
              style={{
                background: 'radial-gradient(ellipse at 30% 20%, rgba(162, 89, 255, 0.1) 0%, transparent 70%), radial-gradient(ellipse at 70% 80%, rgba(162, 89, 255, 0.05) 0%, transparent 70%)',
                opacity: isHovered ? '0.7' : '0.4',
                transition: 'opacity 0.5s ease'
              }}
            ></div>
            
            {/* Верхняя часть карточки */}
            <div className="mb-4 relative z-10">
              <h3 className={`
                text-md font-medium flex items-center
                transition-all duration-300 text-purple-300
                ${isHovered ? 'text-purple-200' : ''}
              `}>
                <i className="fas fa-bolt text-primary mr-2"></i>
                {pack.type === "TON" ? "TON Boost" : pack.name}
              </h3>
            </div>
            
            {/* Основная информация о пакете */}
            <div className="grid grid-cols-2 gap-4 mb-4 relative z-10">
              <div className="flex flex-col justify-between">
                {/* UNI Yield */}
                <div className="mb-3">
                  <div className="text-xs text-gray-400 mb-1">UNI Yield:</div>
                  <div className="font-medium text-green-400 flex items-center">
                    <i className="fas fa-chart-line mr-1 text-xs"></i>
                    {pack.uniYield}
                  </div>
                </div>
                
                {/* TON Yield */}
                <div>
                  <div className="text-xs text-gray-400 mb-1">TON Yield:</div>
                  <div className="font-medium text-cyan-400 flex items-center">
                    <i className="fas fa-chart-line mr-1 text-xs"></i>
                    {pack.tonYield}
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col justify-between">
                {/* Bonus */}
                <div className="mb-3">
                  <div className="text-xs text-gray-400 mb-1">Bonus:</div>
                  <div className="font-medium text-green-400 flex items-center">
                    <i className="fas fa-gift mr-1 text-amber-400 text-xs"></i>
                    {pack.bonus}
                  </div>
                </div>
                
                {/* Price */}
                <div>
                  <div className="text-xs text-gray-400 mb-1">Стоимость:</div>
                  <div className="font-medium text-cyan-400">
                    {pack.id === 1 ? "0.5 TON" : 
                      pack.type === "TON" ? (
                        pack.price.includes("+") ? 
                        pack.price.split("+")[1].trim() : 
                        pack.price
                      ) : pack.price}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Кнопка покупки */}
            <button 
              className={`
                relative z-10 transition-all duration-300
                overflow-hidden w-full py-2.5 rounded-lg font-medium
                flex items-center justify-center
                bg-primary hover:bg-purple-600 text-white
                ${isHovered ? 'shadow-lg shadow-primary/30' : 'shadow-md shadow-primary/20'}
              `}
              onClick={(e) => {
                // Здесь будет логика покупки пакета в реальном приложении
              }}
            >
              {/* Иконка молнии */}
              <i className="fas fa-bolt mr-2"></i>
              
              {/* Эффект свечения кнопки */}
              <div 
                className="absolute inset-0 w-full h-full overflow-hidden" 
                style={{
                  background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0) 100%)',
                  transform: 'translateX(-100%)',
                  animation: 'shimmer 2s infinite'
                }}
              ></div>
              
              <span className="relative z-10">Buy Boost</span>
            </button>
          </div>
        );
      })}
      
      <p className="text-xs text-foreground opacity-70 italic text-center mt-2">
        Участие в Airdrop программе доступно всем пользователям с активным Boost
      </p>
    </div>
  );
};

export default BoostOptions;
