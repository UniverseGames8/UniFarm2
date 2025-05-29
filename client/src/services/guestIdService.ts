/**
 * Сервис для работы с идентификацией пользователей на основе guest_id
 * 
 * Этап 10.4: Удаление временных прослоек между telegram_user_id и guest_id
 * Является основным сервисом для идентификации пользователей в приложении
 */

import { v4 as uuidv4 } from 'uuid';

// Ключи для локального хранилища
const STORAGE_KEYS = {
  GUEST_ID: 'unifarm_guest_id',       // Основной идентификатор пользователя
  REF_CODE: 'unifarm_ref_code',       // Реферальный код пользователя
  SESSION_DATA: 'unifarm_session'     // Данные о текущей сессии
};

/**
 * Получает guest_id из локального хранилища или создает новый
 * @returns {string} Уникальный идентификатор пользователя (guest_id)
 */
export function getGuestId(): string {
  try {
    // Проверяем наличие guest_id в localStorage
    const storedGuestId = localStorage.getItem(STORAGE_KEYS.GUEST_ID);
    
    if (storedGuestId) {
      console.log('[guestIdService] Использование существующего guest_id:', storedGuestId);
      return storedGuestId;
    }
    
    // Если guest_id не найден, создаем новый
    const newGuestId = uuidv4();
    console.log('[guestIdService] Создан новый guest_id:', newGuestId);
    
    // Сохраняем новый guest_id в localStorage
    localStorage.setItem(STORAGE_KEYS.GUEST_ID, newGuestId);
    
    return newGuestId;
  } catch (error) {
    console.error('[guestIdService] Ошибка при получении/создании guest_id:', error);
    
    // В случае ошибки генерируем временный ID
    const fallbackId = `fb-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    console.warn('[guestIdService] Используем временный fallback ID:', fallbackId);
    
    try {
      localStorage.setItem(STORAGE_KEYS.GUEST_ID, fallbackId);
    } catch (saveError) {
      console.error('[guestIdService] Не удалось сохранить fallback ID:', saveError);
    }
    
    return fallbackId;
  }
}

/**
 * Сохраняет guest_id в локальное хранилище
 * @param {string} guestId Идентификатор для сохранения
 * @returns {boolean} Результат операции сохранения
 */
export function saveGuestId(guestId: string): boolean {
  try {
    if (!guestId) {
      console.error('[guestIdService] Попытка сохранить пустой guest_id');
      return false;
    }
    
    // Сохраняем в localStorage
    localStorage.setItem(STORAGE_KEYS.GUEST_ID, guestId);
    console.log('[guestIdService] guest_id успешно сохранен:', guestId);
    
    return true;
  } catch (error) {
    console.error('[guestIdService] Ошибка при сохранении guest_id:', error);
    return false;
  }
}

/**
 * Проверяет наличие guest_id в локальном хранилище
 * @returns {boolean} true если guest_id существует
 */
export function hasGuestId(): boolean {
  try {
    const guestId = localStorage.getItem(STORAGE_KEYS.GUEST_ID);
    return !!guestId;
  } catch (error) {
    console.error('[guestIdService] Ошибка при проверке guest_id:', error);
    return false;
  }
}

/**
 * Сохраняет реферальный код пользователя
 * @param {string} refCode Реферальный код для сохранения
 */
export function saveRefCode(refCode: string): void {
  try {
    if (!refCode) {
      console.warn('[guestIdService] Попытка сохранить пустой реферальный код');
      return;
    }
    
    localStorage.setItem(STORAGE_KEYS.REF_CODE, refCode);
    console.log('[guestIdService] Реферальный код сохранен:', refCode);
  } catch (error) {
    console.error('[guestIdService] Ошибка при сохранении реферального кода:', error);
  }
}

/**
 * Получает сохраненный реферальный код пользователя
 * @returns {string | null} Реферальный код или null, если он не найден
 */
export function getRefCode(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.REF_CODE);
  } catch (error) {
    console.error('[guestIdService] Ошибка при получении реферального кода:', error);
    return null;
  }
}

/**
 * Сохраняет данные о текущей сессии пользователя
 * @param {Record<string, any>} sessionData Данные для сохранения
 */
export function saveSessionData(sessionData: Record<string, any>): void {
  try {
    if (!sessionData) {
      console.warn('[guestIdService] Попытка сохранить пустые данные сессии');
      return;
    }
    
    // Добавляем метку времени
    const dataToSave = {
      ...sessionData,
      timestamp: new Date().toISOString()
    };
    
    localStorage.setItem(STORAGE_KEYS.SESSION_DATA, JSON.stringify(dataToSave));
    console.log('[guestIdService] Данные сессии сохранены');
  } catch (error) {
    console.error('[guestIdService] Ошибка при сохранении данных сессии:', error);
  }
}

/**
 * Получает сохраненные данные сессии
 * @returns {Record<string, any> | null} Данные сессии или null, если они не найдены
 */
export function getSessionData(): Record<string, any> | null {
  try {
    const sessionDataStr = localStorage.getItem(STORAGE_KEYS.SESSION_DATA);
    if (!sessionDataStr) {
      return null;
    }
    
    return JSON.parse(sessionDataStr);
  } catch (error) {
    console.error('[guestIdService] Ошибка при получении данных сессии:', error);
    return null;
  }
}

/**
 * Очищает все данные идентификации пользователя
 * Используется при выходе из приложения или сбросе данных
 */
export function clearAllUserData(): void {
  try {
    console.log('[guestIdService] Очистка всех данных пользователя...');
    
    localStorage.removeItem(STORAGE_KEYS.GUEST_ID);
    localStorage.removeItem(STORAGE_KEYS.REF_CODE);
    localStorage.removeItem(STORAGE_KEYS.SESSION_DATA);
    
    // Очистка других возможных устаревших данных
    localStorage.removeItem('telegram_user_id');
    localStorage.removeItem('unifarm_user_data');
    
    console.log('[guestIdService] ✅ Все данные пользователя очищены');
  } catch (error) {
    console.error('[guestIdService] Ошибка при очистке данных пользователя:', error);
  }
}

// Экспортируем все функции как единый сервис для удобства импорта
const guestIdService = {
  getGuestId,
  saveGuestId,
  hasGuestId,
  saveRefCode,
  getRefCode,
  saveSessionData,
  getSessionData,
  clearAllUserData
};

export default guestIdService;