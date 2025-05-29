import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { BOOST_PACKAGES } from '@/lib/constants';

const BoostStatusCard: React.FC = () => {
  // Определяем количество активных бустов
  const activeBoosts = BOOST_PACKAGES.filter(boost => boost.isActive).slice(0, 4);
  const maxBoosts = 4;
  
  // Определяем типы активных бустов
  const boostTypes = activeBoosts.map(boost => boost.type);
  
  // Array of 4 boost slots, filling active ones first
  const boostSlots = [...activeBoosts, ...Array(maxBoosts - activeBoosts.length).fill(null)];
  
  // Эффект парящего элемента с разными задержками для каждого слота
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [glowingSlotsIndices, setGlowingSlotsIndices] = useState<number[]>([]);
  const [visible, setVisible] = useState<boolean>(false);
  const [, navigate] = useLocation();
  
  // Делаем плавное появление блока
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(true);
    }, 300);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Случайно выбираем слоты для анимации свечения
  useEffect(() => {
    // Сначала всегда добавляем индексы активных бустов
    const activeIndices = Array.from({ length: activeBoosts.length }, (_, i) => i);
    setGlowingSlotsIndices(activeIndices);
    
    // Каждые 6 секунд обновляем анимацию активных бустов
    const intervalId = setInterval(() => {
      setGlowingSlotsIndices([...activeIndices]);
    }, 6000);
    
    return () => clearInterval(intervalId);
  }, [activeBoosts.length]);
  
  // Обработчик нажатия и навигации
  const handleClick = (index: number) => {
    setActiveIndex(index);
    
    // Визуальный эффект перед переходом
    setTimeout(() => {
      setActiveIndex(null);
      // Чтобы эффект клика был заметен перед переходом
      setTimeout(() => navigate('/farming'), 50);
    }, 150);
  };
  
  // Возвращает цвет для конкретного буста на основе его типа
  const getBoostColor = (index: number) => {
    if (index >= activeBoosts.length) {
      return 'text-foreground'; // неактивный буст
    }
    
    const boostType = activeBoosts[index].type;
    return boostType === 'UNI' ? 'text-[#A259FF]' : 'text-[#6DBFFF]';
  };
  
  return (
    <div 
      className={`
        bg-card rounded-xl p-4 mb-5 shadow-lg card-hover-effect gradient-border
        transition-all duration-500
        ${visible ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-4'}
      `}
    >
      <div className="flex justify-between items-center">
        <h2 className="text-md font-medium">Активные Boost</h2>
        <p className="text-foreground font-medium">{activeBoosts.length} / {maxBoosts}</p>
      </div>
      <p className="text-xs text-foreground opacity-70 mt-1">Ускорители увеличивают доходность</p>
      
      <div className="mt-4 grid grid-cols-4 gap-2">
        {boostSlots.map((boost, index) => {
          const isActive = index < activeBoosts.length;
          const isGlowing = glowingSlotsIndices.includes(index);
          const isHovered = hoverIndex === index;
          const isPressed = activeIndex === index;
          
          return (
            <div 
              key={index}
              className="w-full h-full"
            >
              <div 
                onMouseEnter={() => setHoverIndex(index)}
                onMouseLeave={() => setHoverIndex(null)}
                onMouseDown={() => handleClick(index)}
                onClick={() => handleClick(index)}
                className={`
                  rounded-lg bg-muted p-2 flex items-center justify-center 
                  ${isActive ? 'opacity-100' : 'opacity-50'}
                  transition-all duration-300 cursor-pointer
                  ${isHovered ? 'transform scale-110 bg-opacity-70' : ''}
                  ${isPressed ? 'transform scale-90' : ''}
                  ${isGlowing && isActive ? (index < activeBoosts.length && activeBoosts[index].type === 'TON' ? 'glow-effect-ton' : 'glow-effect') : ''}
                  active:scale-95
                `}
                style={{
                  animationDelay: `${index * 0.2}s`,
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: isActive ? `0 0 10px ${index < activeBoosts.length && activeBoosts[index].type === 'TON' ? 'rgba(107, 191, 255, 0.3)' : 'rgba(162, 89, 255, 0.3)'}` : 'none'
                }}
              >
                <i className={`
                  fas fa-bolt text-xl
                  ${isActive ? getBoostColor(index) : 'text-foreground'}
                  ${isHovered ? 'float-animation' : ''}
                  ${isActive && !isHovered ? 'pulse-boost' : ''}
                  transition-all duration-300
                `}></i>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BoostStatusCard;