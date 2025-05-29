/**
 * ВНИМАНИЕ: Используйте импорт из services/index.ts вместо прямого импорта
 * 
 * Этот файл является прокси-оберткой для обратной совместимости.
 * Для новых разработок используйте инстанс adminService из services/index.ts
 */
import { adminServiceInstance } from './adminServiceInstance';
import { 
  adminKeySchema,
  adminParamsSchema,
  AdminKeyRequest,
  AdminParams,
  UserWithFlags,
  UsersListResult
} from './adminServiceInstance';

// Определяем интерфейс для совместимости
export interface IAdminService {
  verifyAdminAccess(adminKey: string): void;
  listUsersWithTelegramId(params?: AdminParams): Promise<UsersListResult>;
}

// Реэкспортируем типы для удобства
export { 
  adminKeySchema,
  adminParamsSchema,
  AdminKeyRequest,
  AdminParams,
  UserWithFlags,
  UsersListResult
};

/**
 * @deprecated Используйте инстанс adminService из services/index.ts вместо статических методов
 */
export class AdminService {
  /**
   * Проверяет административные права доступа
   */
  static verifyAdminAccess(adminKey: string): void {
    return adminServiceInstance.verifyAdminAccess(adminKey);
  }

  /**
   * Получает список всех пользователей с их Telegram ID
   */
  static async listUsersWithTelegramId(params?: AdminParams): Promise<UsersListResult> {
    return adminServiceInstance.listUsersWithTelegramId(params);
  }
}