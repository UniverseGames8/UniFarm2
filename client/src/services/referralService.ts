/**
 * Сервис для обработки реферальных ссылок и кодов
 * 
 * Этот сервис отвечает за:
 * 1. Извлечение реферального кода из URL (параметр ref_code или устаревший startapp)
 * 2. Проверку валидности реферального кода
 * 3. Сохранение реферального кода в локальное хранилище
 * 4. Применение реферального кода при создании новых пользователей
 */

import guestIdService from './guestIdService';

// Ключ для хранения реферального кода в локальном хранилище
const REFERRAL_CODE_KEY = 'unifarm_referral_code';

// Максимальное время хранения реферального кода в локальном хранилище (24 часа)
const REFERRAL_CODE_TTL = 24 * 60 * 60 * 1000;

// Интерфейс для хранения реферального кода с временной меткой
interface StoredReferralCode {
  code: string;
  timestamp: number;
}

class ReferralService {
  /**
   * Извлекает реферальный код из URL (параметр ref_code или устаревший startapp)
   * @returns Реферальный код из URL или null, если его нет
   */
  getRefCodeFromUrl(): string | null {
    try {
      // Получаем текущий URL
      const url = new URL(window.location.href);
      
      // Сначала проверяем наличие параметра ref_code (новый формат)
      const refCode = url.searchParams.get('ref_code');
      if (refCode) {
        console.log(`[ReferralService] Извлечение параметра ref_code из URL: ${refCode}`);
        return refCode;
      }
      
      // Для обратной совместимости проверяем наличие параметра startapp (старый формат)
      const startapp = url.searchParams.get('startapp');
      if (startapp) {
        console.log(`[ReferralService] Извлечение устаревшего параметра startapp из URL: ${startapp}`);
        return startapp;
      }
      
      console.log('[ReferralService] Реферальный код в URL не найден');
      return null;
    } catch (error) {
      console.error('[ReferralService] Ошибка при извлечении реферального кода из URL:', error);
      return null;
    }
  }
  
  /**
   * Проверяет, является ли строка допустимым реферальным кодом
   * @param code Строка для проверки
   * @returns true, если строка является допустимым реферальным кодом
   */
  isValidRefCode(code: string | null): boolean {
    if (!code) return false;
    
    // Проверяем, что код состоит только из допустимых символов (буквы и цифры)
    // и имеет допустимую длину (от 6 до 16 символов)
    const isValid = /^[a-zA-Z0-9]{6,16}$/.test(code);
    
    console.log(`[ReferralService] Проверка валидности реферального кода "${code}": ${isValid ? 'валидный' : 'невалидный'}`);
    
    return isValid;
  }
  
  /**
   * Сохраняет реферальный код в локальное хранилище
   * @param code Реферальный код для сохранения
   */
  saveRefCode(code: string): void {
    try {
      if (!this.isValidRefCode(code)) {
        console.warn(`[ReferralService] Попытка сохранить невалидный реферальный код: ${code}`);
        return;
      }
      
      // Сохраняем код вместе с временной меткой
      const data: StoredReferralCode = {
        code,
        timestamp: Date.now()
      };
      
      localStorage.setItem(REFERRAL_CODE_KEY, JSON.stringify(data));
      
      console.log(`[ReferralService] Реферальный код "${code}" сохранен в локальное хранилище`);
    } catch (error) {
      console.error('[ReferralService] Ошибка при сохранении реферального кода:', error);
    }
  }
  
  /**
   * Получает сохраненный реферальный код из локального хранилища
   * @returns Реферальный код или null, если его нет или он устарел
   */
  getSavedRefCode(): string | null {
    try {
      const storedData = localStorage.getItem(REFERRAL_CODE_KEY);
      
      if (!storedData) {
        console.log('[ReferralService] В локальном хранилище нет сохраненного реферального кода');
        return null;
      }
      
      const data: StoredReferralCode = JSON.parse(storedData);
      
      // Проверяем, не устарел ли код
      const now = Date.now();
      if (now - data.timestamp > REFERRAL_CODE_TTL) {
        console.log('[ReferralService] Сохраненный реферальный код устарел и будет удален');
        localStorage.removeItem(REFERRAL_CODE_KEY);
        return null;
      }
      
      console.log(`[ReferralService] Получен сохраненный реферальный код: ${data.code}`);
      
      return data.code;
    } catch (error) {
      console.error('[ReferralService] Ошибка при получении сохраненного реферального кода:', error);
      return null;
    }
  }
  
  /**
   * Удаляет сохраненный реферальный код из локального хранилища
   */
  clearSavedRefCode(): void {
    try {
      localStorage.removeItem(REFERRAL_CODE_KEY);
      console.log('[ReferralService] Сохраненный реферальный код удален из локального хранилища');
    } catch (error) {
      console.error('[ReferralService] Ошибка при удалении сохраненного реферального кода:', error);
    }
  }
  
  /**
   * Инициализирует обработку реферальных кодов при загрузке приложения
   * Извлекает код из URL и сохраняет его в локальное хранилище
   */
  initialize(): void {
    console.log('[ReferralService] Инициализация...');
    
    // Проверяем, есть ли в URL реферальный код (ref_code или устаревший startapp)
    const refCodeFromUrl = this.getRefCodeFromUrl();
    
    if (refCodeFromUrl && this.isValidRefCode(refCodeFromUrl)) {
      console.log(`[ReferralService] Найден валидный реферальный код в URL: ${refCodeFromUrl}`);
      
      // Сохраняем его в локальное хранилище
      this.saveRefCode(refCodeFromUrl);
      
      // Логируем событие для аналитики
      console.log(`[АУДИТ] Обработан реферальный код из URL: ${refCodeFromUrl}, guest_id: ${guestIdService.getGuestId()}`);
    } else {
      console.log('[ReferralService] В URL не найден валидный реферальный код');
    }
  }
  
  /**
   * Получает реферальный код для использования при регистрации
   * Сначала проверяет URL, затем локальное хранилище
   * @returns Реферальный код для использования при регистрации или null
   */
  getReferralCodeForRegistration(): string | null {
    // Сначала проверяем URL (приоритет выше)
    const refCodeFromUrl = this.getRefCodeFromUrl();
    
    if (refCodeFromUrl && this.isValidRefCode(refCodeFromUrl)) {
      console.log(`[ReferralService] Используем реферальный код из URL для регистрации: ${refCodeFromUrl}`);
      return refCodeFromUrl;
    }
    
    // Если в URL нет кода, проверяем локальное хранилище
    const savedRefCode = this.getSavedRefCode();
    
    if (savedRefCode) {
      console.log(`[ReferralService] Используем сохраненный реферальный код для регистрации: ${savedRefCode}`);
      return savedRefCode;
    }
    
    console.log('[ReferralService] Нет доступного реферального кода для регистрации');
    return null;
  }
}

// Экспортируем синглтон сервиса
export const referralService = new ReferralService();

// Автоматически инициализируем сервис при импорте
(function() {
  if (typeof window !== 'undefined') {
    // Инициализируем сервис только на клиенте (не при SSR)
    setTimeout(() => {
      referralService.initialize();
    }, 100); // Небольшая задержка для уверенности, что DOM загружен
  }
})();