/**
 * polyfills.ts
 * 
 * Этот файл содержит полифиллы для обеспечения совместимости и безопасной работы 
 * в разных средах, особенно в Telegram Mini App.
 */

/**
 * Безопасная версия Array.prototype.map
 * Предотвращает ошибки, когда map вызывается на объекте, не являющемся массивом
 */
export function installArrayMapPolyfill() {
  if (typeof Array.prototype.map !== 'function') {
    console.warn('[Polyfill] Array.prototype.map отсутствует, устанавливаем полифилл');
    
    // @ts-ignore
    Array.prototype.map = function(callback: Function, thisArg?: any) {
      if (this == null) {
        return [];
      }
      
      const O = Object(this);
      const len = O.length >>> 0;
      const A = new Array(len);
      
      for (let k = 0; k < len; k++) {
        if (k in O) {
          A[k] = callback.call(thisArg, O[k], k, O);
        }
      }
      
      return A;
    };
  }
}

/**
 * Безопасное преобразование в массив
 * Предотвращает ошибки, когда входное значение не является массивом
 */
export function toArray<T>(value: any): T[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === null || value === undefined) {
    return [];
  }
  if (typeof value === 'object' && Symbol.iterator in Object(value)) {
    return Array.from(value);
  }
  return [value] as T[];
}

/**
 * Безопасное создание Map
 * Предотвращает ошибки, когда входные данные некорректны
 */
export function safeCreateMap<K, V>(entries?: Array<[K, V]> | null): Map<K, V> {
  try {
    if (entries === null || entries === undefined) {
      return new Map<K, V>();
    }
    if (!Array.isArray(entries)) {
      console.warn('[Polyfill] Входные данные для Map не являются массивом:', entries);
      return new Map<K, V>();
    }
    return new Map<K, V>(entries);
  } catch (error) {
    console.error('[Polyfill] Ошибка при создании Map:', error);
    return new Map<K, V>();
  }
}

/**
 * Безопасная обработка Map конструктора
 * Создает обертку для безопасного создания Map объектов
 */
export function installMapPolyfill() {
  if (typeof Map !== 'undefined') {
    // Создаем глобальную функцию для безопасного создания Map
    // Она не изменяет оригинальный Map, а предоставляет альтернативный путь
    window.safeCreateMap = function<K, V>(entries?: any): Map<K, V> {
      try {
        if (entries === undefined || entries === null) {
          return new Map<K, V>();
        }
        
        // Если entries не является итерируемым объектом, создаем пустой Map
        if (typeof entries !== 'object') {
          console.warn('[Polyfill] Неверный аргумент для safeCreateMap:', entries);
          return new Map<K, V>();
        }
        
        // Если не имеет итератора, пробуем конвертировать
        if (!(Symbol.iterator in Object(entries))) {
          console.warn('[Polyfill] Аргумент не итерируемый:', entries);
          
          // Если это объект, преобразуем его в массив пар [ключ, значение]
          if (typeof entries === 'object') {
            try {
              const entries2 = Object.entries(entries) as Array<[K, V]>;
              return new Map<K, V>(entries2);
            } catch (e) {
              console.error('[Polyfill] Не удалось создать Map из объекта:', e);
              return new Map<K, V>();
            }
          }
          return new Map<K, V>();
        }
        
        // Пытаемся конвертировать entries в массив пар [ключ, значение]
        let safeEntries: Array<[K, V]> = [];
        
        try {
          // Проверяем есть ли метод map
          if (Array.isArray(entries) && typeof entries.map === 'function') {
            safeEntries = entries.map((entry: any) => {
              if (Array.isArray(entry) && entry.length >= 2) {
                return [entry[0], entry[1]];
              }
              // Если формат не соответствует [ключ, значение], используем пустую пару
              return [undefined as unknown as K, undefined as unknown as V];
            });
          } else {
            // Иначе используем for-of итерацию, если объект итерируемый
            try {
              for (const entry of entries) {
                if (Array.isArray(entry) && entry.length >= 2) {
                  safeEntries.push([entry[0], entry[1]]);
                } else {
                  safeEntries.push([undefined as unknown as K, undefined as unknown as V]);
                }
              }
            } catch (e) {
              console.error('[Polyfill] Ошибка при итерации:', e);
              return new Map<K, V>();
            }
          }
        } catch (error) {
          console.error('[Polyfill] Ошибка при обработке элементов для Map:', error);
          return new Map<K, V>();
        }
        
        return new Map<K, V>(safeEntries);
      } catch (error) {
        console.error('[Polyfill] Критическая ошибка при создании Map:', error);
        return new Map<K, V>();
      }
    };
    
    // Устанавливаем специальный обработчик для события w.map
    try {
      // Инструментируем метод Map, чтобы отслеживать его использование
      // Это поможет отловить место с ошибкой 'w.map is not a function'
      const originalMap = window.Map;
      
      // @ts-ignore
      window.Map = function() {
        console.log('[Polyfill Monitor] Map constructor called with:', arguments);
        try {
          // @ts-ignore
          return new originalMap(...arguments);
        } catch (e) {
          console.error('[Polyfill Monitor] Error in Map constructor:', e);
          console.error('[Polyfill Monitor] Stacktrace:', new Error().stack);
          // @ts-ignore
          return new originalMap();
        }
      };
      
      // Копируем все статические свойства
      for (const prop in originalMap) {
        if (originalMap.hasOwnProperty(prop)) {
          // @ts-ignore
          window.Map[prop] = originalMap[prop];
        }
      }
      
      // @ts-ignore - TypeScript ошибка: Cannot assign to 'prototype' because it is a read-only property
      // Но это работает в runtime
      window.Map.prototype = originalMap.prototype;
    } catch (e) {
      console.error('[Polyfill] Failed to patch Map constructor:', e);
    }
    
    console.log('[Polyfill] Безопасный polyfill для Map установлен');
  } else {
    console.warn('[Polyfill] Map не доступен в окружении');
  }
}

/**
 * Устанавливает все полифиллы
 */
export function installAllPolyfills() {
  console.log('[Polyfill] Установка всех полифиллов...');
  installArrayMapPolyfill();
  installMapPolyfill();
  console.log('[Polyfill] Полифиллы успешно установлены');
}

export default installAllPolyfills;