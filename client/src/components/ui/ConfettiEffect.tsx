import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface ConfettiEffectProps {
  active: boolean;
  onComplete?: () => void;
  duration?: number; // продолжительность в миллисекундах
  colors?: string[]; // цвета для конфетти
  particleCount?: number; // количество частиц
  spread?: number; // угол разброса частиц
  gravity?: number; // скорость падения
}

interface ConfettiParticle {
  x: number;
  y: number;
  size: number;
  color: string;
  rotation: number;
  speed: number;
}

const ConfettiEffect: React.FC<ConfettiEffectProps> = ({
  active,
  onComplete,
  duration = 3000,
  colors = ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
  particleCount = 100,
  spread = 70,
  gravity = 1
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<ConfettiParticle[]>([]);
  const animationFrameRef = useRef<number | null>(null);

  // Создаем конфетти частицы
  const createParticles = () => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const particles: ConfettiParticle[] = [];
    const centerX = canvas.width / 2;
    
    for (let i = 0; i < particleCount; i++) {
      // Расчет угла разброса
      const angle = (Math.random() * spread - spread / 2) * (Math.PI / 180);
      const velocity = Math.random() * 5 + 2;
      
      // Рассчитываем начальную позицию и скорость
      const x = centerX + (Math.random() * 100 - 50);
      const y = canvas.height * 0.6;
      
      particles.push({
        x: x,
        y: y, // начинаем снизу-посередине
        size: Math.random() * 10 + 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        speed: Math.random() * gravity + 0.5 // вертикальная скорость зависит от gravity
      });
    }
    
    particlesRef.current = particles;
  };
  
  // Анимируем конфетти
  const animateParticles = () => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const particles = particlesRef.current;
    let allFallen = true;
    
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      
      // Применяем гравитацию
      p.y -= p.speed; // частицы двигаются вверх и медленно замедляются
      p.speed -= gravity * 0.01; // гравитация замедляет скорость
      
      // Добавляем небольшое боковое движение для эффекта развевания
      p.x += Math.sin(p.rotation / 30) * 0.5;
      p.rotation += 2;
      
      // Рисуем частицу
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      
      // Рисуем разные формы для частиц
      ctx.fillStyle = p.color;
      const shape = i % 3; // 3 типа частиц
      
      if (shape === 0) {
        // Квадрат
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      } else if (shape === 1) {
        // Круг
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Треугольник
        ctx.beginPath();
        ctx.moveTo(0, -p.size / 2);
        ctx.lineTo(p.size / 2, p.size / 2);
        ctx.lineTo(-p.size / 2, p.size / 2);
        ctx.closePath();
        ctx.fill();
      }
      
      ctx.restore();
      
      // Проверяем, все ли частицы вышли за пределы экрана
      if (p.y > -20 && p.y < canvas.height + 20) {
        allFallen = false;
      }
    }
    
    if (allFallen) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (onComplete) onComplete();
    } else {
      animationFrameRef.current = requestAnimationFrame(animateParticles);
    }
  };
  
  useEffect(() => {
    if (!active) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Устанавливаем размеры холста
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Создаем и запускаем анимацию
    createParticles();
    animationFrameRef.current = requestAnimationFrame(animateParticles);
    
    // Ограничиваем длительность эффекта
    const timer = setTimeout(() => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (onComplete) onComplete();
    }, duration);
    
    return () => {
      clearTimeout(timer);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [active, duration, onComplete]);
  
  if (!active) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 pointer-events-none z-50"
    >
      <canvas ref={canvasRef} className="w-full h-full" />
    </motion.div>
  );
};

export default ConfettiEffect;