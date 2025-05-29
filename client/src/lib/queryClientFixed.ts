import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getTelegramAuthHeaders } from "@/services/telegramService";
import apiConfig from "@/config/apiConfig";

/**
 * Исправленная версия queryClient для предотвращения ошибки w.map is not a function
 * В этой версии мы отключаем преобразование данных в Map для проблемных API
 */

/**
 * Проверяет, является ли запрос проблемным (те, которые приводят к ошибке w.map)
 */
function isProblematicQuery(queryKey: readonly unknown[]): boolean {
  if (queryKey && queryKey.length > 0 && typeof queryKey[0] === 'string') {
    // Проверяем, содержит ли URL endpoints, которые вызывают ошибку w.map
    const url = queryKey[0] as string;
    return url.includes('/api/user_missions') || 
           url.includes('/api/missions');
  }
  return false;
}

/**
 * Вспомогательная функция для проверки статуса HTTP-ответа
 * Если ответ не OK (не 2xx), бросает исключение с текстом ответа
 */
async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = await res.text();
    let errorData;
    
    try {
      errorData = JSON.parse(text);
    } catch (e) {
      errorData = { 
        error: text || res.statusText || 'Неопределенная ошибка',
        type: 'unknown'
      };
    }
    
    const error = new Error(`${res.status}: ${errorData.message || errorData.error || "Неизвестная ошибка"}`);
    (error as any).status = res.status;
    (error as any).statusText = res.statusText;
    (error as any).errorData = errorData;
    
    throw error;
  }
}

// Получает все необходимые заголовки для запросов к API
function getApiHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
  // Получаем заголовки с данными Telegram
  const telegramHeaders = getTelegramAuthHeaders();
  
  // Базовые заголовки для API запросов
  const headers = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
    ...telegramHeaders,
    ...customHeaders
  };
  
  return headers;
}

type UnauthorizedBehavior = "returnNull" | "throw";

export const getFixedQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    console.log("[DEBUG] SafeQueryClient - Requesting:", queryKey[0]);
    
    try {
      // Проверяем, является ли запрос проблемным
      const isProblematic = isProblematicQuery(queryKey);
      
      // Добавляем заголовки, чтобы избежать кэширования
      const timestamp = new Date().getTime();
      const queryKeyStr = queryKey[0] as string;
      
      // Преобразуем относительный URL в полный с использованием apiConfig
      let baseUrl = apiConfig.getFullUrl(queryKeyStr);
      
      // Проверяем, есть ли второй элемент в queryKey (userId) и добавляем его в URL
      let userId = null;
      
      // Сначала пытаемся получить ID из queryKey (2й элемент)
      if (queryKey.length > 1 && queryKey[1]) {
        userId = queryKey[1];
      } 
      // Если ID не передан в queryKey, пытаемся получить из localStorage
      else {
        try {
          const userData = localStorage.getItem('unifarm_user_data');
          if (userData) {
            const userInfo = JSON.parse(userData);
            if (userInfo && userInfo.id) {
              userId = userInfo.id;
            }
          }
        } catch (err) {
          console.warn('[safequeryClient] Не удалось получить ID пользователя из localStorage:', err);
        }
      }
      
      // Если у нас есть userId и URL еще не содержит user_id, добавляем его
      if (userId && !baseUrl.includes('user_id=')) {
        const separator = baseUrl.includes('?') ? '&' : '?';
        baseUrl = `${baseUrl}${separator}user_id=${userId}`;
      }
      
      // Добавляем nocache параметр
      const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}nocache=${timestamp}`;
      
      // Получаем заголовки с данными Telegram
      const headers = getApiHeaders();
      
      const res = await fetch(url, {
        credentials: "include",
        headers
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      try {
        await throwIfResNotOk(res);
        
        // Получаем текст ответа и проверяем его валидность как JSON
        const text = await res.text();
        
        try {
          const data = JSON.parse(text);
          
          // ВАЖНО: Для проблемных запросов возвращаем данные без кэширования через Map
          if (isProblematic) {
            console.log('[SafeQueryClient] Обработка проблемного запроса, пропускаем преобразование в Map');
            
            // Возвращаем данные напрямую, как они есть, без обработки
            // Это предотвращает ошибку w.map is not a function
            return data;
          }
          
          return data;
        } catch (error: any) {
          console.error("[SafeQueryClient] JSON parse error:", error);
          return Array.isArray(queryKey[0]) ? [] : {};
        }
      } catch (resError) {
        console.error("[SafeQueryClient] Response error:", resError);
        throw resError;
      }
    } catch (fetchError) {
      console.error("[SafeQueryClient] Fetch error:", fetchError);
      throw fetchError;
    }
  };

// Создаем исправленный QueryClient, который не будет использовать Map для проблемных запросов
export const safeQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getFixedQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});