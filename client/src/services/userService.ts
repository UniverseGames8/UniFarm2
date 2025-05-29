import { apiRequest } from "@/lib/queryClient";
import { getCachedTelegramUserId } from "@/services/telegramService";
import apiConfig from "@/config/apiConfig";
import { correctApiRequest } from "@/lib/correctApiRequest";

/**
 * Интерфейс пользователя, возвращаемый API
 */
export interface User {
  id: number;
  telegram_id: number | null;
  username: string;
  balance_uni: string;
  balance_ton: string;
  ref_code: string; // Реферальный код пользователя всегда должен быть определен
  guest_id: string; // Идентификатор гостя
  created_at?: string;
  parent_ref_code?: string | null;
}

/**
 * Интерфейс ошибки, который может вернуть API
 */
export interface ApiError {
  hasError: boolean;
  message: string;
  code?: string;
  details?: any;
}

/**
 * Ключ для хранения данных пользователя в localStorage
 */
const USER_DATA_STORAGE_KEY = 'unifarm_user_data';

/**
 * Определяем, находимся ли мы в режиме разработки
 */
const IS_DEV = process.env.NODE_ENV === 'development';

/**
 * Максимальное время хранения кэша пользователя (1 час)
 */
const CACHE_TTL = 60 * 60 * 1000;

/**
 * Класс для работы с API запросами, связанными с пользователями
 */
class UserService {
  /**
   * Регистрирует пользователя в режиме AirDrop без требования данных Telegram
   * Используется как альтернативный способ регистрации для максимальной доступности
   * @returns {Promise<{success: boolean, data?: any}>} Результат операции и данные пользователя
   */
  async registerInAirDropMode(): Promise<{success: boolean, data?: any}> {
    console.log('[UserService] Запуск регистрации в режиме AirDrop...');
    
    try {
      // Генерируем временный ID на основе timestamp с некоторой случайностью
      // для избежания коллизий при одновременной регистрации
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 10000);
      const tempId = Math.floor(timestamp / 1000) * 10000 + random;
      const username = `airdrop_user_${tempId}`;
      
      console.log(`[UserService] AirDrop: Сгенерирован временный ID: ${tempId} для пользователя ${username}`);
      
      // Импортируем GuestIdService для получения guest_id
      const { getGuestId } = await import('./guestIdService');
      
      // Получаем guest_id из localStorage или создаем новый
      const guestId = getGuestId();
      
      console.log(`[UserService] AirDrop: Используем guest_id: ${guestId}`);
      
      // Импортируем referralService для получения реферального кода
      const { referralService } = await import('./referralService');
      
      // Получаем реферальный код из URL или локального хранилища
      const referralCode = referralService.getReferralCodeForRegistration();
      
      if (referralCode) {
        console.log(`[UserService] AirDrop: Используем реферальный код: ${referralCode}`);
      } else {
        console.log('[UserService] AirDrop: Реферальный код не найден');
      }
      
      // Формируем полный URL для запроса
      const url = apiConfig.getFullUrl('/api/v2/airdrop/register');
      console.log(`[UserService] AirDrop: Отправка запроса по URL: ${url}`);
      
      // Отправляем запрос на регистрацию в режиме AirDrop с использованием correctApiRequest
      console.log('[UserService] Используем correctApiRequest для запроса в режиме AirDrop');
      
      // correctApiRequest обрабатывает заголовки, преобразование JSON и анализ ответов автоматически
      const result = await correctApiRequest(url, 'POST', {
        guest_id: guestId, // Передаем guest_id, который будет основным идентификатором
        username: username,
        ref_code: referralCode, // Передаем реферальный код через параметр ref_code
        airdrop_mode: true // Явно указываем, что это режим AirDrop
      });
        
      console.log('[UserService] Успешная регистрация в режиме AirDrop. Данные:', result);
      
      // Проверяем, есть ли данные пользователя в ответе
      if (result && result.data) {
        // Проверяем наличие реферального кода в ответе
        if (result.data.ref_code) {
          console.log('[UserService] Получен реферальный код:', result.data.ref_code);
        } else {
          console.warn('[UserService] Реферальный код отсутствует в ответе от сервера');
        }
        
        console.log('[UserService] Кэширование данных пользователя:', result.data);
        
        // Сохраняем данные пользователя в кэш
        this.cacheUserData(result.data);
        
        // Возвращаем успешный результат и данные
        return { 
          success: true, 
          data: result.data 
        };
      } else {
        console.error('[UserService] В ответе отсутствуют данные пользователя:', result);
        return { 
          success: false,
          data: { error: 'Некорректный ответ сервера, отсутствуют данные пользователя' }
        };
      }
    } catch (error: any) {
      console.error('[UserService] Ошибка при регистрации в режиме AirDrop:', error);
      
      // correctApiRequest уже предоставляет структурированную ошибку
      return { 
        success: false, 
        data: { 
          error: error.message || 'Неизвестная ошибка при регистрации',
          details: error.details || error
        }
      };
    }
  }
  /**
   * Получает информацию о текущем пользователе с оптимизированной обработкой ошибок
   * @param {boolean} [forceReload=false] - Если true, игнорирует кэш и делает новый запрос
   * @returns {Promise<User>} Данные текущего пользователя
   * @throws {Error} Если не удалось получить данные пользователя
   */
  async getCurrentUser(forceReload: boolean = false): Promise<User> {
    console.log(`[UserService] Getting current user, forceReload: ${forceReload}`);
    
    try {
      // Шаг 1: Проверяем кэшированные данные пользователя, если не требуется принудительная перезагрузка
      if (!forceReload) {
        const cachedUserData = this.getCachedUserData();
        if (cachedUserData && this.isValidCachedData(cachedUserData)) {
          console.log('[UserService] Using cached user data:', { id: cachedUserData.id });
          
          // Даже если используем кэш, делаем фоновый запрос для обновления данных
          this.refreshUserDataInBackground();
          
          return cachedUserData;
        }
      }
      
      // Шаг 2: Запрашиваем данные с сервера
      console.log('[UserService] Requesting user data from API');
      const data = await this.fetchUserFromApi();
      
      // Лог успешного результата
      console.log('[UserService] Successfully got user data, ID:', data.id);
      
      return data;
    } catch (error) {
      console.error('[UserService] Error fetching current user:', error);
      
      // Шаг 3: Попытка восстановления из кэша в случае ошибки
      const cachedUserData = this.getCachedUserData();
      if (cachedUserData) {
        console.warn('[UserService] Fallback to cached user data due to API error');
        return cachedUserData;
      }
      
      // Шаг 4: В режиме разработки пробуем получить тестовые данные с сервера
      if (IS_DEV) {
        try {
          console.warn('[UserService] In DEV mode, trying to get user data');
          return await this.fetchDevUserFromApi();
        } catch (devError) {
          console.error('[UserService] Error fetching DEV user:', devError);
        }
      }
      
      // Шаг 5: Если все предыдущие шаги не удались - пробрасываем ошибку
      console.error('[UserService] All recovery methods failed');
      throw new Error(`Failed to get user data: ${(error as Error)?.message || 'Unknown error'}`);
    }
  }
  
  /**
   * Выполняет запрос к API для получения данных пользователя
   * Этап 10.4: Убрана зависимость от telegram_id, используем только guest_id
   * @returns {Promise<User>} Данные пользователя из API
   * @private
   */
  private async fetchUserFromApi(): Promise<User> {
    // Импортируем guestIdService для получения guest_id
    const { getGuestId } = await import('./guestIdService');
    const guestId = getGuestId();
    
    console.log('[UserService] Запрос к API с guest_id:', guestId);
    console.log('[UserService] Объект localStorage в момент запроса к /api/me:', 
      Object.keys(localStorage).map(key => `${key}: ${localStorage.getItem(key)?.substring(0, 20)}...`));
    
    // Проверяем состояние сессии в момент запроса
    if (sessionStorage.getItem('unifarm_telegram_ready') === 'true') {
      console.log('[UserService] Telegram WebApp отмечен как инициализированный при запросе /api/me');
    } else {
      console.warn('[UserService] Telegram WebApp НЕ отмечен как инициализированный при запросе /api/me!');
    }
    
    try {
      // Делаем запрос к API, используя correctApiRequest
      console.log('[UserService] Используем correctApiRequest для запроса /api/me');
      const data = await correctApiRequest('/api/v2/me', 'GET');
      
      // Подробный лог для отладки
      console.log('[UserService] API /me result:', {
        success: data?.success,
        userId: data?.data?.id,
        username: data?.data?.username,
        guestId: data?.data?.guest_id,
        refCode: data?.data?.ref_code || 'НЕ ОПРЕДЕЛЕН',
        hasRefCode: !!data?.data?.ref_code,
        telegramId: data?.data?.telegram_id,
        responseJson: JSON.stringify(data).substring(0, 200) + '...'
      });
      
      // Если API не вернул данные, выдаем ошибку 
      if (!data || !data.success || !data.data) {
        console.error('[UserService] Invalid API response from server:', data);
        throw new Error('Invalid response from server');
      }
      
      // Проверяем и фиксируем поля с типами данных, если это необходимо
      const userData = {
        ...data.data,
        id: Number(data.data.id),
        telegram_id: data.data.telegram_id !== undefined ? 
          (data.data.telegram_id === null ? null : Number(data.data.telegram_id)) : null,
        balance_uni: String(data.data.balance_uni || "0"),
        balance_ton: String(data.data.balance_ton || "0"),
        ref_code: String(data.data.ref_code || ""),
        guest_id: String(data.data.guest_id || "")
      };
      
      // Валидируем и кэшируем полученные данные
      if (this.isValidUserData(userData)) {
        this.cacheUserData(userData);
        return userData;
      } else {
        console.error('[UserService] Data validation failed after type correction:', userData);
        throw new Error('Invalid user data structure received from API');
      }
    } catch (error) {
      console.error('[UserService] Error in fetchUserFromApi:', error);
      throw error;
    }
  }
  
  /**
   * Запрашивает данные пользователя в фоновом режиме для обновления кэша
   * @private
   */
  private async refreshUserDataInBackground(): Promise<void> {
    try {
      console.log('[UserService] Refreshing user data in background');
      const data = await this.fetchUserFromApi();
      this.cacheUserData(data);
      console.log('[UserService] Background refresh completed, new data cached');
    } catch (error) {
      console.warn('[UserService] Background refresh failed:', error);
      // Игнорируем ошибки, т.к. это фоновое обновление
    }
  }
  
  /**
   * Проверяет валидность структуры данных пользователя
   * @param data Данные пользователя для проверки
   * @returns {boolean} True если данные валидны, false в противном случае
   * @private
   */
  private isValidUserData(data: any): data is User {
    const isValid = (
      data &&
      typeof data.id === 'number' &&
      data.id > 0 &&
      (typeof data.telegram_id === 'number' || typeof data.telegram_id === 'string' || data.telegram_id === null) &&
      typeof data.username === 'string' &&
      typeof data.balance_uni === 'string' &&
      typeof data.balance_ton === 'string' &&
      typeof data.ref_code === 'string' // Добавлена проверка на ref_code
    );
    
    // Подробный лог для отладки валидации данных
    if (!isValid && data) {
      console.warn('[UserService] Invalid user data structure:', {
        hasId: typeof data.id === 'number',
        idIsPositive: data.id > 0,
        hasTelegramId: typeof data.telegram_id === 'number' || typeof data.telegram_id === 'string' || data.telegram_id === null,
        telegramIdValue: data.telegram_id,
        hasUsername: typeof data.username === 'string',
        hasBalanceUni: typeof data.balance_uni === 'string',
        hasBalanceTon: typeof data.balance_ton === 'string',
        hasRefCode: typeof data.ref_code === 'string',
        refCodeValue: data.ref_code || 'missing',
        rawData: data
      });
    }
    
    return isValid;
  }
  
  /**
   * Проверяет актуальность кэшированных данных
   * @param data Кэшированные данные пользователя
   * @returns {boolean} True если данные актуальны, false в противном случае
   * @private
   */
  private isValidCachedData(data: any): boolean {
    if (!data || !data._cacheTimestamp) {
      return false;
    }
    
    // Проверяем, не устарел ли кэш (1 час)
    const cacheAge = Date.now() - data._cacheTimestamp;
    return cacheAge < CACHE_TTL;
  }
  
  /**
   * Сохраняет данные пользователя в кэш
   * @param userData Данные пользователя для кэширования
   */
  cacheUserData(userData: User): void {
    try {
      // Добавляем метку времени для контроля актуальности кэша
      const dataToCache = {
        ...userData,
        _cacheTimestamp: Date.now()
      };
      
      localStorage.setItem(USER_DATA_STORAGE_KEY, JSON.stringify(dataToCache));
      console.log('[UserService] User data cached successfully:', { id: userData.id });
    } catch (error) {
      console.error('[UserService] Error caching user data:', error);
    }
  }
  
  /**
   * Получает кэшированные данные пользователя
   * @returns {User | null} Кэшированные данные пользователя или null
   * @private
   */
  private getCachedUserData(): User | null {
    try {
      const cachedDataStr = localStorage.getItem(USER_DATA_STORAGE_KEY);
      if (!cachedDataStr) {
        return null;
      }
      
      const cachedData = JSON.parse(cachedDataStr);
      if (this.isValidUserData(cachedData)) {
        return cachedData;
      }
      return null;
    } catch (error) {
      console.warn('[UserService] Error reading cached user data:', error);
      return null;
    }
  }
  
  /**
   * Получает данные тестового пользователя в режиме разработки
   * @returns {Promise<User>} Данные тестового пользователя
   * @private
   */
  private async fetchDevUserFromApi(): Promise<User> {
    try {
      console.log('[UserService] Используем correctApiRequest для запроса dev-пользователя');
      const devData = await correctApiRequest('/api/v2/users/1', 'GET');
      if (devData.success && devData.data && this.isValidUserData(devData.data)) {
        console.log('[UserService] Successfully got DEV user data from API:', { id: devData.data.id });
        return devData.data;
      } else {
        throw new Error('Invalid dev user data structure');
      }
    } catch (error) {
      console.error('[UserService] Error fetching DEV user:', error);
      throw error;
    }
  }
  
  /**
   * Генерирует уникальный реферальный код для пользователя
   * @returns {Promise<string>} Сгенерированный реферальный код
   * @throws {Error} Если не удалось сгенерировать код
   */
  async generateRefCode(): Promise<string> {
    try {
      console.log('[UserService] Запрос на генерацию реферального кода');
      
      // Получаем текущие данные пользователя
      const currentUser = await this.getCurrentUser();
      
      // Проверяем, есть ли уже реферальный код
      if (currentUser.ref_code) {
        console.log(`[UserService] У пользователя уже есть реферальный код: ${currentUser.ref_code}`);
        return currentUser.ref_code;
      }
      
      // Подготавливаем параметры запроса
      const requestData = {
        user_id: currentUser.id
      };
      
      // Делаем запрос к серверу для генерации кода с использованием correctApiRequest
      console.log('[UserService] Используем correctApiRequest для генерации реферального кода');
      const response = await correctApiRequest('/api/v2/users/generate-refcode', 'POST', requestData);
      
      if (response.success && response.data) {
        console.log('[UserService] Успешно получен реферальный код:', response.data);
        
        // Теперь response.data содержит полные данные пользователя с новым ref_code
        // Обновляем кэш пользователя
        this.cacheUserData(response.data);
        
        // Оповещаем UI о изменении данных пользователя
        window.dispatchEvent(new CustomEvent('user:updated', { detail: response.data }));
        
        // Возвращаем только реферальный код
        return response.data.ref_code;
      } else {
        console.error('[UserService] Ошибка при получении реферального кода:', response);
        throw new Error('Не удалось получить реферальный код');
      }
    } catch (error) {
      console.error('[UserService] Ошибка при генерации реферального кода:', error);
      throw error;
    }
  }
  
  /**
   * Получает пользователя по guest_id
   * @param {string} guestId Уникальный идентификатор гостя
   * @returns {Promise<User | null>} Данные пользователя или null, если пользователь не найден
   */
  async getUserByGuestId(guestId: string): Promise<User | null> {
    try {
      if (!guestId) {
        console.error('[UserService] Невозможно получить пользователя: отсутствует guest_id');
        return null;
      }
      
      console.log(`[UserService] Запрос пользователя по guest_id: ${guestId}`);
      
      // Отправляем запрос к API для получения пользователя по guest_id, используя correctApiRequest
      // ВАЖНО: URL на сервере ожидает guest_id, а не guestId в параметре пути
      console.log('[UserService] Используем correctApiRequest для запроса по guest_id');
      const response = await correctApiRequest(`/api/v2/users/guest/${guestId}?user_id=1`, 'GET', null, {
        additionalLogging: true,
        errorHandling: {
          report404: true, // Логировать 404 ошибки
          detailed: true   // Подробное логирование ошибок
        }
      });
      
      if (response.success && response.data) {
        console.log('[UserService] Успешно получен пользователь по guest_id:', response.data);
        
        // Сохраняем данные пользователя в кэш
        this.cacheUserData(response.data);
        
        return response.data;
      } else {
        console.log('[UserService] Пользователь с guest_id не найден:', guestId);
        return null;
      }
    } catch (error) {
      console.error('[UserService] Ошибка при получении пользователя по guest_id:', error);
      return null;
    }
  }

  /**
   * Очищает кэш данных пользователя
   */
  clearUserCache(): void {
    localStorage.removeItem(USER_DATA_STORAGE_KEY);
    // Для обратной совместимости удаляем и по старому ключу
    localStorage.removeItem('unifarm_user_id');
    console.log('[UserService] User data cache cleared');
  }
  
  /**
   * Проверяет наличие реального пользовательского ID
   * @returns {Promise<boolean>} True если есть реальный ID пользователя
   */
  async hasRealUserId(): Promise<boolean> {
    console.log('[UserService] Checking for real user ID...');
    
    try {
      // С Этапа 10.3 Telegram WebApp больше не используется
      console.warn('[UserService] Telegram WebApp проверки отключены (Этап 10.3)');
      
      // Этап 10.4: Удалены проверки Telegram ID - больше не поддерживаются
      console.log('[UserService] Telegram ID проверки пропущены (Этап 10.4)');
      // Всегда переходим к проверке данных пользователя
      
      // Шаг 3: Проверка кэшированных данных пользователя
      const cachedData = this.getCachedUserData();
      if (cachedData && cachedData.id > 0 && cachedData.id !== 1) {
        console.log('[UserService] Found real user ID from cached user data:', cachedData.id);
        return true;
      } else if (cachedData) {
        console.warn('[UserService] Cached user data available but ID is invalid:', cachedData.id);
      } else {
        console.warn('[UserService] No cached user data available');
      }
      
      // Шаг 4: Пробуем получить данные с сервера
      console.log('[UserService] Attempting to get real user ID from API');
      try {
        const userData = await this.fetchUserFromApi();
        const isValid = userData && userData.id > 0 && userData.id !== 1;
        
        if (isValid) {
          console.log('[UserService] Successfully retrieved valid user ID from API:', userData.id);
          return true;
        } else {
          console.warn('[UserService] API returned invalid user ID:', userData?.id);
          return false;
        }
      } catch (error) {
        console.error('[UserService] Error getting user data from API:', error);
        return false;
      }
    } catch (error) {
      console.error('[UserService] Unexpected error in hasRealUserId:', error);
      return false;
    }
  }
}

export default new UserService();