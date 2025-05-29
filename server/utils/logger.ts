/**
 * Серверная утилита для логирования
 * Позволяет контролировать вывод логов в зависимости от окружения (development/production)
 */

// Определяем текущее окружение
const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Логирование информационных сообщений (только в режиме разработки)
 * @param message Сообщение или объект для логирования
 * @param optionalParams Дополнительные параметры для логирования
 */
export function log(message: any, ...optionalParams: any[]): void {
  if (isDevelopment) {
    console.log(message, ...optionalParams);
  }
}

/**
 * Логирование информационных сообщений (работает в любом режиме)
 * @param message Сообщение или объект для логирования
 * @param optionalParams Дополнительные параметры для логирования
 */
export function info(message: any, ...optionalParams: any[]): void {
  console.log(message, ...optionalParams);
}

/**
 * Логирование предупреждений (только в режиме разработки)
 * @param message Сообщение или объект для логирования
 * @param optionalParams Дополнительные параметры для логирования
 */
export function warn(message: any, ...optionalParams: any[]): void {
  if (isDevelopment) {
    console.warn(message, ...optionalParams);
  }
}

/**
 * Логирование debug-информации (только в режиме разработки)
 * @param message Сообщение или объект для логирования
 * @param optionalParams Дополнительные параметры для логирования
 */
export function debug(message: any, ...optionalParams: any[]): void {
  if (isDevelopment) {
    console.debug(message, ...optionalParams);
  }
}

/**
 * Логирование ошибок (в любом режиме)
 * @param message Сообщение или объект для логирования
 * @param optionalParams Дополнительные параметры для логирования
 */
export function error(message: any, ...optionalParams: any[]): void {
  console.error(message, ...optionalParams);
}

/**
 * Структурированное логирование ошибок
 * @param context Контекст ошибки (название модуля/метода)
 * @param errorData Данные об ошибке
 */
export function logError(context: string, errorData: {
  error: Error | string | unknown,
  details?: Record<string, any>,
  request?: {
    path?: string,
    method?: string,
    params?: Record<string, any>
  }
}): void {
  const errorMessage = errorData.error instanceof Error 
    ? errorData.error.message 
    : String(errorData.error);
  
  const errorStack = errorData.error instanceof Error 
    ? errorData.error.stack 
    : undefined;
  
  // Основное сообщение об ошибке
  console.error(`[${context}] ${errorMessage}`);
  
  // Детали ошибки
  if (errorData.details && Object.keys(errorData.details).length > 0) {
    console.error(`[${context}] Детали:`, errorData.details);
  }
  
  // Информация о запросе
  if (errorData.request) {
    console.error(`[${context}] Запрос:`, errorData.request);
  }
  
  // Стек ошибки (только в development)
  if (isDevelopment && errorStack) {
    console.error(`[${context}] Стек:`, errorStack);
  }
}

/**
 * Безопасное логирование информации с важностью
 * @param importance Важность сообщения от 1 до 10
 * @param message Сообщение или объект для логирования
 * @param optionalParams Дополнительные параметры для логирования
 */
export function safeLog(importance: number, message: any, ...optionalParams: any[]): void {
  // В продакшене выводим только сообщения с высокой важностью (8-10)
  if (isDevelopment || importance >= 8) {
    const prefix = isDevelopment 
      ? `[SAFE:${importance}]` 
      : '[CRITICAL]';
    
    console.log(prefix, message, ...optionalParams);
  }
}

export default {
  log,
  info,
  debug,
  warn,
  error,
  logError,
  safeLog
};