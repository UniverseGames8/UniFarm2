/**
 * Универсальный сервис для API-запросов
 * 
 * Централизованный метод для всех API-запросов, обеспечивающий:
 * - Единый подход к обработке ошибок
 * - Стандартизированные заголовки
 * - Согласованный интерфейс ответов
 * - Безопасную обработку ошибок сети
 * - Исправление типов данных
 * 
 * Примеры использования:
 * 
 * 1. GET-запрос:
 * ```typescript
 * const response = await apiGet<UserProfile>('/api/user/profile');
 * if (response.success) {
 *   // Используем данные
 *   const profile = response.data;
 * }
 * ```
 * 
 * 2. POST-запрос:
 * ```typescript
 * const response = await apiPost<TransactionResult>('/api/transaction/create', {
 *   amount: '100',
 *   type: 'deposit'
 * });
 * ```
 * 
 * 3. Обработка ошибок:
 * ```typescript
 * try {
 *   const response = await apiGet('/api/data');
 *   if (!response.success) {
 *     console.error('API ошибка:', response.error);
 *     return;
 *   }
 *   // Работа с данными
 * } catch (error) {
 *   console.error('Ошибка сети:', error);
 * }
 * ```
 */

import { correctApiRequest } from './correctApiRequest';
import { fixRequestBody } from './apiFix';

/**
 * Типы HTTP методов, поддерживаемых API
 */
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

/**
 * Стандартный формат ответа API
 */
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
  [key: string]: any;
}

/**
 * Параметры запроса к API
 */
export interface ApiRequestOptions {
  method?: HttpMethod;
  body?: any;
  headers?: Record<string, string>;
  includeAuth?: boolean;
}

/**
 * Унифицированный метод для всех API-запросов
 * 
 * @param endpoint URL эндпоинта (с или без начального слеша)
 * @param options Параметры запроса (метод, тело, заголовки)
 * @returns Ответ в стандартизированном формате
 */
export async function apiService<T = any>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<ApiResponse<T>> {
  try {
    // Используем correctApiRequest для выполнения запроса
    const result = await correctApiRequest<ApiResponse<T>>(
      endpoint,
      options.method || 'GET',
      options.body ? fixRequestBody(options.body) : undefined
    );

    // Проверяем и нормализуем ответ
    if (result === null || result === undefined) {
      return {
        success: false,
        error: 'Получен пустой ответ от сервера',
        data: null as any
      };
    }

    // Если ответ не содержит поле success, добавляем его на основе наличия поля error
    if (result.success === undefined) {
      result.success = !result.error;
    }

    return result;
  } catch (error: any) {
    console.error('[apiService] Ошибка при выполнении запроса к', endpoint, ':', error);

    // Формируем структурированный ответ с ошибкой
    return {
      success: false,
      error: error?.message || 'Неизвестная ошибка при запросе к API',
      endpoint,
      method: options.method || 'GET',
      errorDetails: error instanceof Error ? {
        name: error.name,
        stack: error.stack?.split('\n').slice(0, 3).join('\n')
      } : String(error)
    };
  }
}

/**
 * Вспомогательные методы для различных HTTP методов
 */

/**
 * GET-запрос к API
 */
export function apiGet<T = any>(endpoint: string, options: Omit<ApiRequestOptions, 'method'> = {}): Promise<ApiResponse<T>> {
  return apiService<T>(endpoint, { ...options, method: 'GET' });
}

/**
 * POST-запрос к API
 */
export function apiPost<T = any>(endpoint: string, body: any, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
  return apiService<T>(endpoint, { ...options, method: 'POST', body });
}

/**
 * PUT-запрос к API
 */
export function apiPut<T = any>(endpoint: string, body: any, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
  return apiService<T>(endpoint, { ...options, method: 'PUT', body });
}

/**
 * DELETE-запрос к API
 */
export function apiDelete<T = any>(endpoint: string, options: Omit<ApiRequestOptions, 'method'> = {}): Promise<ApiResponse<T>> {
  return apiService<T>(endpoint, { ...options, method: 'DELETE' });
}

// Экспортируем централизованный метод как default
export default apiService;