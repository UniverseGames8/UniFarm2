import crypto from 'crypto';
import { storage } from '../storage';
import { User, InsertUser } from '@shared/schema';
import { validateTelegramInitData, TelegramValidationResult } from '../utils/telegramUtils';
import { generateUniqueRefCode } from '../utils/refCodeUtils';
// Используем инстанс-подход вместо статического класса
import { userService, referralBonusService } from './index';

/**
 * Интерфейс для аутентификации через Telegram
 */
export interface TelegramAuthData {
  authData?: string;
  userId?: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  startParam?: string;
  referrerId?: number;
  refCode?: string;
  guest_id?: string;
  testMode?: boolean;
}

/**
 * Интерфейс для регистрации гостевого пользователя
 */
export interface GuestRegistrationData {
  guest_id: string;
  username?: string;
  parent_ref_code?: string;
  ref_code?: string;
  airdrop_mode?: boolean;
  telegram_id?: number;
}

/**
 * Интерфейс для регистрации обычного пользователя
 */
export interface UserRegistrationData {
  username: string;
  refCode?: string;
  parentRefCode?: string;
  startParam?: string;
  telegram_id?: number;
  guest_id?: string;
}

/**
 * Интерфейс сервиса аутентификации
 */
export interface IAuthService {
  /**
   * Проверяет Telegram initData и аутентифицирует пользователя
   */
  authenticateTelegram(authData: TelegramAuthData, isDevelopment?: boolean): Promise<User>;
  
  /**
   * Регистрирует гостевого пользователя по guest_id
   */
  registerGuestUser(data: GuestRegistrationData): Promise<User>;
  
  /**
   * Регистрирует обычного пользователя
   */
  registerUser(data: UserRegistrationData): Promise<User>;
}

/**
 * Реализация сервиса аутентификации
 */
class AuthServiceImpl implements IAuthService {
  private BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

  /**
   * Проверяет Telegram initData и аутентифицирует пользователя
   */
  async authenticateTelegram(authData: TelegramAuthData, isDevelopment: boolean = false): Promise<User> {
    try {
      console.log(`[AuthService] 🚀 НАЧАЛО АУТЕНТИФИКАЦИИ TELEGRAM:`);
      console.log(`[AuthService] - authData:`, JSON.stringify(authData, null, 2));
      console.log(`[AuthService] - isDevelopment:`, isDevelopment);
      
      // 1. Валидация данных Telegram
      const validationResult: TelegramValidationResult = validateTelegramInitData(
        authData.authData || '',
        this.BOT_TOKEN,
        isDevelopment || authData.testMode || false
      );
      
      console.log(`[AuthService] - validationResult:`, JSON.stringify(validationResult, null, 2));

      if (!validationResult.isValid && !isDevelopment && !authData.testMode) {
        throw new Error(`Ошибка валидации данных Telegram: ${validationResult.errors?.join(', ')}`);
      }

      // 2. Получение идентификатора пользователя
      let telegramUserId = validationResult.userId;

      // Если в режиме разработки или тестирования
      if ((isDevelopment || authData.testMode) && authData.userId && !telegramUserId) {
        telegramUserId = authData.userId;
      }

      if (!telegramUserId && !authData.guest_id) {
        throw new Error('Не удалось определить пользователя Telegram');
      }

      // 3. Поиск пользователя по id Telegram или guest_id
      let user: User | undefined;

      // Приоритет поиска: guest_id > telegram_id
      if (authData.guest_id) {
        user = await userService.getUserByGuestId(authData.guest_id);
      }

      if (!user && telegramUserId) {
        // Используем метод getUserByTelegramId из storage
        const numericTelegramId = typeof telegramUserId === 'string' 
          ? parseInt(telegramUserId, 10) 
          : telegramUserId;
        
        user = await storage.getUserByTelegramId(numericTelegramId);
      }

      // 4. Если пользователь найден, обновим его данные
      if (user) {
        console.log(`[AuthService] Обновляем данные пользователя ${user.id}`);
        
        // Собираем данные для обновления
        const updateData: Partial<User> = {};
        
        // Обновляем guest_id только если он не установлен и передан в authData
        if (!user.guest_id && authData.guest_id) {
          console.log(`  - Привязка guest_id: ${authData.guest_id}`);
          updateData.guest_id = authData.guest_id;
        }
        
        // Обновляем telegram_id, если он не установлен и доступен
        if (!user.telegram_id && telegramUserId) {
          const numericTelegramId = typeof telegramUserId === 'string' 
            ? parseInt(telegramUserId, 10) 
            : telegramUserId;
            
          console.log(`  - Привязка telegram_id: ${numericTelegramId}`);
          updateData.telegram_id = numericTelegramId;
        }
        
        // Если есть данные для обновления, выполняем запрос к БД
        if (Object.keys(updateData).length > 0) {
          try {
            await storage.updateUser(user.id, updateData);
            
            // Обновляем локальный объект пользователя
            user = {...user, ...updateData};
            console.log(`[AuthService] ✅ Данные пользователя ${user.id} успешно обновлены`);
          } catch (error) {
            console.error(`[AuthService] ❌ Ошибка обновления пользователя:`, error);
          }
        }

        return user;
      }

      // 5. Если пользователь не найден, создаем нового (восстановление "призрачного" пользователя)
      console.log(`[AuthService] 🔄 ВОССТАНОВЛЕНИЕ ПОЛЬЗОВАТЕЛЯ: telegram_id=${telegramUserId}, guest_id=${authData.guest_id}`);
      
      const username = authData.username || 
                      `user_${telegramUserId || crypto.randomBytes(4).toString('hex')}`;

      // Создаем уникальный реферальный код
      const ref_code = await generateUniqueRefCode();

      // Определяем родительский реферальный код
      const parent_ref_code = authData.startParam || authData.refCode || null;
      
      console.log(`[AuthService] 📝 Создаем пользователя: username=${username}, ref_code=${ref_code}, parent_ref_code=${parent_ref_code}`);

      // Создаем пользователя
      // Преобразуем строковый telegramUserId в число (или null если отсутствует)
      let numericTelegramId: number | null = null;
      
      if (telegramUserId) {
        if (typeof telegramUserId === 'string') {
          numericTelegramId = parseInt(telegramUserId, 10);
        } else if (typeof telegramUserId === 'number') {
          numericTelegramId = telegramUserId;
        }
      }
        
      const newUser: InsertUser = {
        telegram_id: numericTelegramId,
        guest_id: authData.guest_id || null,
        username,
        wallet: null,
        ton_wallet_address: null,
        ref_code,
        parent_ref_code
      };

      const createdUser = await storage.createUser(newUser);

      // Обрабатываем реферальный бонус, если указан родительский код
      if (parent_ref_code) {
        await referralBonusService.processRegistrationBonus(createdUser.id, parent_ref_code);
      }

      return createdUser;
    } catch (error) {
      console.error('[AuthService] Ошибка аутентификации Telegram:', error);
      throw error;
    }
  }

  /**
   * Регистрирует гостевого пользователя по guest_id
   */
  async registerGuestUser(data: GuestRegistrationData): Promise<User> {
    try {
      // Проверяем, существует ли пользователь с таким guest_id
      const existingUser = await userService.getUserByGuestId(data.guest_id);
      if (existingUser) {
        return existingUser;
      }

      // Создаем уникальный реферальный код
      const ref_code = data.ref_code || await generateUniqueRefCode();

      // Создаем пользователя в режиме AirDrop
      const newUser: InsertUser = {
        telegram_id: data.telegram_id || null,
        guest_id: data.guest_id,
        username: data.username || `guest_${data.guest_id.substring(0, 8)}`,
        wallet: null,
        ton_wallet_address: null,
        ref_code,
        parent_ref_code: data.parent_ref_code || null,
      };

      const createdUser = await storage.createUser(newUser);

      // Если указан родительский реферальный код, начисляем бонус
      if (data.parent_ref_code) {
        await referralBonusService.processRegistrationBonus(createdUser.id, data.parent_ref_code);
      }

      return createdUser;
    } catch (error) {
      console.error('[AuthService] Ошибка регистрации гостевого пользователя:', error);
      throw error;
    }
  }

  /**
   * Регистрирует обычного пользователя
   */
  async registerUser(data: UserRegistrationData): Promise<User> {
    try {
      // Проверяем, существует ли пользователь с таким именем
      const existingUserByUsername = await userService.getUserByUsername(data.username);
      if (existingUserByUsername) {
        throw new Error(`Пользователь с именем ${data.username} уже существует`);
      }

      // Если указан telegram_id, проверяем, есть ли уже такой пользователь
      if (data.telegram_id) {
        const existingUserByTelegramId = await storage.getUserByTelegramId(data.telegram_id);
        if (existingUserByTelegramId) {
          console.log(`[AuthService] Пользователь с telegram_id ${data.telegram_id} уже существует`);
          return existingUserByTelegramId;
        }
      }

      // Создаем уникальный реферальный код
      const ref_code = data.refCode || await generateUniqueRefCode();

      // Определяем родительский реферальный код
      const parent_ref_code = data.parentRefCode || data.startParam || null;

      // Создаем пользователя
      const newUser: InsertUser = {
        telegram_id: data.telegram_id || null,
        guest_id: data.guest_id || null,
        username: data.username,
        wallet: null,
        ton_wallet_address: null,
        ref_code,
        parent_ref_code,
      };

      const createdUser = await storage.createUser(newUser);

      // Обрабатываем реферальный бонус, если указан родительский код
      if (parent_ref_code) {
        await referralBonusService.processRegistrationBonus(createdUser.id, parent_ref_code);
      }

      return createdUser;
    } catch (error) {
      console.error('[AuthService] Ошибка регистрации пользователя:', error);
      throw error;
    }
  }

  /**
   * Создает или обновляет сессию пользователя
   */
  private async createOrUpdateSession(userId: number): Promise<string> {
    try {
      // Создаем уникальный идентификатор сессии
      const sessionId = crypto.randomUUID();

      // В реальной реализации здесь должно быть сохранение в базу данных или
      // другое хранилище сессий. В данном примере просто возвращаем идентификатор.

      return sessionId;
    } catch (error) {
      console.error('[AuthService] Ошибка создания сессии:', error);
      throw error;
    }
  }
}

/**
 * Создает экземпляр сервиса аутентификации
 * @returns Экземпляр сервиса аутентификации
 */
export function createAuthService(): IAuthService {
  return new AuthServiceImpl();
}

// Создаем единственный экземпляр сервиса
export const authServiceInstance = createAuthService();