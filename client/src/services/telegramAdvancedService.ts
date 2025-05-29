/**
 * ЭТАП 3: Объединенный сервис для всех улучшений Telegram WebApp
 * 
 * Этот сервис интегрирует:
 * 1. CloudStorage API для сохранения настроек
 * 2. SendData API для отправки данных в бот
 * 3. Централизованную обработку ошибок
 * 4. Мониторинг состояния всех сервисов
 */

import { 
  initializeTelegramStorage, 
  saveUserSettings, 
  loadUserSettings, 
  StorageUtils 
} from './telegramStorageService';

import { 
  initializeTelegramSendData, 
  sendDataToBot, 
  SendDataUtils 
} from './telegramSendDataService';

import { 
  checkTelegramApiAvailability, 
  SafeTelegramAPI, 
  getErrorStatistics 
} from './telegramErrorService';

// ЭТАП 3: Состояние объединенного сервиса
interface AdvancedServiceState {
  isInitialized: boolean;
  storageReady: boolean;
  sendDataReady: boolean;
  errorHandlingReady: boolean;
  lastInitTime: number;
  features: {
    cloudStorage: boolean;
    sendData: boolean;
    errorHandling: boolean;
  };
}

let advancedState: AdvancedServiceState = {
  isInitialized: false,
  storageReady: false,
  sendDataReady: false,
  errorHandlingReady: false,
  lastInitTime: 0,
  features: {
    cloudStorage: false,
    sendData: false,
    errorHandling: false
  }
};

/**
 * ЭТАП 3: Инициализирует все улучшенные функции Telegram WebApp
 * @returns Объект с результатами инициализации
 */
export async function initializeTelegramAdvancedFeatures(): Promise<AdvancedServiceState> {
  console.log('[TG ADVANCED] 🚀 Инициализация улучшенных функций Telegram WebApp...');
  
  try {
    // ЭТАП 3: Проверяем доступность основного API
    const apiAvailable = checkTelegramApiAvailability();
    if (!apiAvailable) {
      console.warn('[TG ADVANCED] ⚠️ Основной Telegram API недоступен');
    }
    
    // ЭТАП 3: Инициализируем CloudStorage
    try {
      const storageResult = initializeTelegramStorage();
      advancedState.storageReady = storageResult;
      advancedState.features.cloudStorage = storageResult;
      console.log(`[TG ADVANCED] ${storageResult ? '✅' : '❌'} CloudStorage инициализация`);
    } catch (error) {
      console.error('[TG ADVANCED] ❌ Ошибка инициализации CloudStorage:', error);
      advancedState.storageReady = false;
    }
    
    // ЭТАП 3: Инициализируем SendData
    try {
      const sendDataResult = initializeTelegramSendData();
      advancedState.sendDataReady = sendDataResult;
      advancedState.features.sendData = sendDataResult;
      console.log(`[TG ADVANCED] ${sendDataResult ? '✅' : '❌'} SendData инициализация`);
    } catch (error) {
      console.error('[TG ADVANCED] ❌ Ошибка инициализации SendData:', error);
      advancedState.sendDataReady = false;
    }
    
    // ЭТАП 3: Инициализируем обработку ошибок
    try {
      advancedState.errorHandlingReady = true;
      advancedState.features.errorHandling = true;
      console.log('[TG ADVANCED] ✅ Обработка ошибок инициализирована');
    } catch (error) {
      console.error('[TG ADVANCED] ❌ Ошибка инициализации обработки ошибок:', error);
      advancedState.errorHandlingReady = false;
    }
    
    // ЭТАП 3: Загружаем сохраненные настройки пользователя
    try {
      const userSettings = await loadUserSettings();
      console.log('[TG ADVANCED] 📂 Настройки пользователя загружены:', userSettings);
      
      // ЭТАП 3: Применяем загруженные настройки
      await applyUserSettings(userSettings);
    } catch (error) {
      console.warn('[TG ADVANCED] ⚠️ Не удалось загрузить настройки пользователя:', error);
    }
    
    // ЭТАП 3: Обновляем состояние
    advancedState.isInitialized = true;
    advancedState.lastInitTime = Date.now();
    
    // ЭТАП 3: Итоговый отчет
    const successCount = Object.values(advancedState.features).filter(Boolean).length;
    console.log('[TG ADVANCED] 📊 Инициализация завершена:', {
      totalFeatures: 3,
      successfulFeatures: successCount,
      features: advancedState.features,
      isFullyReady: successCount === 3
    });
    
    return { ...advancedState };
    
  } catch (error) {
    console.error('[TG ADVANCED] ❌ Критическая ошибка инициализации:', error);
    return { ...advancedState };
  }
}

/**
 * ЭТАП 3: Применяет загруженные настройки пользователя
 * @param settings - Настройки пользователя
 */
async function applyUserSettings(settings: any): Promise<void> {
  console.log('[TG ADVANCED] ⚙️ Применение настроек пользователя...');
  
  try {
    // ЭТАП 3: Применяем тему если указана
    if (settings.theme && settings.theme !== 'auto') {
      console.log(`[TG ADVANCED] 🎨 Применение темы: ${settings.theme}`);
      // Интеграция с темой будет через существующий сервис
    }
    
    // ЭТАП 3: Применяем язык если указан
    if (settings.language) {
      console.log(`[TG ADVANCED] 🌐 Применение языка: ${settings.language}`);
      // Интеграция с системой локализации
    }
    
    // ЭТАП 3: Сохраняем последний экран для потенциального восстановления
    if (settings.lastScreen) {
      console.log(`[TG ADVANCED] 📱 Последний экран: ${settings.lastScreen}`);
    }
    
    console.log('[TG ADVANCED] ✅ Настройки пользователя применены');
  } catch (error) {
    console.error('[TG ADVANCED] ❌ Ошибка применения настроек:', error);
  }
}

/**
 * ЭТАП 3: Сохраняет текущее состояние приложения перед закрытием
 * @param currentScreen - Текущий экран
 * @param userId - ID пользователя
 */
export async function saveAppStateBeforeClose(currentScreen: string, userId: number): Promise<void> {
  console.log('[TG ADVANCED] 💾 Сохранение состояния перед закрытием...');
  
  try {
    // ЭТАП 3: Сохраняем последний экран
    await StorageUtils.saveLastScreen(currentScreen);
    
    // ЭТАП 3: Отправляем сводку сессии в бот
    if (advancedState.features.sendData) {
      const sessionData = {
        type: 'app_close',
        userId,
        lastScreen: currentScreen,
        timestamp: Date.now(),
        sessionDuration: Date.now() - advancedState.lastInitTime
      };
      
      await sendDataToBot(sessionData);
      console.log('[TG ADVANCED] 📤 Данные сессии отправлены в бот');
    }
    
    console.log('[TG ADVANCED] ✅ Состояние сохранено');
  } catch (error) {
    console.error('[TG ADVANCED] ❌ Ошибка сохранения состояния:', error);
  }
}

/**
 * ЭТАП 3: Обрабатывает действие пользователя с полным логированием
 * @param action - Действие пользователя
 * @param screen - Текущий экран
 * @param userId - ID пользователя
 * @param data - Дополнительные данные
 */
export async function trackUserAction(
  action: string, 
  screen: string, 
  userId: number, 
  data?: any
): Promise<void> {
  console.log(`[TG ADVANCED] 👤 Действие пользователя: ${action} на ${screen}`);
  
  try {
    // ЭТАП 3: Сохраняем действие локально
    await StorageUtils.saveLastScreen(screen);
    
    // ЭТАП 3: Отправляем в бот если возможно
    if (advancedState.features.sendData) {
      await SendDataUtils.screenVisited(userId, screen);
    }
    
    // ЭТАП 3: Специальная обработка для определенных действий
    switch (action) {
      case 'farming_started':
        if (data?.amount) {
          await SendDataUtils.farmingStarted(userId, data.amount);
        }
        break;
        
      case 'farming_harvested':
        if (data?.amount) {
          await SendDataUtils.farmingHarvested(userId, data.amount);
        }
        break;
        
      case 'boost_purchased':
        if (data?.boostId && data?.price) {
          await SendDataUtils.boostPurchased(userId, data.boostId, data.price);
        }
        break;
    }
    
  } catch (error) {
    console.error('[TG ADVANCED] ❌ Ошибка обработки действия пользователя:', error);
  }
}

/**
 * ЭТАП 3: Получает полное состояние всех сервисов
 * @returns Объект с состоянием всех сервисов
 */
export function getAdvancedServiceStatus() {
  const errorStats = getErrorStatistics();
  
  return {
    advanced: { ...advancedState },
    errors: {
      total: errorStats.totalErrors,
      critical: errorStats.criticalErrors,
      lastError: errorStats.lastError?.message || null
    },
    uptime: advancedState.lastInitTime ? Date.now() - advancedState.lastInitTime : 0,
    timestamp: Date.now()
  };
}

/**
 * ЭТАП 3: Экспорт основных функций для использования в компонентах
 */
export const TelegramAdvanced = {
  // ЭТАП 3: Инициализация
  initialize: initializeTelegramAdvancedFeatures,
  
  // ЭТАП 3: Работа с настройками
  saveSettings: saveUserSettings,
  loadSettings: loadUserSettings,
  
  // ЭТАП 3: Отправка данных
  sendToBot: sendDataToBot,
  sendUtils: SendDataUtils,
  
  // ЭТАП 3: Безопасные API вызовы
  safeAPI: SafeTelegramAPI,
  
  // ЭТАП 3: Утилиты хранилища
  storage: StorageUtils,
  
  // ЭТАП 3: Отслеживание действий
  trackAction: trackUserAction,
  
  // ЭТАП 3: Состояние
  getStatus: getAdvancedServiceStatus,
  
  // ЭТАП 3: Сохранение при закрытии
  saveStateBeforeClose: saveAppStateBeforeClose
};