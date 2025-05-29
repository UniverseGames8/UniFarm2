import { storage } from '../storage';
import { validateTelegramInitData, extractReferralCodeFromStartParam, TelegramValidationResult } from '../utils/telegramUtils';
import { NotFoundError, ValidationError } from '../middleware/errorHandler';

/**
 * Интерфейс для данных пользователя Telegram
 */
export interface TelegramUserData {
  id: number;
  telegramId: number | null;
  username: string | null;
  firstName: string | null;
  lastName?: string | null;
  walletAddress: string | null;
  balance: string;
  referralCode: string | null;
}

/**
 * Интерфейс ответа на запрос валидации initData
 */
export interface ValidateInitDataResponse {
  isValid: boolean;
  user?: TelegramUserData;
  telegramId?: number;
  needRegistration?: boolean;
  errors?: string[];
}

/**
 * Интерфейс для Mini App информации
 */
export interface MiniAppInfo {
  name: string;
  botUsername: string;
  appUrl: string;
  version: string;
  description: string;
  features: string[];
}

/**
 * Интерфейс для входных данных при регистрации пользователя
 */
export interface TelegramRegistrationInput {
  initData: string;
  referrer?: string | null;
}

/**
 * Интерфейс для webhook данных от Telegram
 */
export interface TelegramWebhookData {
  update_id?: number;
  message?: {
    message_id?: number;
    from?: {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
    text?: string;
    chat?: {
      id: number;
      type: string;
    };
    entities?: Array<{
      type: string;
      offset: number;
      length: number;
    }>;
  };
  callback_query?: any;
}

/**
 * Интерфейс сервиса для работы с Telegram API
 */
export interface ITelegramService {
  /**
   * Обрабатывает webhook от Telegram
   * @param webhookData - Данные webhook от Telegram
   * @returns Результат обработки webhook
   */
  handleWebhook(webhookData: TelegramWebhookData): Promise<{ success: boolean; message: string }>;

  /**
   * Валидирует данные инициализации Telegram (initData)
   * @param initData - Строка initData из Telegram WebApp
   * @returns Ответ с результатом валидации
   * @throws ValidationError если данные невалидны
   */
  validateInitData(initData: string): Promise<ValidateInitDataResponse>;

  /**
   * Получает информацию о мини-приложении
   * @returns Информация о мини-приложении
   */
  getMiniAppInfo(): MiniAppInfo;

  /**
   * Регистрирует пользователя через Telegram
   * @param registrationData - Данные для регистрации
   * @returns Данные зарегистрированного пользователя
   * @throws ValidationError если данные невалидны
   */
  registerUser(registrationData: TelegramRegistrationInput): Promise<TelegramUserData>;
}

/**
 * Реализация сервиса для работы с Telegram API
 */
class TelegramServiceImpl implements ITelegramService {
  /**
   * Обрабатывает webhook от Telegram
   * @param webhookData - Данные webhook от Telegram
   * @returns Результат обработки webhook
   */
  async handleWebhook(webhookData: TelegramWebhookData): Promise<{ success: boolean; message: string }> {
    try {
      console.log('[TelegramService] Обработка webhook от Telegram');
      
      if (!webhookData) {
        console.warn('[TelegramService] Получен пустой webhook без данных');
        return { success: false, message: 'Пустые данные webhook' };
      }
      
      // Логирование для диагностики
      const logData = {
        updateId: webhookData.update_id,
        hasMessage: !!webhookData.message,
        hasCallback: !!webhookData.callback_query,
        messageId: webhookData.message?.message_id,
        from: webhookData.message?.from ? 
              `${webhookData.message.from.first_name || ''} ${webhookData.message.from.last_name || ''} (@${webhookData.message.from.username || 'нет_username'}) [ID: ${webhookData.message.from.id}]` : 
              'нет_данных',
        text: webhookData.message?.text || 'нет_текста',
        chat: webhookData.message?.chat ? 
              `${webhookData.message.chat.type} [ID: ${webhookData.message.chat.id}]` : 
              'нет_данных_чата'
      };
      
      console.log('[TelegramService] Детали webhook:', logData);
      
      // Проверка наличия команды
      if (webhookData.message?.entities) {
        const hasCommand = webhookData.message.entities.some(e => e.type === 'bot_command');
        if (hasCommand) {
          console.log('[TelegramService] Обнаружена команда в сообщении:', webhookData.message.text);
        }
      }
      
      // Дополнительная обработка webhook может быть реализована здесь
      
      return { success: true, message: 'Webhook обработан успешно' };
    } catch (error) {
      console.error('[TelegramService] Ошибка при обработке webhook:', error);
      return { success: false, message: 'Ошибка при обработке webhook' };
    }
  }

  /**
   * Валидирует данные инициализации Telegram (initData)
   * @param initData - Строка initData из Telegram WebApp
   * @returns Ответ с результатом валидации
   * @throws ValidationError если данные невалидны
   */
  async validateInitData(initData: string): Promise<ValidateInitDataResponse> {
    if (!initData) {
      throw new ValidationError('Отсутствует поле initData');
    }

    // Проверяем данные от Telegram
    const validationResult = await validateTelegramInitData(initData, process.env.TELEGRAM_BOT_TOKEN);

    // Логирование результата для диагностики
    console.log('[TelegramService] Результат верификации initData:', {
      isValid: validationResult.isValid,
      hasUserId: !!validationResult.userId,
      hasErrors: !!validationResult.errors && validationResult.errors.length > 0
    });

    // Если данные невалидны, выбрасываем ошибку
    if (!validationResult.isValid) {
      throw new ValidationError(
        'Ошибка валидации данных Telegram', 
        { initData: validationResult.errors?.join(', ') || 'Неизвестная ошибка валидации' }
      );
    }

    // Если нет userId, выбрасываем ошибку
    if (!validationResult.userId) {
      throw new ValidationError('Отсутствует идентификатор пользователя Telegram');
    }

    // Пытаемся найти пользователя в БД
    const userId = typeof validationResult.userId === 'string' 
      ? parseInt(validationResult.userId, 10) 
      : validationResult.userId;
    const user = await storage.getUserByTelegramId(userId);

    // Если пользователь существует, возвращаем его данные
    if (user) {
      console.log(`[TG INIT: DONE] Telegram инициализация завершена для существующего пользователя ID=${user.id}, TelegramID=${userId}`);
      return {
        isValid: true,
        user: {
          id: user.id,
          telegramId: typeof user.telegram_id === 'number' ? user.telegram_id : null,
          username: user.username,
          firstName: user.username || validationResult.firstName || null,
          walletAddress: user.ton_wallet_address,
          balance: user.balance_uni || "0",
          referralCode: user.ref_code
        }
      };
    }

    // Если пользователя нет, возвращаем только идентификатор Telegram
    return {
      isValid: true,
      telegramId: typeof validationResult.userId === 'string' 
        ? parseInt(validationResult.userId, 10) 
        : validationResult.userId,
      needRegistration: true
    };
  }

  /**
   * Получает информацию о мини-приложении
   * @returns Информация о мини-приложении
   */
  getMiniAppInfo(): MiniAppInfo {
    return {
      name: "UniFarm",
      botUsername: "@UniFarming_Bot",
      appUrl: "https://t.me/UniFarming_Bot/UniFarm",
      version: "1.0.0",
      description: "Telegram Mini App для крипто-фарминга и реферальной программы",
      features: [
        "Фарминг UNI токенов",
        "Реферальная программа с 20 уровнями",
        "Интеграция с TON Blockchain",
        "Ежедневные бонусы"
      ]
    };
  }

  /**
   * Регистрирует пользователя через Telegram
   * @param registrationData - Данные для регистрации
   * @returns Данные зарегистрированного пользователя
   * @throws ValidationError если данные невалидны
   */
  async registerUser(registrationData: TelegramRegistrationInput): Promise<TelegramUserData> {
    const { initData, referrer } = registrationData;

    if (!initData) {
      throw new ValidationError('Отсутствуют данные для регистрации');
    }

    // Проверяем данные от Telegram
    const validationResult = await validateTelegramInitData(initData, process.env.TELEGRAM_BOT_TOKEN);

    if (!validationResult.isValid || !validationResult.userId) {
      throw new ValidationError(
        'Ошибка валидации данных Telegram',
        { initData: validationResult.errors?.join(', ') || 'Неизвестная ошибка валидации' }
      );
    }

    // Получаем данные из initData
    const { userId, username, firstName, lastName } = validationResult;

    // Преобразуем userId в число, если он строка
    const telegramId = typeof userId === 'string' 
      ? parseInt(userId, 10) 
      : userId;

    // Проверяем, существует ли пользователь
    const existingUser = await storage.getUserByTelegramId(telegramId);

    if (existingUser) {
      return {
        id: existingUser.id,
        telegramId: typeof existingUser.telegram_id === 'number' ? existingUser.telegram_id : null,
        username: existingUser.username,
        firstName: username || firstName || null,
        lastName: lastName || null,
        walletAddress: existingUser.ton_wallet_address,
        balance: existingUser.balance_uni || "0",
        referralCode: existingUser.ref_code
      };
    }

    // Генерируем уникальный реферальный код
    const refCode = `ref_${Math.random().toString(36).substring(2, 10)}`;
    console.log(`[REF CODE CREATED] Сгенерирован реферальный код: ${refCode} для TelegramID=${telegramId}`);

    // Создаем нового пользователя
    const newUser = await storage.createUser({
      username: username || `user_${telegramId}`,
      telegram_id: typeof telegramId === 'number' ? telegramId : null,
      guest_id: null, // В случае регистрации через Telegram guest_id не нужен
      wallet: null,
      ton_wallet_address: null,
      ref_code: refCode,
      parent_ref_code: referrer || null
    });

    console.log(`[USER REGISTERED] Пользователь зарегистрирован: ID=${newUser.id}, TelegramID=${telegramId}, RefCode=${refCode}`);
    if (referrer) {
      console.log(`[PARENT CODE LINKED] Пользователь ${newUser.id} привязан к родительскому коду: ${referrer}`);
    }

    return {
      id: newUser.id,
      telegramId: typeof newUser.telegram_id === 'number' ? newUser.telegram_id : null,
      username: newUser.username,
      firstName: username || firstName || null,
      lastName: lastName || null,
      walletAddress: newUser.ton_wallet_address,
      balance: newUser.balance_uni || "0",
      referralCode: newUser.ref_code
    };
  }
}

/**
 * Создает экземпляр сервиса для работы с Telegram API
 * @returns Экземпляр сервиса Telegram API
 */
export function createTelegramService(): ITelegramService {
  return new TelegramServiceImpl();
}

// Создаем единственный экземпляр сервиса
export const telegramServiceInstance = createTelegramService();