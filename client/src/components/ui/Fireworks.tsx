import React, { useState, useEffect } from 'react';

interface FireworksProps {
  active: boolean;
  onComplete?: () => void;
}

interface Particle {
  x: number;
  y: number;
  size: number;
  color: string;
  speedX: number;
  speedY: number;
  opacity: number;
  rotation: number;
  rotationSpeed: number;
  blur: number;
  trailLength: number;
}

interface FireworkRocket {
  x: number;
  y: number;
  targetY: number;
  speed: number;
  color: string;
  size: number;
  exploded: boolean;
}

const Fireworks: React.FC<FireworksProps> = ({ active, onComplete }) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [rockets, setRockets] = useState<FireworkRocket[]>([]);
  const [flashActive, setFlashActive] = useState<boolean>(false);
  
  // Создаем ракеты и частицы при активации
  useEffect(() => {
    if (active) {
      // Запускаем ракеты с небольшой задержкой
      setRockets([]);
      setParticles([]);
      
      // Быстрая начальная вспышка
      setFlashActive(true);
      setTimeout(() => setFlashActive(false), 200);
      
      // Запускаем несколько фейерверков в разных местах экрана
      const totalRockets = 8; // Увеличиваем количество ракет для более масштабного эффекта
      
      // Первый залп (быстрый)
      for (let i = 0; i < totalRockets; i++) {
        const delay = i * 100; // Ещё более короткая задержка между ракетами для динамичности
        
        setTimeout(() => {
          // Создаем ракету, которая быстро поднимется и взорвется
          const windowWidth = window.innerWidth;
          const windowHeight = window.innerHeight;
          
          // Распределяем ракеты по всему экрану
          const xPos = windowWidth * (0.1 + Math.random() * 0.8); // Между 10% и 90% ширины экрана
          const yStart = windowHeight + 20; // Чуть ниже видимой области
          const yTarget = windowHeight * (0.1 + Math.random() * 0.6); // Между 10% и 70% высоты
          
          // Создаем и запускаем ракету с повышенной скоростью
          const rocket: FireworkRocket = {
            x: xPos,
            y: yStart,
            targetY: yTarget,
            speed: 12 + Math.random() * 15, // Ещё быстрее движение
            color: getRandomColor(),
            size: 4 + Math.random() * 5,
            exploded: false
          };
          
          setRockets(prev => [...prev, rocket]);
        }, delay);
      }
      
      // Второй залп (с небольшой задержкой для эффекта продолжительности)
      setTimeout(() => {
        for (let i = 0; i < 4; i++) {
          const delay = i * 120; 
          
          setTimeout(() => {
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;
            
            // Позиционируем второй залп в немного других местах
            const xPos = windowWidth * (0.2 + Math.random() * 0.6); 
            const yStart = windowHeight + 20;
            const yTarget = windowHeight * (0.15 + Math.random() * 0.6);
            
            const rocket: FireworkRocket = {
              x: xPos,
              y: yStart,
              targetY: yTarget,
              speed: 14 + Math.random() * 12,
              color: getRandomColor(),
              size: 5 + Math.random() * 4,
              exploded: false
            };
            
            setRockets(prev => [...prev, rocket]);
          }, delay);
        }
      }, 450); // Небольшая задержка для второго залпа
      
      // Автоматически завершаем через 1.5 секунды
      const timer = setTimeout(() => {
        if (onComplete) {
          onComplete();
        }
      }, 1500);
      
      return () => clearTimeout(timer);
    } else {
      setRockets([]);
      setParticles([]);
    }
  }, [active, onComplete]);
  
  // Получаем случайный праздничный цвет
  const getRandomColor = () => {
    const colors = [
      '#A259FF', // Фиолетовый
      '#B145FF',
      '#8A2BE2',
      '#00E676', // Зеленый 
      '#00FF7F',
      '#40C4FF', // Голубой
      '#1E90FF',
      '#FF1493', // Розовый
      '#FF4500', // Оранжевый
      '#FFD700', // Золотой
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };
  
  // Анимируем ракеты и частицы
  useEffect(() => {
    if (!active) return;
    
    let animationFrameId: number;
    
    const animate = () => {
      // Обновляем ракеты
      setRockets(prev => {
        const updatedRockets = prev.map(rocket => {
          // Если ракета не взорвалась, движение вверх
          if (!rocket.exploded) {
            const newY = rocket.y - rocket.speed;
            
            // Проверяем на взрыв
            if (newY <= rocket.targetY) {
              // Запускаем взрыв
              createExplosion(rocket.x, newY, rocket.color);
              return { ...rocket, exploded: true };
            }
            
            return { ...rocket, y: newY };
          }
          return rocket;
        });
        
        // Удаляем взорвавшиеся ракеты
        return updatedRockets.filter(rocket => !rocket.exploded);
      });
      
      // Обновляем частицы
      setParticles(prev => 
        prev
          .map(particle => ({
            ...particle,
            x: particle.x + particle.speedX,
            y: particle.y + particle.speedY,
            speedY: particle.speedY + 0.1, // Ускоренная гравитация
            opacity: particle.opacity - 0.015, // Ускоренное затухание
            rotation: particle.rotation + particle.rotationSpeed,
            size: particle.size * 0.99, // Постепенно уменьшаем размер
          }))
          .filter(particle => particle.opacity > 0) // Удаляем исчезнувшие частицы
      );
      
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animationFrameId = requestAnimationFrame(animate);
    
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [active]);
  
  // Функция создания взрыва фейерверка
  const createExplosion = (x: number, y: number, baseColor: string) => {
    const newParticles: Particle[] = [];
    
    // Определяем случайные цвета для этого взрыва
    const colors = [
      baseColor,
      getRandomColor(),
      getRandomColor(),
      '#FFFFFF', // Белые вспышки
    ];
    
    // Выбираем тип фейерверка (случайно)
    const explosionType = Math.floor(Math.random() * 4); // 0-3 разных типов
    
    // Создаем много частиц для каждого взрыва
    const particleCount = 120 + Math.floor(Math.random() * 80);
    
    // Создаем вспышку в центре взрыва
    const flashDiv = document.createElement('div');
    flashDiv.style.position = 'absolute';
    flashDiv.style.left = `${x}px`;
    flashDiv.style.top = `${y}px`;
    flashDiv.style.width = '10px';
    flashDiv.style.height = '10px';
    flashDiv.style.borderRadius = '50%';
    flashDiv.style.backgroundColor = 'white';
    flashDiv.style.boxShadow = `0 0 30px 20px ${baseColor}`;
    flashDiv.style.transform = 'translate(-50%, -50%)';
    flashDiv.style.animation = 'flashExplosion 0.4s forwards';
    flashDiv.style.zIndex = '100';
    flashDiv.style.pointerEvents = 'none';
    document.body.appendChild(flashDiv);
    
    // Удаляем элемент после завершения анимации
    setTimeout(() => {
      document.body.removeChild(flashDiv);
    }, 400);
    
    for (let i = 0; i < particleCount; i++) {
      let angle, speed, size, color, blur, trailLength;
      
      switch(explosionType) {
        case 0: // Круговой взрыв
          angle = Math.random() * Math.PI * 2;
          speed = 2 + Math.random() * 7;
          size = 2 + Math.random() * 6;
          color = colors[Math.floor(Math.random() * colors.length)];
          blur = Math.random() > 0.7 ? 3 + Math.random() * 5 : 0;
          trailLength = Math.random() > 0.5 ? 2 + Math.random() * 5 : 0;
          break;
          
        case 1: // Кольцевой взрыв
          angle = Math.random() * Math.PI * 2;
          // Все частицы примерно одинаковой скорости
          speed = 5 + Math.random() * 3;
          size = 3 + Math.random() * 4;
          // Преимущественно одного цвета
          color = Math.random() > 0.3 ? baseColor : colors[Math.floor(Math.random() * colors.length)];
          blur = Math.random() > 0.5 ? 2 + Math.random() * 3 : 0;
          trailLength = Math.random() > 0.7 ? 3 + Math.random() * 4 : 0;
          break;
          
        case 2: // Спиральный взрыв  
          // Спираль
          const spiralTurns = 3; // Количество витков
          angle = (i / particleCount) * Math.PI * 2 * spiralTurns;
          speed = 3 + (i / particleCount) * 7; // Скорость увеличивается к внешним виткам
          size = 2 + Math.random() * 5;
          // Градиент цветов в зависимости от положения в спирали
          const colorIndex = Math.floor((i / particleCount) * colors.length);
          color = colors[colorIndex >= colors.length ? colors.length - 1 : colorIndex];
          blur = Math.random() > 0.6 ? 1 + Math.random() * 3 : 0;
          trailLength = Math.random() > 0.3 ? 4 + Math.random() * 4 : 0;
          break;
          
        case 3: // Хаотичный взрыв с большим разбросом
          angle = Math.random() * Math.PI * 2;
          speed = 1 + Math.random() * 12; // Очень разная скорость
          size = 1 + Math.random() * 8; // Разные размеры
          color = colors[Math.floor(Math.random() * colors.length)];
          blur = Math.random() > 0.5 ? 1 + Math.random() * 6 : 0;
          trailLength = Math.random() > 0.4 ? 1 + Math.random() * 7 : 0;
          break;
          
        default:
          angle = Math.random() * Math.PI * 2;
          speed = 3 + Math.random() * 5;
          size = 2 + Math.random() * 4;
          color = colors[Math.floor(Math.random() * colors.length)];
          blur = Math.random() > 0.7 ? 2 + Math.random() * 4 : 0;
          trailLength = Math.random() > 0.6 ? 2 + Math.random() * 4 : 0;
      }
      
      // Добавляем небольшую вертикальную составляющую для противодействия гравитации
      const upwardBoost = -1 - Math.random() * 2;
      
      newParticles.push({
        x,
        y,
        size,
        color,
        speedX: Math.cos(angle) * speed,
        speedY: Math.sin(angle) * speed + upwardBoost,
        opacity: 1,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 8,
        blur,
        trailLength
      });
    }
    
    setParticles(prev => [...prev, ...newParticles]);
  };
  
  if (!active) return null;
  
  return (
    <div 
      className="fixed inset-0 pointer-events-none z-50" 
      style={{ 
        perspective: '1000px',
      }}
    >
      {/* Вспышка при запуске */}
      {flashActive && (
        <div 
          className="absolute inset-0 bg-white/20" 
          style={{
            animation: 'fadeOut 0.2s forwards'
          }}
        ></div>
      )}
      
      {/* Светящийся фон */}
      <div 
        className="absolute inset-0 bg-gradient-radial from-primary/20 via-primary/10 to-transparent" 
        style={{
          animation: 'fadeOut 1.5s forwards',
          background: 'radial-gradient(circle, rgba(162, 89, 255, 0.2) 0%, rgba(0, 0, 0, 0) 70%)'
        }}
      ></div>
      
      {/* Ракеты */}
      {rockets.map((rocket, index) => (
        <div
          key={`rocket-${index}`}
          className="absolute w-1 rounded-full"
          style={{
            left: `${rocket.x}px`,
            top: `${rocket.y}px`,
            width: `${rocket.size}px`,
            height: `${rocket.size * 5}px`,
            backgroundColor: rocket.color,
            boxShadow: `0 0 ${rocket.size * 3}px ${rocket.color}`,
            filter: 'brightness(1.5)',
            transform: 'translateY(0)'
          }}
        >
          {/* Хвост ракеты */}
          <div 
            className="absolute w-full rounded-full"
            style={{
              left: 0,
              top: '100%',
              width: `${rocket.size}px`,
              height: `${rocket.size * 12}px`,
              background: `linear-gradient(to bottom, ${rocket.color}, transparent)`,
              opacity: 0.7
            }}
          ></div>
        </div>
      ))}
      
      {/* Частицы */}
      {particles.map((particle, index) => (
        <div
          key={`particle-${index}`}
          className="absolute rounded-full"
          style={{
            left: `${particle.x}px`,
            top: `${particle.y}px`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            backgroundColor: particle.color,
            opacity: particle.opacity,
            filter: `blur(${particle.blur}px) brightness(1.5)`,
            boxShadow: `0 0 ${particle.size * 2}px ${particle.color}`,
            transform: `rotate(${particle.rotation}deg) scale(${1 + (1 - particle.opacity) * 0.5})`,
            transition: 'transform 0.05s linear',
          }}
        >
          {/* След для некоторых частиц */}
          {particle.trailLength > 0 && (
            <div 
              className="absolute rounded-full"
              style={{
                width: `${particle.size * 0.8}px`,
                height: `${particle.size * particle.trailLength}px`,
                background: `linear-gradient(to bottom, ${particle.color}, transparent)`,
                top: '100%',
                left: `${particle.size * 0.1}px`,
                transform: `rotate(${180 + Math.atan2(particle.speedY, particle.speedX) * (180/Math.PI)}deg)`,
                transformOrigin: 'center top',
                opacity: particle.opacity * 0.7
              }}
            ></div>
          )}
        </div>
      ))}
    </div>
  );
};

export default Fireworks;