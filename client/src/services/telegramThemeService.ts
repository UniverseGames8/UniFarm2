/**
 * ЭТАП 1: Сервис для управления темой Telegram WebApp
 * 
 * Этот сервис отвечает за:
 * 1. Интеграцию с Telegram.WebApp.themeParams
 * 2. Динамическое обновление CSS переменных
 * 3. Обработку событий смены темы
 * 4. Поддержку светлой и темной темы
 */

// ЭТАП 1: Интерфейс для параметров темы Telegram
interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
}

// ЭТАП 1: Состояние темы
interface ThemeState {
  isDark: boolean;
  colorScheme: 'light' | 'dark';
  isInitialized: boolean;
  lastUpdate: number;
}

// ЭТАП 1: Глобальное состояние темы
let themeState: ThemeState = {
  isDark: false,
  colorScheme: 'light',
  isInitialized: false,
  lastUpdate: 0
};

/**
 * ЭТАП 1: Преобразует цвет Telegram в HSL формат для Tailwind
 * @param color - Цвет в формате #RRGGBB
 * @returns HSL строка без 'hsl()' обертки
 */
function convertToHSL(color: string): string {
  // Убираем # если есть
  const hex = color.replace('#', '');
  
  // Конвертируем в RGB
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;
  
  // Находим min/max для HSL расчета
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h: number, s: number, l: number;
  
  l = (max + min) / 2;
  
  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
      default: h = 0;
    }
    
    h /= 6;
  }
  
  // Конвертируем в проценты/градусы
  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);
  
  return `${h} ${s}% ${l}%`;
}

/**
 * ЭТАП 1: Применяет параметры темы Telegram к CSS переменным
 * @param themeParams - Параметры темы от Telegram
 */
function applyTelegramTheme(themeParams: TelegramThemeParams): void {
  console.log('[TELEGRAM THEME] 🎨 Применение параметров темы:', themeParams);
  
  const root = document.documentElement;
  
  try {
    // ЭТАП 1: Основные цвета
    if (themeParams.bg_color) {
      const bgHSL = convertToHSL(themeParams.bg_color);
      root.style.setProperty('--background', bgHSL);
      root.style.setProperty('--card', bgHSL);
      console.log('[TELEGRAM THEME] ✅ Фон установлен:', bgHSL);
    }
    
    if (themeParams.text_color) {
      const textHSL = convertToHSL(themeParams.text_color);
      root.style.setProperty('--foreground', textHSL);
      root.style.setProperty('--card-foreground', textHSL);
      console.log('[TELEGRAM THEME] ✅ Цвет текста установлен:', textHSL);
    }
    
    if (themeParams.secondary_bg_color) {
      const secondaryHSL = convertToHSL(themeParams.secondary_bg_color);
      root.style.setProperty('--muted', secondaryHSL);
      root.style.setProperty('--popover', secondaryHSL);
      console.log('[TELEGRAM THEME] ✅ Вторичный фон установлен:', secondaryHSL);
    }
    
    if (themeParams.button_color) {
      const buttonHSL = convertToHSL(themeParams.button_color);
      root.style.setProperty('--primary', buttonHSL);
      console.log('[TELEGRAM THEME] ✅ Цвет кнопок установлен:', buttonHSL);
    }
    
    if (themeParams.button_text_color) {
      const buttonTextHSL = convertToHSL(themeParams.button_text_color);
      root.style.setProperty('--primary-foreground', buttonTextHSL);
      console.log('[TELEGRAM THEME] ✅ Цвет текста кнопок установлен:', buttonTextHSL);
    }
    
    if (themeParams.link_color) {
      const linkHSL = convertToHSL(themeParams.link_color);
      root.style.setProperty('--accent', linkHSL);
      console.log('[TELEGRAM THEME] ✅ Цвет ссылок установлен:', linkHSL);
    }
    
    if (themeParams.hint_color) {
      const hintHSL = convertToHSL(themeParams.hint_color);
      root.style.setProperty('--muted-foreground', hintHSL);
      console.log('[TELEGRAM THEME] ✅ Цвет подсказок установлен:', hintHSL);
    }
    
    console.log('[TELEGRAM THEME] 🎉 Тема успешно применена');
    
  } catch (error) {
    console.error('[TELEGRAM THEME] ❌ Ошибка при применении темы:', error);
  }
}

/**
 * ЭТАП 1: Определяет тип темы (светлая/темная) на основе фона
 * @param bgColor - Цвет фона в формате #RRGGBB
 * @returns true если темная тема
 */
function isDarkTheme(bgColor: string): boolean {
  const hex = bgColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Рассчитываем яркость по формуле luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  return luminance < 0.5;
}

/**
 * ЭТАП 1: Инициализирует тему из Telegram WebApp
 */
export function initializeTelegramTheme(): boolean {
  console.log('[TELEGRAM THEME] 🚀 Инициализация темы...');
  
  try {
    // ЭТАП 1: Проверяем доступность Telegram WebApp
    if (!window.Telegram?.WebApp) {
      console.warn('[TELEGRAM THEME] ⚠️ Telegram WebApp недоступен');
      return false;
    }
    
    const webApp = window.Telegram.WebApp;
    
    // ЭТАП 1: Получаем параметры темы
    const themeParams = webApp.themeParams;
    const colorScheme = webApp.colorScheme;
    
    console.log('[TELEGRAM THEME] 📊 Данные темы:', {
      themeParams,
      colorScheme,
      hasThemeParams: !!themeParams
    });
    
    // ЭТАП 1: Определяем тип темы
    let isDark = false;
    if (colorScheme) {
      isDark = colorScheme === 'dark';
    } else if (themeParams?.bg_color) {
      isDark = isDarkTheme(themeParams.bg_color);
    }
    
    // ЭТАП 1: Обновляем состояние
    themeState = {
      isDark,
      colorScheme: isDark ? 'dark' : 'light',
      isInitialized: true,
      lastUpdate: Date.now()
    };
    
    // ЭТАП 1: Логируем тип темы
    console.log(`[THEME INIT: ${isDark ? 'DARK' : 'LIGHT'}]`);
    
    // ЭТАП 1: Применяем тему если есть параметры
    if (themeParams && Object.keys(themeParams).length > 0) {
      applyTelegramTheme(themeParams);
    } else {
      console.warn('[TELEGRAM THEME] ⚠️ themeParams пустые, используем тему по умолчанию');
    }
    
    return true;
    
  } catch (error) {
    console.error('[TELEGRAM THEME] ❌ Ошибка инициализации:', error);
    return false;
  }
}

/**
 * ЭТАП 1: Обработчик события изменения темы
 */
function handleThemeChanged(): void {
  console.log('[TELEGRAM THEME] 🔄 Обнаружено изменение темы');
  
  // ЭТАП 1: Переинициализируем тему
  const success = initializeTelegramTheme();
  
  if (success) {
    console.log('[TELEGRAM THEME] ✅ Тема обновлена после изменения');
  } else {
    console.error('[TELEGRAM THEME] ❌ Не удалось обновить тему');
  }
}

/**
 * ЭТАП 1: Обработчик события изменения viewport
 */
function handleViewportChanged(): void {
  console.log('[TELEGRAM THEME] 📐 Обнаружено изменение viewport');
  
  try {
    const webApp = window.Telegram?.WebApp;
    if (webApp) {
      console.log('[TELEGRAM THEME] 📊 Новые размеры viewport:', {
        viewportHeight: webApp.viewportHeight,
        viewportStableHeight: webApp.viewportStableHeight,
        isExpanded: (webApp as any).isExpanded
      });
    }
  } catch (error) {
    console.error('[TELEGRAM THEME] ❌ Ошибка обработки viewport:', error);
  }
}

/**
 * ЭТАП 1: Инициализирует обработчики событий Telegram WebApp
 */
export function initializeTelegramEvents(): boolean {
  console.log('[TELEGRAM THEME] 🎧 Инициализация обработчиков событий...');
  
  try {
    const webApp = window.Telegram?.WebApp;
    
    if (!webApp || !webApp.onEvent) {
      console.warn('[TELEGRAM THEME] ⚠️ onEvent недоступен');
      return false;
    }
    
    // ЭТАП 1: Подписываемся на события
    webApp.onEvent('themeChanged', handleThemeChanged);
    console.log('[TELEGRAM THEME] ✅ Подписка на themeChanged');
    
    webApp.onEvent('viewportChanged', handleViewportChanged);
    console.log('[TELEGRAM THEME] ✅ Подписка на viewportChanged');
    
    webApp.onEvent('mainButtonClicked', () => {
      console.log('[TELEGRAM THEME] 🔘 MainButton clicked');
    });
    
    // ФИНАЛЬНОЕ ЗАВЕРШЕНИЕ: Обработка settingsButtonPressed
    webApp.onEvent('settingsButtonPressed', () => {
      console.log('[TG SETTINGS BUTTON PRESSED] ⚙️ Пользователь нажал кнопку настроек');
      try {
        // Можно добавить логику открытия настроек приложения
        console.log('[TG SETTINGS] Открытие раздела настроек...');
      } catch (error) {
        console.error('[TG ERROR] settingsButtonPressed — Failed to handle settings:', error);
      }
    });
    
    return true;
    
  } catch (error) {
    console.error('[TELEGRAM THEME] ❌ Ошибка инициализации событий:', error);
    return false;
  }
}

/**
 * ЭТАП 1: Получает текущее состояние темы
 */
export function getThemeState(): ThemeState {
  return { ...themeState };
}

/**
 * ЭТАП 1: Полная инициализация темы и событий
 */
export function initializeTelegramThemeSystem(): boolean {
  console.log('[TELEGRAM THEME] 🌟 Полная инициализация системы темы...');
  
  const themeSuccess = initializeTelegramTheme();
  const eventsSuccess = initializeTelegramEvents();
  
  const overallSuccess = themeSuccess || eventsSuccess;
  
  console.log('[TELEGRAM THEME] 📊 Результат инициализации:', {
    theme: themeSuccess,
    events: eventsSuccess,
    overall: overallSuccess
  });
  
  return overallSuccess;
}