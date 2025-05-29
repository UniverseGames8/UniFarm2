import React, { useEffect, useRef, useState } from 'react';

const ChartCard: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tonCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  const timeRef = useRef<number>(0);
  const dataPointsRef = useRef<number[]>([]);
  const tonDataPointsRef = useRef<number[]>([]);
  const [isDarkMode] = useState<boolean>(true);
  const [showTonChart, setShowTonChart] = useState<boolean>(true); // Флаг для отображения графика TON

  // Инициализация начальных данных графика
  useEffect(() => {
    // Создаем начальные данные для графика UNI
    const initialDataPoints: number[] = [];
    for (let i = 0; i < 100; i++) {
      initialDataPoints.push(15 + Math.random() * 10);
    }
    dataPointsRef.current = initialDataPoints;
    
    // Создаем начальные данные для графика TON
    const initialTonDataPoints: number[] = [];
    for (let i = 0; i < 100; i++) {
      initialTonDataPoints.push(5 + Math.random() * 8);
    }
    tonDataPointsRef.current = initialTonDataPoints;
    
    // Запускаем анимацию
    startAnimation();
    
    return () => {
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // Основная функция анимации
  const startAnimation = () => {
    const animate = (timestamp: number) => {
      timeRef.current += 0.05; // Скорость обновления данных
      updateDataPoints();
      drawChart();
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animationFrameRef.current = requestAnimationFrame(animate);
  };

  // Обновление данных графика для эффекта растущей линии
  const updateDataPoints = () => {
    // Обновляем данные для графика UNI
    const data = [...dataPointsRef.current];
    const lastPoint = data[data.length - 1] || 25;
    
    // Тренд роста - обеспечивает общий рост графика
    const growthTrend = 0.1;
    
    // Случайные колебания для реалистичности
    const randomVariation = (Math.random() - 0.3) * 2;
    
    // Синусоидальные колебания для плавных волн
    const sineWave = Math.sin(timeRef.current * 0.5) * 3;
    
    // Новое значение с учетом всех факторов, но с гарантией, что оно не уменьшится ниже предыдущего
    let newPoint = lastPoint + growthTrend + randomVariation + sineWave;
    
    // Гарантируем, что новая точка не будет слишком меньше предыдущей
    // Это создает ощущение постоянного роста с колебаниями
    if (newPoint < lastPoint - 5) {
      newPoint = lastPoint - 2 + Math.random();
    }
    
    // Минимальное значение для графика
    if (newPoint < 15) {
      newPoint = 15 + Math.random() * 5;
    }
    
    // Добавляем новую точку и удаляем первую для создания эффекта движения
    data.push(newPoint);
    data.shift();
    
    dataPointsRef.current = data;
    
    // Обновляем данные для графика TON
    if (showTonChart) {
      const tonData = [...tonDataPointsRef.current];
      const lastTonPoint = tonData[tonData.length - 1] || 10;
      
      // Немного другой паттерн для TON, чтобы графики отличались
      const tonGrowthTrend = 0.08;
      const tonRandomVariation = (Math.random() - 0.4) * 1.5;
      const tonSineWave = Math.sin(timeRef.current * 0.3) * 2;
      
      let newTonPoint = lastTonPoint + tonGrowthTrend + tonRandomVariation + tonSineWave;
      
      if (newTonPoint < lastTonPoint - 3) {
        newTonPoint = lastTonPoint - 1.5 + Math.random();
      }
      
      if (newTonPoint < 5) {
        newTonPoint = 5 + Math.random() * 3;
      }
      
      tonData.push(newTonPoint);
      tonData.shift();
      
      tonDataPointsRef.current = tonData;
    }
  };

  // Отрисовка графика UNI
  const drawUniChart = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    // Устанавливаем размер canvas
    canvas.width = width;
    canvas.height = height;

    // Очищаем canvas
    ctx.clearRect(0, 0, width, height);

    // Отрисовка фона
    // Насыщенный темно-фиолетовый фон
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, 'rgba(30, 20, 50, 1)'); // Темно-фиолетовый
    bgGradient.addColorStop(1, 'rgba(15, 10, 25, 1)'); // Очень темный фиолетовый
    
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Отрисовка тонкой сетки с мягким свечением
    ctx.strokeStyle = 'rgba(162, 89, 255, 0.1)';
    ctx.lineWidth = 0.5;

    // Горизонтальные линии сетки
    for (let i = 0; i < height; i += 20) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(width, i);
      ctx.stroke();
    }

    // Вертикальные линии сетки
    for (let i = 0; i < width; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
      ctx.stroke();
    }

    // Определяем максимальное и минимальное значения для масштабирования
    const maxDataPoint = Math.max(...dataPointsRef.current) * 1.2; // Дополнительное пространство сверху
    const minDataPoint = Math.min(15, Math.min(...dataPointsRef.current) * 0.8);
    const dataRange = maxDataPoint - minDataPoint;
    const scaleFactor = (height - 15) / dataRange;
    
    // Функция для преобразования значения в координату Y
    const getYCoordinate = (value: number) => {
      return height - ((value - minDataPoint) * scaleFactor);
    };
    
    // Отрисовка линии графика с градиентом и свечением
    if (dataPointsRef.current.length > 1) {
      // Создаем градиент для линии
      const lineGradient = ctx.createLinearGradient(0, 0, 0, height);
      lineGradient.addColorStop(0, '#A259FF'); // Яркий фиолетовый
      lineGradient.addColorStop(1, '#7B2CFF'); // Насыщенный фиолетовый
      
      // Сначала рисуем свечение линии
      ctx.beginPath();
      ctx.moveTo(0, getYCoordinate(dataPointsRef.current[0]));
      
      for (let i = 0; i < dataPointsRef.current.length; i++) {
        const x = (i / (dataPointsRef.current.length - 1)) * width;
        const y = getYCoordinate(dataPointsRef.current[i]);
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          // Используем квадратичные кривые для сглаживания
          const prevX = ((i - 1) / (dataPointsRef.current.length - 1)) * width;
          const prevY = getYCoordinate(dataPointsRef.current[i - 1]);
          const cpX = (prevX + x) / 2;
          ctx.quadraticCurveTo(cpX, prevY, x, y);
        }
      }
      
      // Рисуем свечение вокруг линии
      ctx.strokeStyle = 'rgba(162, 89, 255, 0.3)';
      ctx.lineWidth = 6;
      ctx.stroke();
      
      // Рисуем основную линию поверх свечения
      ctx.beginPath();
      ctx.moveTo(0, getYCoordinate(dataPointsRef.current[0]));
      
      for (let i = 0; i < dataPointsRef.current.length; i++) {
        const x = (i / (dataPointsRef.current.length - 1)) * width;
        const y = getYCoordinate(dataPointsRef.current[i]);
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          // Используем квадратичные кривые для сглаживания
          const prevX = ((i - 1) / (dataPointsRef.current.length - 1)) * width;
          const prevY = getYCoordinate(dataPointsRef.current[i - 1]);
          const cpX = (prevX + x) / 2;
          ctx.quadraticCurveTo(cpX, prevY, x, y);
        }
      }
      
      ctx.strokeStyle = lineGradient;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      
      // Добавляем градиентную заливку под линией
      const lastX = width;
      const lastY = getYCoordinate(dataPointsRef.current[dataPointsRef.current.length - 1]);
      
      ctx.lineTo(lastX, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      
      const fillGradient = ctx.createLinearGradient(0, 0, 0, height);
      fillGradient.addColorStop(0, 'rgba(162, 89, 255, 0.3)');
      fillGradient.addColorStop(0.5, 'rgba(162, 89, 255, 0.1)');
      fillGradient.addColorStop(1, 'rgba(162, 89, 255, 0)');
      
      ctx.fillStyle = fillGradient;
      ctx.fill();
      
      // Рисуем анимированные точки данных с эффектом пульсации
      const now = Date.now();
      
      // Отображаем только некоторые точки для экономии ресурсов
      for (let i = 0; i < dataPointsRef.current.length; i += 10) {
        const x = (i / (dataPointsRef.current.length - 1)) * width;
        const y = getYCoordinate(dataPointsRef.current[i]);
        
        // Пульсация для создания живого эффекта
        const pulseSize = 3 + Math.sin(now / 500 + i) * 1;
        
        // Меньшая точка внутри
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#A259FF';
        ctx.fill();
        
        // Внешнее свечение
        ctx.beginPath();
        ctx.arc(x, y, pulseSize, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(162, 89, 255, 0.3)';
        ctx.fill();
      }
      
      // Анимированное свечение последней точки
      const lastPoint = dataPointsRef.current.length - 1;
      const lastPointX = width;
      const lastPointY = getYCoordinate(dataPointsRef.current[lastPoint]);
      
      // Пульсирующее свечение последней точки
      const glowSize = 5 + Math.sin(now / 300) * 2;
      
      // Внутреннее ядро
      ctx.beginPath();
      ctx.arc(lastPointX, lastPointY, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      
      // Среднее свечение
      ctx.beginPath();
      ctx.arc(lastPointX, lastPointY, glowSize, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(162, 89, 255, 0.5)';
      ctx.fill();
      
      // Внешнее свечение
      ctx.beginPath();
      ctx.arc(lastPointX, lastPointY, glowSize * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(162, 89, 255, 0.2)';
      ctx.fill();
    }
  };

  // Отрисовка графика TON
  const drawTonChart = () => {
    const canvas = tonCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    // Устанавливаем размер canvas
    canvas.width = width;
    canvas.height = height;

    // Очищаем canvas
    ctx.clearRect(0, 0, width, height);

    // Отрисовка фона (прозрачный)
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, 0, width, height);

    // Определяем максимальное и минимальное значения для масштабирования
    const maxDataPoint = Math.max(...tonDataPointsRef.current) * 1.2;
    const minDataPoint = Math.min(5, Math.min(...tonDataPointsRef.current) * 0.8);
    const dataRange = maxDataPoint - minDataPoint;
    const scaleFactor = (height - 15) / dataRange;
    
    // Функция для преобразования значения в координату Y
    const getYCoordinate = (value: number) => {
      return height - ((value - minDataPoint) * scaleFactor);
    };
    
    // Отрисовка линии графика с градиентом и свечением
    if (tonDataPointsRef.current.length > 1) {
      // Создаем градиент для линии TON
      const lineGradient = ctx.createLinearGradient(0, 0, 0, height);
      lineGradient.addColorStop(0, '#6DBFFF'); // Голубой
      lineGradient.addColorStop(1, '#4A9BFF'); // Более темный голубой
      
      // Сначала рисуем свечение линии
      ctx.beginPath();
      ctx.moveTo(0, getYCoordinate(tonDataPointsRef.current[0]));
      
      for (let i = 0; i < tonDataPointsRef.current.length; i++) {
        const x = (i / (tonDataPointsRef.current.length - 1)) * width;
        const y = getYCoordinate(tonDataPointsRef.current[i]);
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          // Используем квадратичные кривые для сглаживания
          const prevX = ((i - 1) / (tonDataPointsRef.current.length - 1)) * width;
          const prevY = getYCoordinate(tonDataPointsRef.current[i - 1]);
          const cpX = (prevX + x) / 2;
          ctx.quadraticCurveTo(cpX, prevY, x, y);
        }
      }
      
      // Рисуем свечение вокруг линии
      ctx.strokeStyle = 'rgba(107, 191, 255, 0.3)';
      ctx.lineWidth = 6;
      ctx.stroke();
      
      // Рисуем основную линию поверх свечения
      ctx.beginPath();
      ctx.moveTo(0, getYCoordinate(tonDataPointsRef.current[0]));
      
      for (let i = 0; i < tonDataPointsRef.current.length; i++) {
        const x = (i / (tonDataPointsRef.current.length - 1)) * width;
        const y = getYCoordinate(tonDataPointsRef.current[i]);
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          // Используем квадратичные кривые для сглаживания
          const prevX = ((i - 1) / (tonDataPointsRef.current.length - 1)) * width;
          const prevY = getYCoordinate(tonDataPointsRef.current[i - 1]);
          const cpX = (prevX + x) / 2;
          ctx.quadraticCurveTo(cpX, prevY, x, y);
        }
      }
      
      ctx.strokeStyle = lineGradient;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      
      // Добавляем градиентную заливку под линией
      const lastX = width;
      const lastY = getYCoordinate(tonDataPointsRef.current[tonDataPointsRef.current.length - 1]);
      
      ctx.lineTo(lastX, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      
      const fillGradient = ctx.createLinearGradient(0, 0, 0, height);
      fillGradient.addColorStop(0, 'rgba(107, 191, 255, 0.3)');
      fillGradient.addColorStop(0.5, 'rgba(107, 191, 255, 0.1)');
      fillGradient.addColorStop(1, 'rgba(107, 191, 255, 0)');
      
      ctx.fillStyle = fillGradient;
      ctx.fill();
      
      // Рисуем анимированные точки данных с эффектом пульсации
      const now = Date.now();
      
      // Отображаем только некоторые точки для экономии ресурсов
      for (let i = 0; i < tonDataPointsRef.current.length; i += 10) {
        const x = (i / (tonDataPointsRef.current.length - 1)) * width;
        const y = getYCoordinate(tonDataPointsRef.current[i]);
        
        // Пульсация для создания живого эффекта
        const pulseSize = 3 + Math.sin(now / 500 + i) * 1;
        
        // Меньшая точка внутри
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#6DBFFF';
        ctx.fill();
        
        // Внешнее свечение
        ctx.beginPath();
        ctx.arc(x, y, pulseSize, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(107, 191, 255, 0.3)';
        ctx.fill();
      }
      
      // Анимированное свечение последней точки
      const lastPoint = tonDataPointsRef.current.length - 1;
      const lastPointX = width;
      const lastPointY = getYCoordinate(tonDataPointsRef.current[lastPoint]);
      
      // Пульсирующее свечение последней точки
      const glowSize = 5 + Math.sin(now / 300) * 2;
      
      // Внутреннее ядро
      ctx.beginPath();
      ctx.arc(lastPointX, lastPointY, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      
      // Среднее свечение
      ctx.beginPath();
      ctx.arc(lastPointX, lastPointY, glowSize, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(107, 191, 255, 0.5)';
      ctx.fill();
      
      // Внешнее свечение
      ctx.beginPath();
      ctx.arc(lastPointX, lastPointY, glowSize * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(107, 191, 255, 0.2)';
      ctx.fill();
    }
  };

  // Отрисовка графиков
  const drawChart = () => {
    // Отрисовка графика UNI
    drawUniChart();
    
    // Отрисовка графика TON
    if (showTonChart) {
      drawTonChart();
    }
  };

  // Обработка изменения размера окна
  useEffect(() => {
    const handleResize = () => {
      drawChart();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="bg-card rounded-xl p-4 mb-5 shadow-lg overflow-hidden relative">
      {/* Дополнительный фоновый слой */}
      <div 
        className="absolute inset-0 opacity-30 z-0" 
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(162, 89, 255, 0.2) 0%, transparent 70%)'
        }}
      ></div>
      
      <h2 className="text-md font-medium mb-3 relative z-10">Доход за день (UNI + TON)</h2>
      
      <div className="flex items-center justify-end mb-2 space-x-4">
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-[#A259FF] mr-1"></div>
          <span className="text-xs text-foreground/70">UNI</span>
        </div>
        
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-[#6DBFFF] mr-1"></div>
          <span className="text-xs text-foreground/70">TON</span>
        </div>
      </div>
      
      <div className="relative h-[120px] mb-2">
        <canvas ref={canvasRef} className="w-full h-full"></canvas>
      </div>
      
      {showTonChart && (
        <div className="relative h-[120px]">
          <canvas ref={tonCanvasRef} className="w-full h-full"></canvas>
        </div>
      )}
    </div>
  );
};

export default ChartCard;