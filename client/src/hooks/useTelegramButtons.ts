/**
 * ЭТАП 2: React хук для управления кнопками Telegram WebApp
 * 
 * Этот хук обеспечивает:
 * 1. Автоматическое управление кнопками в зависимости от маршрута
 * 2. Интеграцию с роутингом wouter
 * 3. Простой API для показа/скрытия кнопок
 * 4. Обработку навигации
 */

import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { 
  autoConfigureButtonsForRoute,
  showMainButton,
  hideMainButton,
  showBackButton,
  hideBackButton,
  getButtonState,
  ButtonConfigs
} from '../services/telegramButtonService';

// ЭТАП 2: Тип для обработчика кнопки
type ButtonClickHandler = () => void;

/**
 * ЭТАП 2: Основной хук для управления кнопками Telegram WebApp
 */
export function useTelegramButtons() {
  const [location, setLocation] = useLocation();

  // ЭТАП 2: Автоматическая настройка кнопок при изменении маршрута
  useEffect(() => {
    console.log(`[TELEGRAM BUTTONS HOOK] 🎯 Маршрут изменился: ${location}`);
    
    // ЭТАП 2: Настраиваем кнопки с обработчиком навигации
    autoConfigureButtonsForRoute(location);
    
  }, [location]);

  // ЭТАП 2: Возвращаем API для ручного управления кнопками
  return {
    // Текущее местоположение
    currentRoute: location,
    
    // Навигация
    navigate: setLocation,
    
    // API для MainButton
    showMainButton: (text: string, handler: ButtonClickHandler) => {
      console.log(`[TELEGRAM BUTTONS HOOK] 🔘 Показ MainButton: "${text}"`);
      return showMainButton(text, handler);
    },
    
    hideMainButton: () => {
      console.log('[TELEGRAM BUTTONS HOOK] 🔘 Скрытие MainButton');
      return hideMainButton();
    },
    
    // API для BackButton  
    showBackButton: (targetRoute?: string, customHandler?: ButtonClickHandler) => {
      console.log('[TELEGRAM BUTTONS HOOK] ⬅️ Показ BackButton');
      const navigationHandler = (route: string) => {
        console.log(`[TELEGRAM BUTTONS HOOK] 🏠 Навигация: ${route}`);
        setLocation(route);
      };
      return showBackButton(targetRoute, customHandler || (() => navigationHandler(targetRoute || '/')));
    },
    
    hideBackButton: () => {
      console.log('[TELEGRAM BUTTONS HOOK] ⬅️ Скрытие BackButton');
      return hideBackButton();
    },
    
    // Состояние кнопок
    getState: getButtonState,
    
    // Предустановленные конфигурации
    configs: ButtonConfigs
  };
}

/**
 * ЭТАП 2: Хук для конкретной страницы фарминга
 */
export function useFarmingButtons() {
  const buttons = useTelegramButtons();
  
  return {
    ...buttons,
    
    // ЭТАП 2: Специфичные методы для фарминга
    showStartFarming: (onStart: ButtonClickHandler) => {
      console.log('[FARMING BUTTONS] 🌱 Настройка кнопки начала фарминга');
      return buttons.showMainButton("Начать фарминг", () => {
        console.log('[FARMING BUTTONS] 🌱 Фарминг запущен через хук');
        onStart();
      });
    },
    
    showHarvestFarming: (onHarvest: ButtonClickHandler) => {
      console.log('[FARMING BUTTONS] 🌾 Настройка кнопки сбора урожая');
      return buttons.showMainButton("Собрать урожай", () => {
        console.log('[FARMING BUTTONS] 🌾 Урожай собран через хук');
        onHarvest();
      });
    },
    
    showBackToHome: () => {
      console.log('[FARMING BUTTONS] 🏠 Настройка возврата на главную');
      return buttons.showBackButton('/', () => {
        console.log('[FARMING BUTTONS] 🏠 Возврат на главную из фарминга');
        buttons.navigate('/');
      });
    }
  };
}

/**
 * ЭТАП 2: Хук для конкретной страницы бустов
 */
export function useBoostButtons() {
  const buttons = useTelegramButtons();
  
  return {
    ...buttons,
    
    // ЭТАП 2: Специфичные методы для бустов
    showOpenBoost: (onBoost: ButtonClickHandler) => {
      console.log('[BOOST BUTTONS] 🚀 Настройка кнопки открытия буста');
      return buttons.showMainButton("Открыть Boost", () => {
        console.log('[BOOST BUTTONS] 🚀 Boost активирован через хук');
        onBoost();
      });
    },
    
    showPurchaseBoost: (onPurchase: ButtonClickHandler) => {
      console.log('[BOOST BUTTONS] 💎 Настройка кнопки покупки буста');
      return buttons.showMainButton("Купить Boost", () => {
        console.log('[BOOST BUTTONS] 💎 Boost куплен через хук');
        onPurchase();
      });
    },
    
    showBackToHome: () => {
      console.log('[BOOST BUTTONS] 🏠 Настройка возврата на главную');
      return buttons.showBackButton('/', () => {
        console.log('[BOOST BUTTONS] 🏠 Возврат на главную из бустов');
        buttons.navigate('/');
      });
    }
  };
}

/**
 * ЭТАП 2: Хук для отключения всех кнопок (главная страница)
 */
export function useHomeButtons() {
  const buttons = useTelegramButtons();
  
  useEffect(() => {
    // ЭТАП 2: Автоматически скрываем все кнопки на главной странице
    console.log('[HOME BUTTONS] 🏠 Скрытие всех кнопок на главной');
    buttons.hideMainButton();
    buttons.hideBackButton();
  }, []);
  
  return {
    ...buttons,
    
    // ЭТАП 2: Методы для временного показа кнопок на главной
    showTemporaryAction: (text: string, handler: ButtonClickHandler) => {
      console.log(`[HOME BUTTONS] ⚡ Временная кнопка: "${text}"`);
      return buttons.showMainButton(text, handler);
    }
  };
}