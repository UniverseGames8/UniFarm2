/**
 * Вспомогательные функции для исправления типов данных в API запросах
 * с расширенной защитой от ошибок
 * 
 * Исправляет известные проблемы с несоответствием типов между клиентом и сервером:
 * - сервер ожидает поле amount как строку, клиент иногда отправляет как число
 * - сервер ожидает поле user_id как число, клиент иногда отправляет как строку
 * - другие потенциальные проблемы с типами данных
 */

/**
 * Словарь критически важных полей, требующих особой обработки
 */
const CRITICAL_FIELDS = {
  amount: 'string',       // Поле amount всегда должно быть строкой
  user_id: 'number',      // Поле user_id всегда должно быть числом
  boost_id: 'number',     // Поле boost_id всегда должно быть числом
  transaction_id: 'number', // Поле transaction_id всегда должно быть числом
};

/**
 * Расширенный уникальный ID для логирования
 */
let requestCounter = 0;
const getRequestId = () => {
  requestCounter = (requestCounter + 1) % 100000;
  return `${Date.now().toString(36)}-${requestCounter.toString(36)}`;
};

/**
 * Преобразует значение в указанный тип с надежной обработкой ошибок
 * @param value Исходное значение
 * @param targetType Целевой тип
 * @param fieldName Имя поля (для логирования)
 * @returns Значение в требуемом типе или исходное значение
 */
function convertValueToType(value: any, targetType: string, fieldName: string): any {
  try {
    const requestId = getRequestId();
    
    // Проверяем null/undefined
    if (value === null || value === undefined) {
      return value;
    }
    
    // Целевой тип - строка
    if (targetType === 'string') {
      if (typeof value === 'string') {
        return value; // Уже строка, не меняем
      }
      
      if (typeof value === 'number' || typeof value === 'boolean') {
        console.log(`[apiFix] [${requestId}] Преобразуем ${fieldName}=${value} в строку`);
        return String(value);
      }
      
      if (typeof value === 'object') {
        try {
          const jsonStr = JSON.stringify(value);
          console.warn(`[apiFix] [${requestId}] Преобразуем объект ${fieldName} в строку: ${jsonStr.slice(0, 50)}${jsonStr.length > 50 ? '...' : ''}`);
          return jsonStr;
        } catch (jsonError) {
          console.error(`[apiFix] [${requestId}] Ошибка при преобразовании объекта ${fieldName} в строку:`, jsonError);
          return String(value);
        }
      }
      
      // Для других типов
      console.warn(`[apiFix] [${requestId}] Преобразуем ${typeof value} ${fieldName} в строку`);
      try {
        return String(value);
      } catch (conversionError) {
        console.error(`[apiFix] [${requestId}] Ошибка при конвертации ${fieldName} в строку:`, conversionError);
        return '';
      }
    }
    
    // Целевой тип - число
    else if (targetType === 'number') {
      if (typeof value === 'number') {
        return value; // Уже число, не меняем
      }
      
      if (typeof value === 'string') {
        const parsedValue = parseFloat(value);
        if (!isNaN(parsedValue)) {
          console.log(`[apiFix] [${requestId}] Преобразуем строку ${fieldName}=${value} в число ${parsedValue}`);
          return parsedValue;
        } else {
          console.warn(`[apiFix] [${requestId}] Невозможно преобразовать строку ${fieldName}=${value} в число, используем 0`);
          return 0;
        }
      }
      
      if (typeof value === 'boolean') {
        console.log(`[apiFix] [${requestId}] Преобразуем boolean ${fieldName}=${value} в число ${value ? 1 : 0}`);
        return value ? 1 : 0;
      }
      
      // Для других типов
      console.warn(`[apiFix] [${requestId}] Невозможно корректно преобразовать ${typeof value} ${fieldName} в число, используем 0`);
      return 0;
    }
    
    // Сохраняем исходное значение для остальных типов
    return value;
  } catch (error) {
    console.error(`[apiFix] Критическая ошибка при конвертации ${fieldName}:`, error);
    // Возвращаем исходное значение, чтобы не блокировать запрос
    return value;
  }
}

/**
 * Расширенная функция для исправления типов данных в теле запроса
 * с надежной обработкой ошибок и циклических ссылок
 * 
 * @param body Исходное тело запроса
 * @param depth Текущая глубина рекурсии (для предотвращения переполнения стека)
 * @param visited Набор уже посещенных объектов (для предотвращения циклических ссылок)
 * @returns Модифицированное тело запроса с исправленными типами данных
 */
export function fixRequestBody(
  body: any, 
  depth: number = 0, 
  visited: WeakSet<object> = new WeakSet()
): any {
  const requestId = getRequestId();
  try {
    // Проверка на null/undefined
    if (body === null || body === undefined) {
      return body;
    }
    
    // Примитивные типы возвращаем как есть
    if (typeof body !== 'object') {
      return body;
    }
    
    // Предотвращение циклических ссылок
    if (visited.has(body)) {
      console.warn(`[apiFix] [${requestId}] Обнаружена циклическая ссылка в объекте`);
      return null; // Возвращаем null для циклических ссылок
    }
    
    // Ограничение глубины рекурсии для предотвращения переполнения стека
    if (depth > 10) {
      console.warn(`[apiFix] [${requestId}] Превышена максимальная глубина рекурсии (10)`);
      // Возвращаем плоскую копию объекта без вложенности
      const flatCopy: any = {};
      for (const key in body) {
        if (Object.prototype.hasOwnProperty.call(body, key)) {
          const value = body[key];
          if (typeof value !== 'object' || value === null) {
            flatCopy[key] = value;
          } else {
            flatCopy[key] = '[Object]'; // Заменяем вложенные объекты маркером
          }
        }
      }
      return flatCopy;
    }
    
    // Добавляем текущий объект в множество посещенных
    visited.add(body);
    
    // Массивы обрабатываем рекурсивно, не изменяя структуру
    if (Array.isArray(body)) {
      try {
        return body.map(item => fixRequestBody(item, depth + 1, visited));
      } catch (arrayError) {
        console.error(`[apiFix] [${requestId}] Ошибка при обработке массива:`, arrayError);
        // В случае ошибки возвращаем копию массива без обработки
        return [...body];
      }
    }
    
    // Для объектов создаем новый результат
    const result: any = {};
    
    // Специальная обработка известных полей в корне объекта и стандартизация типов
    for (const key in CRITICAL_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        const targetType = CRITICAL_FIELDS[key as keyof typeof CRITICAL_FIELDS];
        result[key] = convertValueToType(body[key], targetType, key);
      }
    }
    
    // Рекурсивно обрабатываем все остальные поля
    for (const key in body) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        // Пропускаем поля, которые уже обработали выше
        if (key in result) continue;
        
        const value = body[key];
        
        try {
          // Рекурсивно обрабатываем вложенные объекты
          if (typeof value === 'object' && value !== null) {
            result[key] = fixRequestBody(value, depth + 1, visited);
          } else {
            result[key] = value;
          }
        } catch (fieldError) {
          console.error(`[apiFix] [${requestId}] Ошибка при обработке поля ${key}:`, fieldError);
          // В случае ошибки сохраняем исходное значение
          result[key] = value;
        }
      }
    }
    
    return result;
  } catch (error) {
    console.error(`[apiFix] [${requestId}] Критическая ошибка:`, error);
    // В случае критической ошибки возвращаем исходное тело запроса без изменений
    return body;
  }
}