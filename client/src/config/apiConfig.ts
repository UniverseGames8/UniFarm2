/**
 * Конфигурация API-клиента для UniFarm
 * 
 * Этот файл содержит настройки для взаимодействия с API:
 * - Базовый URL API в зависимости от окружения
 * - Тайм-ауты и другие параметры запросов
 */

// Определяем базовый URL API в зависимости от окружения
let API_BASE_URL = '';

// ВСЕГДА используем наш правильный URL для исправления проблемы с Telegram кешем
API_BASE_URL = 'https://uni-farm-connect-x-lukyanenkolawfa.replit.app';

/**
 * Конфигурация API-клиента
 */
const apiConfig = {
  /**
   * Базовый URL API
   */
  baseUrl: API_BASE_URL,
  
  /**
   * Формирует полный URL для API-запроса
   * @param endpoint Относительный путь эндпоинта API
   * @returns Полный URL для запроса
   */
  getFullUrl: (endpoint: string): string => {
    // Проверяем, начинается ли endpoint с /
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    
    // Если baseUrl пустой (режим разработки), возвращаем относительный URL
    if (!apiConfig.baseUrl) {
      return normalizedEndpoint;
    }
    
    // Формируем и возвращаем полный URL
    return `${apiConfig.baseUrl}${normalizedEndpoint}`;
  },
  
  /**
   * Тайм-аут запроса в миллисекундах
   */
  timeout: 15000,
  
  /**
   * Количество попыток повтора запроса при ошибке
   */
  retries: 2
};

export default apiConfig;