/**
 * Утилита для логирования в приложении
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
 * Безопасное логирование информации для продакшена с важностью информации
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
  debug,
  warn,
  error,
  safeLog
};