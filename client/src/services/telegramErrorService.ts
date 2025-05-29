/**
 * ЭТАП 3: Централизованный сервис обработки ошибок Telegram WebApp
 * 
 * Этот сервис обеспечивает:
 * 1. Унифицированную обработку всех ошибок Telegram API
 * 2. Логирование ошибок в стандартизированном формате
 * 3. Отправку критических ошибок через alert
 * 4. Сбор статистики ошибок для анализа
 */

// ЭТАП 3: Типы ошибок Telegram WebApp
type TelegramErrorType = 
  | 'api_not_available' 
  | 'method_failed' 
  | 'invalid_data' 
  | 'network_error' 
  | 'permission_denied'
  | 'unknown_error';

// ЭТАП 3: Интерфейс для информации об ошибке
interface TelegramError {
  type: TelegramErrorType;
  method: string;
  message: string;
  originalError?: any;
  timestamp: number;
  isCritical: boolean;
  context?: Record<string, any>;
}

// ЭТАП 3: Состояние сервиса ошибок
interface ErrorServiceState {
  totalErrors: number;
  criticalErrors: number;
  lastError: TelegramError | null;
  errorHistory: TelegramError[];
  isLoggingEnabled: boolean;
}

let errorState: ErrorServiceState = {
  totalErrors: 0,
  criticalErrors: 0,
  lastError: null,
  errorHistory: [],
  isLoggingEnabled: true
};

/**
 * ЭТАП 3: Обрабатывает ошибку Telegram WebApp с логированием
 * @param method - Название метода где произошла ошибка
 * @param error - Объект ошибки
 * @param type - Тип ошибки
 * @param isCritical - Является ли ошибка критической
 * @param context - Дополнительный контекст
 */
export function handleTelegramError(
  method: string,
  error: any,
  type: TelegramErrorType = 'unknown_error',
  isCritical: boolean = false,
  context?: Record<string, any>
): void {
  const message = error?.message || error?.toString() || 'Unknown error occurred';
  
  const telegramError: TelegramError = {
    type,
    method,
    message,
    originalError: error,
    timestamp: Date.now(),
    isCritical,
    context
  };
  
  // ЭТАП 3: Обновляем статистику
  errorState.totalErrors++;
  if (isCritical) {
    errorState.criticalErrors++;
  }
  errorState.lastError = telegramError;
  
  // ЭТАП 3: Добавляем в историю (ограничиваем до 50 последних ошибок)
  errorState.errorHistory.push(telegramError);
  if (errorState.errorHistory.length > 50) {
    errorState.errorHistory.shift();
  }
  
  // ЭТАП 3: Логирование в стандартизированном формате
  const logMessage = `[TG ERROR] ${method} — ${message}`;
  
  if (isCritical) {
    console.error(logMessage, {
      type,
      context,
      originalError: error,
      timestamp: new Date(telegramError.timestamp).toISOString()
    });
    
    // ЭТАП 3: Показываем alert для критических ошибок
    try {
      if (window.Telegram?.WebApp?.showAlert) {
        window.Telegram.WebApp.showAlert(`Ошибка: ${message}`);
      } else {
        alert(`Telegram Error: ${message}`);
      }
    } catch (alertError) {
      console.error('[TG ERROR] Failed to show alert:', alertError);
    }
  } else {
    console.warn(logMessage, {
      type,
      context,
      timestamp: new Date(telegramError.timestamp).toISOString()
    });
  }
}

/**
 * ЭТАП 3: Безопасное выполнение Telegram API метода с обработкой ошибок
 * @param methodName - Название метода
 * @param operation - Функция для выполнения
 * @param isCritical - Критичность операции
 * @param context - Контекст выполнения
 * @returns Результат операции или null при ошибке
 */
export async function safeTelegramOperation<T>(
  methodName: string,
  operation: () => T | Promise<T>,
  isCritical: boolean = false,
  context?: Record<string, any>
): Promise<T | null> {
  try {
    console.log(`[TG OPERATION] 🔄 Выполнение: ${methodName}`);
    const result = await operation();
    console.log(`[TG OPERATION] ✅ Успешно: ${methodName}`);
    return result;
  } catch (error) {
    handleTelegramError(methodName, error, 'method_failed', isCritical, context);
    return null;
  }
}

/**
 * ЭТАП 3: Проверяет доступность Telegram WebApp API с обработкой ошибок
 * @returns true если API доступно
 */
export function checkTelegramApiAvailability(): boolean {
  try {
    if (!window.Telegram) {
      handleTelegramError(
        'checkApiAvailability',
        'Telegram object not found',
        'api_not_available',
        true
      );
      return false;
    }
    
    if (!window.Telegram.WebApp) {
      handleTelegramError(
        'checkApiAvailability',
        'Telegram.WebApp not found',
        'api_not_available',
        true
      );
      return false;
    }
    
    console.log('[TG ERROR] ✅ Telegram WebApp API доступно');
    return true;
  } catch (error) {
    handleTelegramError(
      'checkApiAvailability',
      error,
      'unknown_error',
      true
    );
    return false;
  }
}

/**
 * ЭТАП 3: Обертки для основных Telegram API методов с обработкой ошибок
 */
export const SafeTelegramAPI = {
  // ЭТАП 3: Безопасный вызов ready()
  ready: () => safeTelegramOperation(
    'ready',
    () => window.Telegram?.WebApp?.ready(),
    true
  ),
  
  // ЭТАП 3: Безопасный вызов expand()
  expand: () => safeTelegramOperation(
    'expand',
    () => window.Telegram?.WebApp?.expand(),
    false
  ),
  
  // ЭТАП 3: Безопасный вызов close() с логированием
  close: () => {
    console.log('[TG CLOSE CLICKED] 🚪 Закрытие Telegram Mini App...');
    return safeTelegramOperation(
      'close',
      () => {
        if (window.Telegram?.WebApp?.close) {
          console.log('[TG CLOSE] ✅ Вызываем Telegram.WebApp.close()');
          window.Telegram.WebApp.close();
          return true;
        } else {
          console.warn('[TG CLOSE] ⚠️ Telegram.WebApp.close() недоступен');
          return false;
        }
      },
      false
    );
  },
  
  // ЭТАП 3: Безопасная работа с MainButton
  mainButton: {
    show: () => safeTelegramOperation(
      'MainButton.show',
      () => window.Telegram?.WebApp?.MainButton?.show(),
      false
    ),
    
    hide: () => safeTelegramOperation(
      'MainButton.hide',
      () => window.Telegram?.WebApp?.MainButton?.hide(),
      false
    ),
    
    setText: (text: string) => safeTelegramOperation(
      'MainButton.setText',
      () => window.Telegram?.WebApp?.MainButton?.setText(text),
      false,
      { text }
    ),
    
    onClick: (callback: () => void) => safeTelegramOperation(
      'MainButton.onClick',
      () => window.Telegram?.WebApp?.MainButton?.onClick(callback),
      false
    )
  },
  
  // ЭТАП 3: Безопасная работа с BackButton
  backButton: {
    show: () => safeTelegramOperation(
      'BackButton.show',
      () => window.Telegram?.WebApp?.BackButton?.show(),
      false
    ),
    
    hide: () => safeTelegramOperation(
      'BackButton.hide',
      () => window.Telegram?.WebApp?.BackButton?.hide(),
      false
    ),
    
    onClick: (callback: () => void) => safeTelegramOperation(
      'BackButton.onClick',
      () => window.Telegram?.WebApp?.BackButton?.onClick(callback),
      false
    )
  },
  
  // ЭТАП 3: Безопасная работа с CloudStorage
  cloudStorage: {
    setItem: (key: string, value: string) => safeTelegramOperation(
      'CloudStorage.setItem',
      () => window.Telegram?.WebApp?.CloudStorage?.setItem(key, value),
      false,
      { key, valueLength: value.length }
    ),
    
    getItem: (key: string) => safeTelegramOperation(
      'CloudStorage.getItem',
      () => window.Telegram?.WebApp?.CloudStorage?.getItem(key),
      false,
      { key }
    ),
    
    removeItem: (key: string) => safeTelegramOperation(
      'CloudStorage.removeItem',
      () => window.Telegram?.WebApp?.CloudStorage?.removeItem(key),
      false,
      { key }
    )
  },
  
  // ЭТАП 3: Безопасная отправка данных
  sendData: (data: string) => safeTelegramOperation(
    'sendData',
    () => window.Telegram?.WebApp?.sendData?.(data),
    false,
    { dataLength: data.length }
  ),
  
  // ЭТАП 3: Безопасная работа с событиями
  onEvent: (eventType: string, handler: () => void) => safeTelegramOperation(
    'onEvent',
    () => window.Telegram?.WebApp?.onEvent?.(eventType, handler),
    false,
    { eventType }
  ),
  
  offEvent: (eventType: string, handler: () => void) => safeTelegramOperation(
    'offEvent',
    () => window.Telegram?.WebApp?.offEvent?.(eventType, handler),
    false,
    { eventType }
  )
};

/**
 * ЭТАП 3: Получает статистику ошибок
 * @returns Текущая статистика ошибок
 */
export function getErrorStatistics(): ErrorServiceState {
  return { ...errorState };
}

/**
 * ЭТАП 3: Очищает историю ошибок
 */
export function clearErrorHistory(): void {
  console.log('[TG ERROR] 🧹 Очистка истории ошибок');
  errorState.errorHistory = [];
  errorState.totalErrors = 0;
  errorState.criticalErrors = 0;
  errorState.lastError = null;
}

/**
 * ЭТАП 3: Включает/выключает логирование ошибок
 * @param enabled - Включить или выключить логирование
 */
export function setErrorLogging(enabled: boolean): void {
  errorState.isLoggingEnabled = enabled;
  console.log(`[TG ERROR] ${enabled ? '✅ Включено' : '❌ Выключено'} логирование ошибок`);
}

/**
 * ЭТАП 3: Экспортирует историю ошибок для отладки
 * @returns JSON строка с историей ошибок
 */
export function exportErrorHistory(): string {
  const exportData = {
    totalErrors: errorState.totalErrors,
    criticalErrors: errorState.criticalErrors,
    errorHistory: errorState.errorHistory.map(error => ({
      ...error,
      timestamp: new Date(error.timestamp).toISOString(),
      originalError: error.originalError?.message || 'N/A'
    })),
    exportTimestamp: new Date().toISOString()
  };
  
  return JSON.stringify(exportData, null, 2);
}