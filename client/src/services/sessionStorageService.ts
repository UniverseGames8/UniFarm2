/**
 * Сервис для централизованной и надежной работы с localStorage и sessionStorage
 * 
 * Обеспечивает единый интерфейс для сохранения и получения данных сессии,
 * с защитой от ошибок и резервным копированием критичных данных.
 */

/**
 * Константы для ключей хранилища
 */
export const SESSION_KEYS = {
  GUEST_ID: 'unifarm_guest_id',
  LAST_SESSION: 'unifarm_last_session',
  AUTH_TOKEN: 'unifarm_auth_token',
  TELEGRAM_READY: 'unifarm_telegram_ready'
};

/**
 * Типизация данных сессии пользователя
 */
export interface SessionData {
  user_id?: number;
  userId?: number; // Для обратной совместимости
  guest_id?: string;
  guestId?: string; // Для обратной совместимости
  username?: string;
  ref_code?: string;
  refCode?: string; // Для обратной совместимости
  timestamp?: string;
  telegram_id?: string | number;
  telegramId?: string | number; // Для обратной совместимости
}

/**
 * Проверяет доступность localStorage
 * @returns true если localStorage доступен
 */
const isLocalStorageAvailable = (): boolean => {
  try {
    const testKey = '__test_storage_availability__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    console.error('[SessionStorageService] localStorage недоступен:', e);
    return false;
  }
};

/**
 * Проверяет доступность sessionStorage
 * @returns true если sessionStorage доступен
 */
const isSessionStorageAvailable = (): boolean => {
  try {
    const testKey = '__test_storage_availability__';
    sessionStorage.setItem(testKey, testKey);
    sessionStorage.removeItem(testKey);
    return true;
  } catch (e) {
    console.error('[SessionStorageService] sessionStorage недоступен:', e);
    return false;
  }
};

/**
 * Сервис для работы с данными сессии в localStorage и sessionStorage
 */
const sessionStorageService = {
  /**
   * Сохраняет информацию о сессии
   * @param sessionData Данные сессии для сохранения
   * @returns true в случае успешного сохранения
   */
  saveSession(sessionData: SessionData): boolean {
    try {
      if (!sessionData) {
        console.error('[SessionStorageService] Попытка сохранить пустые данные сессии');
        return false;
      }
      
      // Нормализуем формат данных (поддерживаем обратную совместимость)
      const normalizedData: SessionData = {
        ...sessionData,
        user_id: sessionData.user_id || sessionData.userId,
        guest_id: sessionData.guest_id || sessionData.guestId,
        ref_code: sessionData.ref_code || sessionData.refCode,
        telegram_id: sessionData.telegram_id || sessionData.telegramId,
        timestamp: sessionData.timestamp || new Date().toISOString()
      };
      
      console.log('[SessionStorageService] Сохранение данных сессии:', 
        JSON.stringify({
          ...normalizedData,
          // Маскируем потенциально чувствительные данные в логах
          user_id: normalizedData.user_id ? 'установлен' : 'отсутствует',
          telegram_id: normalizedData.telegram_id ? 'установлен' : 'отсутствует'
        })
      );
      
      // Сохраняем данные в localStorage
      if (isLocalStorageAvailable()) {
        localStorage.setItem(SESSION_KEYS.LAST_SESSION, JSON.stringify(normalizedData));
        
        // Дополнительно сохраняем guest_id отдельно для надежности
        if (normalizedData.guest_id) {
          localStorage.setItem(SESSION_KEYS.GUEST_ID, normalizedData.guest_id);
        }
        
        console.log('[SessionStorageService] ✅ Данные сессии успешно сохранены в localStorage');
      } else {
        // Пробуем сохранить в sessionStorage как запасной вариант
        if (isSessionStorageAvailable()) {
          sessionStorage.setItem(SESSION_KEYS.LAST_SESSION, JSON.stringify(normalizedData));
          
          if (normalizedData.guest_id) {
            sessionStorage.setItem(SESSION_KEYS.GUEST_ID, normalizedData.guest_id);
          }
          
          console.log('[SessionStorageService] ✅ Данные сессии сохранены в sessionStorage (localStorage недоступен)');
        } else {
          console.error('[SessionStorageService] ❌ Не удалось сохранить данные сессии - хранилища недоступны');
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('[SessionStorageService] ❌ Ошибка при сохранении данных сессии:', error);
      
      // Попытка сохранить только самые важные данные в качестве аварийного сценария
      try {
        if (sessionData.guest_id && isLocalStorageAvailable()) {
          localStorage.setItem(SESSION_KEYS.GUEST_ID, sessionData.guest_id);
          console.log('[SessionStorageService] ✓ Сохранен только guest_id в аварийном режиме');
        } else if (sessionData.guest_id && isSessionStorageAvailable()) {
          sessionStorage.setItem(SESSION_KEYS.GUEST_ID, sessionData.guest_id);
          console.log('[SessionStorageService] ✓ Сохранен только guest_id в sessionStorage в аварийном режиме');
        }
      } catch (emergencyError) {
        console.error('[SessionStorageService] ❌ Критическая ошибка при аварийном сохранении guest_id:', emergencyError);
      }
      
      return false;
    }
  },
  
  /**
   * Получает информацию о сессии
   * @returns Данные сессии или null, если они отсутствуют или повреждены
   */
  getSession(): SessionData | null {
    try {
      // Пытаемся получить данные из localStorage
      let sessionData = null;
      
      if (isLocalStorageAvailable()) {
        const sessionDataStr = localStorage.getItem(SESSION_KEYS.LAST_SESSION);
        if (sessionDataStr) {
          try {
            sessionData = JSON.parse(sessionDataStr);
            console.log('[SessionStorageService] ✅ Данные сессии успешно получены из localStorage');
          } catch (parseError) {
            console.error('[SessionStorageService] Ошибка при разборе данных сессии из localStorage:', parseError);
          }
        }
      }
      
      // Если не удалось получить из localStorage, пробуем sessionStorage
      if (!sessionData && isSessionStorageAvailable()) {
        const sessionDataStr = sessionStorage.getItem(SESSION_KEYS.LAST_SESSION);
        if (sessionDataStr) {
          try {
            sessionData = JSON.parse(sessionDataStr);
            
            // Если нашли в sessionStorage, дублируем в localStorage для надежности
            if (sessionData && isLocalStorageAvailable()) {
              localStorage.setItem(SESSION_KEYS.LAST_SESSION, sessionDataStr);
              console.log('[SessionStorageService] Перенесли данные из sessionStorage в localStorage');
            }
            
            console.log('[SessionStorageService] ✅ Данные сессии получены из sessionStorage');
          } catch (parseError) {
            console.error('[SessionStorageService] Ошибка при разборе данных сессии из sessionStorage:', parseError);
          }
        }
      }
      
      // Если не нашли полные данные, пробуем собрать из отдельных ключей как аварийный вариант
      if (!sessionData) {
        const emergencyData: SessionData = {};
        let hasAnyData = false;
        
        // Пробуем получить guest_id
        const guestId = this.getGuestId();
        if (guestId) {
          emergencyData.guest_id = guestId;
          hasAnyData = true;
        }
        
        // Пробуем получить user_id из аварийного хранилища
        try {
          if (isLocalStorageAvailable()) {
            const userId = localStorage.getItem('user_id');
            if (userId) {
              emergencyData.user_id = parseInt(userId, 10);
              hasAnyData = true;
            }
          }
        } catch (e) {
          console.warn('[SessionStorageService] Не удалось получить user_id из аварийного хранилища');
        }
        
        if (hasAnyData) {
          console.log('[SessionStorageService] ✓ Восстановлены частичные данные сессии в аварийном режиме');
          return emergencyData;
        }
        
        console.log('[SessionStorageService] ❌ Не удалось найти данные сессии');
        return null;
      }
      
      return sessionData;
    } catch (error) {
      console.error('[SessionStorageService] ❌ Критическая ошибка при получении данных сессии:', error);
      return null;
    }
  },
  
  /**
   * Получает guest_id пользователя
   * @returns guest_id или null, если он не найден
   */
  getGuestId(): string | null {
    try {
      // Проверяем наличие guest_id в localStorage (приоритетный источник)
      if (isLocalStorageAvailable()) {
        const guestId = localStorage.getItem(SESSION_KEYS.GUEST_ID);
        if (guestId) {
          console.log('[SessionStorageService] ✅ guest_id получен из localStorage');
          return guestId;
        }
      }
      
      // Проверяем наличие guest_id в sessionStorage (запасной вариант)
      if (isSessionStorageAvailable()) {
        const guestId = sessionStorage.getItem(SESSION_KEYS.GUEST_ID);
        if (guestId) {
          console.log('[SessionStorageService] ✅ guest_id получен из sessionStorage');
          
          // Если нашли в sessionStorage, дублируем в localStorage для надежности
          if (isLocalStorageAvailable()) {
            localStorage.setItem(SESSION_KEYS.GUEST_ID, guestId);
            console.log('[SessionStorageService] Перенесли guest_id из sessionStorage в localStorage');
          }
          
          return guestId;
        }
      }
      
      // Если не нашли в отдельных ключах, пробуем извлечь из полных данных сессии
      const sessionData = this.getSession();
      if (sessionData && (sessionData.guest_id || sessionData.guestId)) {
        const foundGuestId = sessionData.guest_id || sessionData.guestId || null;
        if (foundGuestId) {
          console.log('[SessionStorageService] ✅ guest_id извлечен из данных сессии');
          
          // Сохраняем отдельно для удобства в будущем
          if (isLocalStorageAvailable()) {
            localStorage.setItem(SESSION_KEYS.GUEST_ID, foundGuestId);
          }
          
          return foundGuestId;
        }
      }
      
      console.log('[SessionStorageService] ❌ guest_id не найден ни в одном из хранилищ');
      return null;
    } catch (error) {
      console.error('[SessionStorageService] ❌ Ошибка при получении guest_id:', error);
      return null;
    }
  },
  
  /**
   * Сохраняет guest_id
   * @param guestId Идентификатор гостя для сохранения
   * @returns true в случае успешного сохранения
   */
  saveGuestId(guestId: string): boolean {
    try {
      if (!guestId) {
        console.error('[SessionStorageService] Попытка сохранить пустой guest_id');
        return false;
      }
      
      console.log('[SessionStorageService] Сохранение guest_id:', guestId);
      
      // Сохраняем guest_id в localStorage (основное хранилище)
      if (isLocalStorageAvailable()) {
        localStorage.setItem(SESSION_KEYS.GUEST_ID, guestId);
        console.log('[SessionStorageService] ✅ guest_id успешно сохранен в localStorage');
      } else {
        console.warn('[SessionStorageService] localStorage недоступен');
      }
      
      // Дублируем guest_id в sessionStorage для надежности
      if (isSessionStorageAvailable()) {
        sessionStorage.setItem(SESSION_KEYS.GUEST_ID, guestId);
        console.log('[SessionStorageService] ✅ guest_id продублирован в sessionStorage');
      } else {
        console.warn('[SessionStorageService] sessionStorage недоступен');
      }
      
      // Обновляем guest_id в данных сессии, если они существуют
      const sessionData = this.getSession();
      if (sessionData) {
        sessionData.guest_id = guestId;
        this.saveSession(sessionData);
        console.log('[SessionStorageService] ✅ guest_id обновлен в данных сессии');
      }
      
      return true;
    } catch (error) {
      console.error('[SessionStorageService] ❌ Ошибка при сохранении guest_id:', error);
      return false;
    }
  },
  
  /**
   * Очищает информацию о сессии
   * @param preserveGuestId Если true, то guest_id не будет удален
   * @returns true в случае успешной очистки
   */
  clearSession(preserveGuestId: boolean = false): boolean {
    try {
      console.log('[SessionStorageService] Очистка данных сессии, сохранять guest_id:', preserveGuestId);
      
      // Сохраняем guest_id, если нужно
      let guestId = null;
      if (preserveGuestId) {
        guestId = this.getGuestId();
      }
      
      // Очищаем данные в localStorage
      if (isLocalStorageAvailable()) {
        localStorage.removeItem(SESSION_KEYS.LAST_SESSION);
        if (!preserveGuestId) {
          localStorage.removeItem(SESSION_KEYS.GUEST_ID);
        }
        console.log('[SessionStorageService] ✅ Данные очищены из localStorage');
      }
      
      // Очищаем данные в sessionStorage
      if (isSessionStorageAvailable()) {
        sessionStorage.removeItem(SESSION_KEYS.LAST_SESSION);
        if (!preserveGuestId) {
          sessionStorage.removeItem(SESSION_KEYS.GUEST_ID);
        }
        console.log('[SessionStorageService] ✅ Данные очищены из sessionStorage');
      }
      
      // Восстанавливаем guest_id, если нужно
      if (preserveGuestId && guestId) {
        this.saveGuestId(guestId);
        console.log('[SessionStorageService] ✅ guest_id восстановлен после очистки');
      }
      
      return true;
    } catch (error) {
      console.error('[SessionStorageService] ❌ Ошибка при очистке данных сессии:', error);
      return false;
    }
  },
  
  /**
   * Получает идентификатор пользователя из сессии
   * @returns ID пользователя или null, если он не найден
   */
  getUserId(): number | null {
    try {
      const sessionData = this.getSession();
      if (sessionData && (sessionData.user_id || sessionData.userId)) {
        const userId = sessionData.user_id || sessionData.userId || null;
        if (userId !== null && userId !== undefined) {
          console.log('[SessionStorageService] ✅ user_id получен из данных сессии');
          return typeof userId === 'string' ? parseInt(userId, 10) : userId;
        }
      }
      
      // Пробуем получить user_id из аварийного хранилища
      if (isLocalStorageAvailable()) {
        const userId = localStorage.getItem('user_id');
        if (userId) {
          try {
            const parsedUserId = parseInt(userId, 10);
            console.log('[SessionStorageService] ✅ user_id получен из аварийного хранилища');
            return parsedUserId;
          } catch (parseError) {
            console.warn('[SessionStorageService] Ошибка при разборе user_id из аварийного хранилища:', parseError);
          }
        }
      }
      
      console.log('[SessionStorageService] ❌ user_id не найден');
      return null;
    } catch (error) {
      console.error('[SessionStorageService] ❌ Ошибка при получении user_id:', error);
      return null;
    }
  }
};

export default sessionStorageService;