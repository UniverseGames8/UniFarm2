/**
 * ВНИМАНИЕ: Используйте импорт из services/index.ts вместо прямого импорта
 * 
 * Этот файл является прокси-оберткой для обратной совместимости.
 * Для новых разработок используйте инстанс authService из services/index.ts
 */
import { authServiceInstance } from './authServiceInstance';
import { 
  TelegramAuthData, 
  GuestRegistrationData, 
  UserRegistrationData
} from './authServiceInstance';
import { User } from '@shared/schema';

// Определяем интерфейс для совместимости
export interface IAuthService {
  authenticateTelegram(authData: TelegramAuthData, isDevelopment?: boolean): Promise<User>;
  registerGuestUser(data: GuestRegistrationData): Promise<User>;
  registerUser(data: UserRegistrationData): Promise<User>;
}

// Реэкспортируем типы для удобства
export { 
  TelegramAuthData, 
  GuestRegistrationData, 
  UserRegistrationData
};

/**
 * @deprecated Используйте инстанс authService из services/index.ts вместо статических методов
 */
export class AuthService {
  /**
   * Проверяет Telegram initData и аутентифицирует пользователя
   */
  static async authenticateTelegram(authData: TelegramAuthData, isDevelopment?: boolean) {
    return authServiceInstance.authenticateTelegram(authData, isDevelopment);
  }
  
  /**
   * Регистрирует гостевого пользователя по guest_id
   */
  static async registerGuestUser(data: GuestRegistrationData) {
    return authServiceInstance.registerGuestUser(data);
  }
  
  /**
   * Регистрирует обычного пользователя
   */
  static async registerUser(data: UserRegistrationData) {
    return authServiceInstance.registerUser(data);
  }
}