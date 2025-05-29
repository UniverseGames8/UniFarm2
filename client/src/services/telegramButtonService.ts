/**
 * ЭТАП 2: Сервис для управления кнопками Telegram WebApp
 * 
 * Этот сервис отвечает за:
 * 1. Управление MainButton (показ, скрытие, текст, клики)
 * 2. Управление BackButton (показ, скрытие, навигация)
 * 3. Интеграцию с роутингом приложения
 * 4. Контекстное управление кнопками в зависимости от страницы
 */

// ЭТАП 2: Интерфейс для состояния кнопок
interface ButtonState {
  mainButton: {
    isVisible: boolean;
    text: string;
    isEnabled: boolean;
    lastAction: string | null;
  };
  backButton: {
    isVisible: boolean;
    lastAction: string | null;
  };
  isInitialized: boolean;
  lastUpdate: number;
}

// ЭТАП 2: Типы для обработчиков кнопок
type ButtonClickHandler = () => void;
type NavigationHandler = (route: string) => void;

// ЭТАП 2: Глобальное состояние кнопок
let buttonState: ButtonState = {
  mainButton: {
    isVisible: false,
    text: '',
    isEnabled: true,
    lastAction: null
  },
  backButton: {
    isVisible: false,
    lastAction: null
  },
  isInitialized: false,
  lastUpdate: 0
};

// ЭТАП 2: Обработчики для кнопок
let mainButtonHandler: ButtonClickHandler | null = null;
let backButtonHandler: ButtonClickHandler | null = null;
let navigationHandler: NavigationHandler | null = null;

/**
 * ЭТАП 2: Проверяет доступность Telegram WebApp API
 * @returns true если API доступно
 */
function isTelegramWebAppAvailable(): boolean {
  try {
    return !!(window.Telegram?.WebApp?.MainButton && window.Telegram?.WebApp?.BackButton);
  } catch (error) {
    console.warn('[TELEGRAM BUTTONS] ⚠️ Ошибка проверки API:', error);
    return false;
  }
}

/**
 * ЭТАП 2: Инициализирует систему кнопок Telegram WebApp
 * @param navHandler - Обработчик навигации для интеграции с роутингом
 * @returns true если инициализация успешна
 */
export function initializeTelegramButtons(navHandler?: NavigationHandler): boolean {
  console.log('[TELEGRAM BUTTONS] 🚀 Инициализация системы кнопок...');
  
  try {
    if (!isTelegramWebAppAvailable()) {
      console.warn('[TELEGRAM BUTTONS] ⚠️ Telegram WebApp API недоступен');
      return false;
    }
    
    // ЭТАП 2: Сохраняем обработчик навигации
    if (navHandler) {
      navigationHandler = navHandler;
      console.log('[TELEGRAM BUTTONS] ✅ Обработчик навигации установлен');
    }
    
    // ЭТАП 2: Инициализируем MainButton
    const mainButton = window.Telegram!.WebApp!.MainButton!;
    
    // Скрываем кнопку по умолчанию
    mainButton.hide();
    console.log('[MAIN BUTTON INIT] 🔘 MainButton инициализирована');
    
    // ЭТАП 2: Инициализируем BackButton
    const backButton = window.Telegram!.WebApp!.BackButton!;
    
    // Скрываем кнопку по умолчанию
    backButton.hide();
    console.log('[BACK BUTTON INIT] ⬅️ BackButton инициализирована');
    
    // ЭТАП 2: Обновляем состояние
    buttonState = {
      mainButton: {
        isVisible: false,
        text: '',
        isEnabled: true,
        lastAction: 'initialized'
      },
      backButton: {
        isVisible: false,
        lastAction: 'initialized'
      },
      isInitialized: true,
      lastUpdate: Date.now()
    };
    
    console.log('[TELEGRAM BUTTONS] 🎉 Система кнопок успешно инициализирована');
    return true;
    
  } catch (error) {
    console.error('[TELEGRAM BUTTONS] ❌ Ошибка инициализации:', error);
    return false;
  }
}

/**
 * ЭТАП 2: Показывает MainButton с заданным текстом и обработчиком
 * @param text - Текст кнопки
 * @param clickHandler - Обработчик клика
 * @param enabled - Активность кнопки (по умолчанию true)
 */
export function showMainButton(
  text: string, 
  clickHandler: ButtonClickHandler, 
  enabled: boolean = true
): boolean {
  console.log(`[TELEGRAM BUTTONS] 🔘 Показ MainButton: "${text}"`);
  
  try {
    if (!buttonState.isInitialized || !isTelegramWebAppAvailable()) {
      console.warn('[TELEGRAM BUTTONS] ⚠️ Система кнопок не инициализирована');
      return false;
    }
    
    const mainButton = window.Telegram!.WebApp!.MainButton!;
    
    // ЭТАП 2: Устанавливаем текст
    mainButton.setText(text);
    
    // ЭТАП 2: Удаляем предыдущий обработчик если есть
    if (mainButtonHandler) {
      mainButton.onClick(() => {}); // Очищаем предыдущий обработчик
    }
    
    // ЭТАП 2: Устанавливаем новый обработчик с логированием
    mainButtonHandler = () => {
      console.log(`[MAIN BUTTON CLICKED: ${text}] 🎯 Выполнение действия...`);
      buttonState.mainButton.lastAction = `clicked_${text.replace(/\s+/g, '_').toLowerCase()}`;
      buttonState.lastUpdate = Date.now();
      
      try {
        clickHandler();
        console.log(`[MAIN BUTTON CLICKED: ${text}] ✅ Действие выполнено успешно`);
      } catch (error) {
        console.error(`[MAIN BUTTON CLICKED: ${text}] ❌ Ошибка выполнения:`, error);
      }
    };
    
    mainButton.onClick(mainButtonHandler);
    
    // ЭТАП 2: Показываем кнопку
    mainButton.show();
    
    // ЭТАП 2: Обновляем состояние
    buttonState.mainButton = {
      isVisible: true,
      text,
      isEnabled: enabled,
      lastAction: `shown_${text.replace(/\s+/g, '_').toLowerCase()}`
    };
    buttonState.lastUpdate = Date.now();
    
    console.log(`[MAIN BUTTON INIT] ✅ MainButton "${text}" активна`);
    return true;
    
  } catch (error) {
    console.error('[TELEGRAM BUTTONS] ❌ Ошибка показа MainButton:', error);
    return false;
  }
}

/**
 * ЭТАП 2: Скрывает MainButton
 */
export function hideMainButton(): boolean {
  console.log('[TELEGRAM BUTTONS] 🔘 Скрытие MainButton...');
  
  try {
    if (!buttonState.isInitialized || !isTelegramWebAppAvailable()) {
      console.warn('[TELEGRAM BUTTONS] ⚠️ Система кнопок не инициализирована');
      return false;
    }
    
    const mainButton = window.Telegram!.WebApp!.MainButton!;
    mainButton.hide();
    
    // ЭТАП 2: Очищаем обработчик
    mainButtonHandler = null;
    
    // ЭТАП 2: Обновляем состояние
    buttonState.mainButton = {
      isVisible: false,
      text: '',
      isEnabled: true,
      lastAction: 'hidden'
    };
    buttonState.lastUpdate = Date.now();
    
    console.log('[MAIN BUTTON INIT] ✅ MainButton скрыта');
    return true;
    
  } catch (error) {
    console.error('[TELEGRAM BUTTONS] ❌ Ошибка скрытия MainButton:', error);
    return false;
  }
}

/**
 * ЭТАП 2: Показывает BackButton с обработчиком навигации
 * @param targetRoute - Маршрут для перехода (опционально)
 * @param customHandler - Кастомный обработчик (опционально)
 */
export function showBackButton(targetRoute?: string, customHandler?: ButtonClickHandler): boolean {
  console.log('[TELEGRAM BUTTONS] ⬅️ Показ BackButton...');
  
  try {
    if (!buttonState.isInitialized || !isTelegramWebAppAvailable()) {
      console.warn('[TELEGRAM BUTTONS] ⚠️ Система кнопок не инициализирована');
      return false;
    }
    
    const backButton = window.Telegram!.WebApp!.BackButton!;
    
    // ЭТАП 2: Устанавливаем обработчик
    backButtonHandler = () => {
      const route = targetRoute || '/';
      console.log(`[BACK BUTTON CLICKED → Navigated to ${route}] 🏠 Навигация...`);
      
      buttonState.backButton.lastAction = `clicked_to_${route.replace('/', '_')}`;
      buttonState.lastUpdate = Date.now();
      
      try {
        if (customHandler) {
          customHandler();
        } else if (navigationHandler && targetRoute) {
          navigationHandler(targetRoute);
        } else {
          // ЭТАП 2: Fallback - переход на главную страницу
          if (typeof window !== 'undefined' && window.history) {
            window.history.back();
          }
        }
        console.log(`[BACK BUTTON CLICKED → Navigated to ${route}] ✅ Навигация выполнена`);
      } catch (error) {
        console.error(`[BACK BUTTON CLICKED → Navigated to ${route}] ❌ Ошибка навигации:`, error);
      }
    };
    
    // [FIX: BACKBUTTON ISSUE #3] Исправление обработчика событий
    // Удаляем старый обработчик если есть
    if (window.Telegram?.WebApp?.BackButton?.offClick) {
      window.Telegram.WebApp.BackButton.offClick(backButtonHandler);
    }
    
    // Устанавливаем новый обработчик
    backButton.onClick(backButtonHandler);
    
    // ЭТАП 2: Показываем кнопку
    backButton.show();
    
    // ЭТАП 2: Обновляем состояние
    buttonState.backButton = {
      isVisible: true,
      lastAction: `shown_target_${(targetRoute || 'back').replace('/', '_')}`
    };
    buttonState.lastUpdate = Date.now();
    
    console.log('[BACK BUTTON SHOWN] ✅ BackButton активна');
    return true;
    
  } catch (error) {
    console.error('[TELEGRAM BUTTONS] ❌ Ошибка показа BackButton:', error);
    return false;
  }
}

/**
 * ЭТАП 2: Скрывает BackButton
 */
export function hideBackButton(): boolean {
  console.log('[TELEGRAM BUTTONS] ⬅️ Скрытие BackButton...');
  
  try {
    if (!buttonState.isInitialized || !isTelegramWebAppAvailable()) {
      console.warn('[TELEGRAM BUTTONS] ⚠️ Система кнопок не инициализирована');
      return false;
    }
    
    const backButton = window.Telegram!.WebApp!.BackButton!;
    backButton.hide();
    
    // ЭТАП 2: Очищаем обработчик
    backButtonHandler = null;
    
    // ЭТАП 2: Обновляем состояние
    buttonState.backButton = {
      isVisible: false,
      lastAction: 'hidden'
    };
    buttonState.lastUpdate = Date.now();
    
    console.log('[BACK BUTTON SHOWN] ✅ BackButton скрыта');
    return true;
    
  } catch (error) {
    console.error('[TELEGRAM BUTTONS] ❌ Ошибка скрытия BackButton:', error);
    return false;
  }
}

/**
 * ЭТАП 2: Получает текущее состояние кнопок
 */
export function getButtonState(): ButtonState {
  return { ...buttonState };
}

/**
 * ЭТАП 2: Предустановленные конфигурации для разных страниц
 */
export const ButtonConfigs = {
  // ЭТАП 2: Конфигурация для страницы фарминга (КНОПКА УДАЛЕНА)
  farming: {
    // showStartFarming - УДАЛЕНА ПО ТРЕБОВАНИЮ ПОЛЬЗОВАТЕЛЯ
    showHarvestFarming: () => showMainButton(
      "Собрать урожай", 
      () => console.log('[FARMING] 🌾 Урожай собран!'),
      true
    ),
    showBackToHome: () => showBackButton('/')
  },
  
  // ЭТАП 2: Конфигурация для страницы бустов
  boost: {
    showOpenBoost: () => showMainButton(
      "Открыть Boost", 
      () => console.log('[BOOST] 🚀 Boost активирован!'),
      true
    ),
    showBackToHome: () => showBackButton('/')
  },
  
  // ЭТАП 2: Конфигурация для главной страницы
  home: {
    hideAllButtons: () => {
      hideMainButton();
      hideBackButton();
    }
  }
};

/**
 * ЭТАП 2: Утилита для автоматической настройки кнопок по маршруту
 * @param currentRoute - Текущий маршрут приложения
 */
export function autoConfigureButtonsForRoute(currentRoute: string): void {
  console.log(`[TELEGRAM BUTTONS] 🎯 Автоконфигурация для маршрута: ${currentRoute}`);
  
  try {
    // ЭТАП 2: Скрываем все кнопки сначала
    hideMainButton();
    hideBackButton();
    
    // ЭТАП 2: Настраиваем кнопки в зависимости от маршрута
    switch (currentRoute) {
      case '/farming':
        // КНОПКА "НАЧАТЬ ФАРМИНГ" ПОЛНОСТЬЮ УДАЛЕНА - НЕ ПОКАЗЫВАЕМ НИКАКИХ КНОПОК
        console.log('[TELEGRAM BUTTONS] 🌱 Кнопки скрыты для фарминга (по требованию)');
        break;
        
      case '/boost':
        ButtonConfigs.boost.showOpenBoost();
        ButtonConfigs.boost.showBackToHome();
        console.log('[TELEGRAM BUTTONS] 🚀 Кнопки настроены для буста');
        break;
        
      case '/':
      case '/home':
        ButtonConfigs.home.hideAllButtons();
        console.log('[TELEGRAM BUTTONS] 🏠 Кнопки скрыты для главной страницы');
        break;
        
      default:
        // ЭТАП 2: Для неизвестных маршрутов показываем только BackButton
        showBackButton('/');
        console.log('[TELEGRAM BUTTONS] ❓ Кнопки настроены для неизвестного маршрута');
    }
    
  } catch (error) {
    console.error('[TELEGRAM BUTTONS] ❌ Ошибка автоконфигурации:', error);
  }
}