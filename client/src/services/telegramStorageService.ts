/**
 * ЭТАП 3: Сервис для работы с Telegram CloudStorage API
 * 
 * Этот сервис обеспечивает:
 * 1. Сохранение пользовательских настроек в облаке Telegram
 * 2. Загрузку настроек с обработкой ошибок
 * 3. Централизованное управление ключами настроек
 * 4. Fallback на localStorage при недоступности CloudStorage
 */

// ЭТАП 3: Интерфейс для настроек пользователя
interface UserSettings {
  language?: string;
  theme?: 'light' | 'dark' | 'auto';
  lastScreen?: string;
  farmingNotifications?: boolean;
  boostNotifications?: boolean;
  soundEnabled?: boolean;
  lastActiveBoost?: string;
  preferredCurrency?: 'UNI' | 'TON';
}

// ЭТАП 3: Предопределенные ключи для настроек
export const STORAGE_KEYS = {
  LANGUAGE: 'user_language',
  THEME: 'user_theme',
  LAST_SCREEN: 'last_screen',
  FARMING_NOTIFICATIONS: 'farming_notifications',
  BOOST_NOTIFICATIONS: 'boost_notifications',
  SOUND_ENABLED: 'sound_enabled',
  LAST_ACTIVE_BOOST: 'last_active_boost',
  PREFERRED_CURRENCY: 'preferred_currency',
  USER_SETTINGS: 'user_settings_v1'
} as const;

// ЭТАП 3: Состояние сервиса хранилища
interface StorageState {
  isCloudStorageAvailable: boolean;
  lastError: string | null;
  operationsCount: number;
  fallbackToLocalStorage: boolean;
}

let storageState: StorageState = {
  isCloudStorageAvailable: false,
  lastError: null,
  operationsCount: 0,
  fallbackToLocalStorage: false
};

/**
 * ЭТАП 3: Проверяет доступность Telegram CloudStorage API
 * @returns true если CloudStorage доступно
 */
function isCloudStorageAvailable(): boolean {
  try {
    const cloudStorage = window.Telegram?.WebApp?.CloudStorage;
    const isAvailable = !!(cloudStorage && 
                          cloudStorage.setItem && 
                          cloudStorage.getItem && 
                          cloudStorage.removeItem);
    
    storageState.isCloudStorageAvailable = isAvailable;
    
    if (isAvailable) {
      console.log('[TG STORAGE INIT] ✅ CloudStorage API доступно');
    } else {
      console.warn('[TG STORAGE INIT] ⚠️ CloudStorage API недоступно, используем localStorage');
      storageState.fallbackToLocalStorage = true;
    }
    
    return isAvailable;
  } catch (error) {
    console.error('[TG STORAGE INIT] ❌ Ошибка проверки CloudStorage:', error);
    storageState.fallbackToLocalStorage = true;
    return false;
  }
}

/**
 * ЭТАП 3: Сохраняет настройку в Telegram CloudStorage или localStorage
 * @param key - Ключ настройки
 * @param value - Значение для сохранения
 * @returns Promise с результатом операции
 */
export async function saveSetting(key: string, value: string): Promise<boolean> {
  console.log(`[TG STORAGE SET] 💾 Сохранение: ${key} = ${value.substring(0, 50)}...`);
  
  try {
    storageState.operationsCount++;
    
    // ЭТАП 3: Попытка использовать CloudStorage
    if (storageState.isCloudStorageAvailable && !storageState.fallbackToLocalStorage) {
      try {
        await window.Telegram!.WebApp!.CloudStorage!.setItem(key, value);
        console.log(`[TG STORAGE SET] ✅ Сохранено в CloudStorage: ${key}`);
        storageState.lastError = null;
        return true;
      } catch (cloudError) {
        console.warn(`[TG STORAGE ERROR] CloudStorage.setItem failed: ${cloudError}`);
        storageState.fallbackToLocalStorage = true;
        storageState.lastError = `CloudStorage error: ${cloudError}`;
      }
    }
    
    // ЭТАП 3: Fallback на localStorage
    try {
      localStorage.setItem(`telegram_${key}`, value);
      console.log(`[TG STORAGE SET] ✅ Сохранено в localStorage: ${key}`);
      return true;
    } catch (localError) {
      console.error(`[TG STORAGE ERROR] localStorage.setItem failed: ${localError}`);
      storageState.lastError = `localStorage error: ${localError}`;
      return false;
    }
    
  } catch (error) {
    console.error(`[TG STORAGE ERROR] saveSetting failed: ${error}`);
    storageState.lastError = `Save error: ${error}`;
    return false;
  }
}

/**
 * ЭТАП 3: Загружает настройку из Telegram CloudStorage или localStorage
 * @param key - Ключ настройки
 * @returns Promise с значением или null
 */
export async function loadSetting(key: string): Promise<string | null> {
  console.log(`[TG STORAGE GET] 📖 Загрузка: ${key}`);
  
  try {
    storageState.operationsCount++;
    
    // ЭТАП 3: Попытка использовать CloudStorage
    if (storageState.isCloudStorageAvailable && !storageState.fallbackToLocalStorage) {
      try {
        const value = await window.Telegram!.WebApp!.CloudStorage!.getItem(key);
        if (value !== null && value !== undefined && value !== '') {
          console.log(`[TG STORAGE GET] ✅ Загружено из CloudStorage: ${key} = ${value.substring(0, 50)}...`);
          storageState.lastError = null;
          return value;
        }
      } catch (cloudError) {
        console.warn(`[TG STORAGE ERROR] CloudStorage.getItem failed: ${cloudError}`);
        storageState.fallbackToLocalStorage = true;
        storageState.lastError = `CloudStorage error: ${cloudError}`;
      }
    }
    
    // ЭТАП 3: Fallback на localStorage
    try {
      const value = localStorage.getItem(`telegram_${key}`);
      if (value !== null) {
        console.log(`[TG STORAGE GET] ✅ Загружено из localStorage: ${key} = ${value.substring(0, 50)}...`);
        return value;
      } else {
        console.log(`[TG STORAGE GET] ℹ️ Значение не найдено: ${key}`);
        return null;
      }
    } catch (localError) {
      console.error(`[TG STORAGE ERROR] localStorage.getItem failed: ${localError}`);
      storageState.lastError = `localStorage error: ${localError}`;
      return null;
    }
    
  } catch (error) {
    console.error(`[TG STORAGE ERROR] loadSetting failed: ${error}`);
    storageState.lastError = `Load error: ${error}`;
    return null;
  }
}

/**
 * ЭТАП 3: Удаляет настройку из хранилища
 * @param key - Ключ настройки для удаления
 * @returns Promise с результатом операции
 */
export async function removeSetting(key: string): Promise<boolean> {
  console.log(`[TG STORAGE REMOVE] 🗑️ Удаление: ${key}`);
  
  try {
    storageState.operationsCount++;
    
    // ЭТАП 3: Попытка использовать CloudStorage
    if (storageState.isCloudStorageAvailable && !storageState.fallbackToLocalStorage) {
      try {
        await window.Telegram!.WebApp!.CloudStorage!.removeItem(key);
        console.log(`[TG STORAGE REMOVE] ✅ Удалено из CloudStorage: ${key}`);
      } catch (cloudError) {
        console.warn(`[TG STORAGE ERROR] CloudStorage.removeItem failed: ${cloudError}`);
        storageState.fallbackToLocalStorage = true;
      }
    }
    
    // ЭТАП 3: Fallback на localStorage
    try {
      localStorage.removeItem(`telegram_${key}`);
      console.log(`[TG STORAGE REMOVE] ✅ Удалено из localStorage: ${key}`);
      return true;
    } catch (localError) {
      console.error(`[TG STORAGE ERROR] localStorage.removeItem failed: ${localError}`);
      return false;
    }
    
  } catch (error) {
    console.error(`[TG STORAGE ERROR] removeSetting failed: ${error}`);
    return false;
  }
}

/**
 * ЭТАП 3: Сохраняет полные настройки пользователя
 * @param settings - Объект с настройками пользователя
 * @returns Promise с результатом операции
 */
export async function saveUserSettings(settings: UserSettings): Promise<boolean> {
  console.log('[TG STORAGE SET] 👤 Сохранение настроек пользователя:', settings);
  
  try {
    const settingsJson = JSON.stringify(settings);
    const success = await saveSetting(STORAGE_KEYS.USER_SETTINGS, settingsJson);
    
    if (success) {
      console.log('[TG STORAGE SET] ✅ Настройки пользователя сохранены');
    } else {
      console.error('[TG STORAGE ERROR] ❌ Не удалось сохранить настройки пользователя');
    }
    
    return success;
  } catch (error) {
    console.error('[TG STORAGE ERROR] saveUserSettings failed:', error);
    return false;
  }
}

/**
 * ЭТАП 3: Загружает полные настройки пользователя
 * @returns Promise с настройками пользователя или значениями по умолчанию
 */
export async function loadUserSettings(): Promise<UserSettings> {
  console.log('[TG STORAGE GET] 👤 Загрузка настроек пользователя...');
  
  try {
    const settingsJson = await loadSetting(STORAGE_KEYS.USER_SETTINGS);
    
    if (settingsJson) {
      const settings = JSON.parse(settingsJson) as UserSettings;
      console.log('[TG STORAGE GET] ✅ Настройки пользователя загружены:', settings);
      return settings;
    } else {
      // ЭТАП 3: Настройки по умолчанию
      const defaultSettings: UserSettings = {
        language: 'ru',
        theme: 'auto',
        lastScreen: '/',
        farmingNotifications: true,
        boostNotifications: true,
        soundEnabled: true,
        preferredCurrency: 'UNI'
      };
      
      console.log('[TG STORAGE GET] ℹ️ Используем настройки по умолчанию:', defaultSettings);
      return defaultSettings;
    }
  } catch (error) {
    console.error('[TG STORAGE ERROR] loadUserSettings failed:', error);
    
    // ЭТАП 3: Возвращаем минимальные настройки при ошибке
    return {
      language: 'ru',
      theme: 'auto',
      lastScreen: '/',
      farmingNotifications: true,
      boostNotifications: true,
      soundEnabled: true,
      preferredCurrency: 'UNI'
    };
  }
}

/**
 * ЭТАП 3: Инициализирует сервис хранилища
 * @returns true если инициализация успешна
 */
export function initializeTelegramStorage(): boolean {
  console.log('[TG STORAGE INIT] 🚀 Инициализация Telegram Storage...');
  
  try {
    const isAvailable = isCloudStorageAvailable();
    
    console.log('[TG STORAGE INIT] 📊 Статус инициализации:', {
      cloudStorageAvailable: storageState.isCloudStorageAvailable,
      fallbackToLocalStorage: storageState.fallbackToLocalStorage,
      isReady: true
    });
    
    return true;
  } catch (error) {
    console.error('[TG STORAGE ERROR] Инициализация не удалась:', error);
    return false;
  }
}

/**
 * ЭТАП 3: Получает состояние сервиса хранилища
 * @returns Текущее состояние сервиса
 */
export function getStorageState(): StorageState {
  return { ...storageState };
}

/**
 * ЭТАП 3: Утилиты для быстрого сохранения/загрузки распространенных настроек
 */
export const StorageUtils = {
  // ЭТАП 3: Сохранение/загрузка последнего экрана
  saveLastScreen: (screen: string) => saveSetting(STORAGE_KEYS.LAST_SCREEN, screen),
  loadLastScreen: () => loadSetting(STORAGE_KEYS.LAST_SCREEN),
  
  // ЭТАП 3: Сохранение/загрузка темы
  saveTheme: (theme: 'light' | 'dark' | 'auto') => saveSetting(STORAGE_KEYS.THEME, theme),
  loadTheme: () => loadSetting(STORAGE_KEYS.THEME),
  
  // ЭТАП 3: Сохранение/загрузка языка
  saveLanguage: (language: string) => saveSetting(STORAGE_KEYS.LANGUAGE, language),
  loadLanguage: () => loadSetting(STORAGE_KEYS.LANGUAGE),
  
  // ЭТАП 3: Сохранение/загрузка последнего активного буста
  saveLastBoost: (boostId: string) => saveSetting(STORAGE_KEYS.LAST_ACTIVE_BOOST, boostId),
  loadLastBoost: () => loadSetting(STORAGE_KEYS.LAST_ACTIVE_BOOST)
};