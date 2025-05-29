/**
 * ЭТАП 3: Сервис для отправки данных обратно в Telegram-бот через sendData API
 * 
 * Этот сервис обеспечивает:
 * 1. Отправку выбранных пользователем данных в основной Telegram-бот
 * 2. Обработку различных типов данных (boost-пакеты, результаты фарминга)
 * 3. Валидацию и сериализацию данных перед отправкой
 * 4. Централизованную обработку ошибок
 */

// ЭТАП 3: Типы данных для отправки в бот
interface BoostPackageData {
  type: 'boost_package';
  packageId: string;
  packageName: string;
  price: number;
  currency: 'UNI' | 'TON';
  userId: number;
  timestamp: number;
}

interface FarmingResultData {
  type: 'farming_result';
  action: 'start' | 'harvest';
  amount: number;
  currency: 'UNI' | 'TON';
  userId: number;
  timestamp: number;
}

interface UserActionData {
  type: 'user_action';
  action: string;
  screen: string;
  userId: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

// ЭТАП 3: Объединенный тип для всех данных
type TelegramBotData = BoostPackageData | FarmingResultData | UserActionData;

// ЭТАП 3: Состояние сервиса отправки данных
interface SendDataState {
  isSendDataAvailable: boolean;
  lastSentData: string | null;
  sentDataCount: number;
  lastError: string | null;
}

let sendDataState: SendDataState = {
  isSendDataAvailable: false,
  lastSentData: null,
  sentDataCount: 0,
  lastError: null
};

/**
 * ЭТАП 3: Проверяет доступность Telegram sendData API
 * @returns true если sendData доступно
 */
function isSendDataAvailable(): boolean {
  try {
    const sendDataMethod = window.Telegram?.WebApp?.sendData;
    const isAvailable = typeof sendDataMethod === 'function';
    
    sendDataState.isSendDataAvailable = isAvailable;
    
    if (isAvailable) {
      console.log('[TG SEND DATA INIT] ✅ sendData API доступно');
    } else {
      console.warn('[TG SEND DATA INIT] ⚠️ sendData API недоступно');
    }
    
    return isAvailable;
  } catch (error) {
    console.error('[TG SEND DATA INIT] ❌ Ошибка проверки sendData:', error);
    return false;
  }
}

/**
 * ЭТАП 3: Универсальная функция для отправки данных в Telegram-бот
 * @param data - Данные для отправки (объект или строка)
 * @returns true если отправка успешна
 */
export async function sendDataToBot(data: TelegramBotData | object | string): Promise<boolean> {
  console.log('[TG SEND DATA] 📤 Подготовка данных для отправки:', data);
  
  try {
    // ЭТАП 3: Проверяем доступность API
    if (!sendDataState.isSendDataAvailable) {
      console.warn('[TG SEND DATA] ⚠️ sendData API недоступно');
      return false;
    }
    
    // ЭТАП 3: Сериализуем данные
    let payload: string;
    if (typeof data === 'string') {
      payload = data;
    } else {
      payload = JSON.stringify(data);
    }
    
    // ЭТАП 3: Ограничиваем размер данных (Telegram имеет лимиты)
    if (payload.length > 4096) {
      console.error('[TG SEND DATA] ❌ Данные слишком большие (>4096 символов)');
      sendDataState.lastError = 'Data too large';
      return false;
    }
    
    // ЭТАП 3: Отправляем данные
    console.log(`[TG SEND DATA]: ${payload.substring(0, 200)}${payload.length > 200 ? '...' : ''}`);
    
    window.Telegram!.WebApp!.sendData!(payload);
    
    // ЭТАП 3: Обновляем состояние
    sendDataState.lastSentData = payload;
    sendDataState.sentDataCount++;
    sendDataState.lastError = null;
    
    console.log('[TG SEND DATA] ✅ Данные успешно отправлены в бот');
    return true;
    
  } catch (error) {
    console.error('[TG SEND DATA] ❌ Ошибка отправки данных:', error);
    sendDataState.lastError = `Send error: ${error}`;
    return false;
  }
}

/**
 * ЭТАП 3: Отправляет информацию о выбранном boost-пакете
 * @param packageId - ID пакета
 * @param packageName - Название пакета
 * @param price - Цена пакета
 * @param currency - Валюта
 * @param userId - ID пользователя
 * @returns Promise с результатом отправки
 */
export async function sendBoostPackageSelection(
  packageId: string,
  packageName: string,
  price: number,
  currency: 'UNI' | 'TON',
  userId: number
): Promise<boolean> {
  console.log('[TG SEND DATA] 🚀 Отправка выбора boost-пакета:', { packageId, packageName, price, currency });
  
  const boostData: BoostPackageData = {
    type: 'boost_package',
    packageId,
    packageName,
    price,
    currency,
    userId,
    timestamp: Date.now()
  };
  
  return await sendDataToBot(boostData);
}

/**
 * ЭТАП 3: Отправляет результат действия фарминга
 * @param action - Тип действия (start/harvest)
 * @param amount - Количество
 * @param currency - Валюта
 * @param userId - ID пользователя
 * @returns Promise с результатом отправки
 */
export async function sendFarmingResult(
  action: 'start' | 'harvest',
  amount: number,
  currency: 'UNI' | 'TON',
  userId: number
): Promise<boolean> {
  console.log('[TG SEND DATA] 🌱 Отправка результата фарминга:', { action, amount, currency });
  
  const farmingData: FarmingResultData = {
    type: 'farming_result',
    action,
    amount,
    currency,
    userId,
    timestamp: Date.now()
  };
  
  return await sendDataToBot(farmingData);
}

/**
 * ЭТАП 3: Отправляет информацию о действии пользователя
 * @param action - Описание действия
 * @param screen - Текущий экран
 * @param userId - ID пользователя
 * @param metadata - Дополнительные данные
 * @returns Promise с результатом отправки
 */
export async function sendUserAction(
  action: string,
  screen: string,
  userId: number,
  metadata?: Record<string, any>
): Promise<boolean> {
  console.log('[TG SEND DATA] 👤 Отправка действия пользователя:', { action, screen, metadata });
  
  const actionData: UserActionData = {
    type: 'user_action',
    action,
    screen,
    userId,
    timestamp: Date.now(),
    metadata
  };
  
  return await sendDataToBot(actionData);
}

/**
 * ЭТАП 3: Отправляет сводную информацию о сессии пользователя при закрытии приложения
 * @param userId - ID пользователя
 * @param sessionDuration - Длительность сессии в секундах
 * @param screens - Посещенные экраны
 * @param actions - Выполненные действия
 * @returns Promise с результатом отправки
 */
export async function sendSessionSummary(
  userId: number,
  sessionDuration: number,
  screens: string[],
  actions: string[]
): Promise<boolean> {
  console.log('[TG SEND DATA] 📊 Отправка сводки сессии:', { sessionDuration, screens, actions });
  
  const sessionData = {
    type: 'session_summary',
    userId,
    sessionDuration,
    screensVisited: screens,
    actionsPerformed: actions,
    timestamp: Date.now()
  };
  
  return await sendDataToBot(sessionData);
}

/**
 * ЭТАП 3: Инициализирует сервис отправки данных
 * @returns true если инициализация успешна
 */
export function initializeTelegramSendData(): boolean {
  console.log('[TG SEND DATA INIT] 🚀 Инициализация Telegram SendData...');
  
  try {
    const isAvailable = isSendDataAvailable();
    
    console.log('[TG SEND DATA INIT] 📊 Статус инициализации:', {
      sendDataAvailable: sendDataState.isSendDataAvailable,
      isReady: true
    });
    
    return true;
  } catch (error) {
    console.error('[TG SEND DATA ERROR] Инициализация не удалась:', error);
    return false;
  }
}

/**
 * ЭТАП 3: Получает состояние сервиса отправки данных
 * @returns Текущее состояние сервиса
 */
export function getSendDataState(): SendDataState {
  return { ...sendDataState };
}

/**
 * ЭТАП 3: Утилиты для быстрой отправки часто используемых данных
 */
export const SendDataUtils = {
  // ЭТАП 3: Отправка при начале фарминга
  farmingStarted: (userId: number, amount: number) => 
    sendFarmingResult('start', amount, 'UNI', userId),
  
  // ЭТАП 3: Отправка при сборе урожая
  farmingHarvested: (userId: number, amount: number) => 
    sendFarmingResult('harvest', amount, 'UNI', userId),
  
  // ЭТАП 3: Отправка при покупке буста
  boostPurchased: (userId: number, boostId: string, price: number) => 
    sendBoostPackageSelection(boostId, `Boost-${boostId}`, price, 'UNI', userId),
  
  // ЭТАП 3: Отправка при навигации
  screenVisited: (userId: number, screen: string) => 
    sendUserAction('screen_visited', screen, userId),
  
  // ЭТАП 3: Отправка при ошибке
  errorOccurred: (userId: number, error: string, screen: string) => 
    sendUserAction('error_occurred', screen, userId, { error })
};