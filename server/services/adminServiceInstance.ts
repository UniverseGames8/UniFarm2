import { db } from '../db';
import { users } from '@shared/schema';
import { NotFoundError, ValidationError, ForbiddenError } from '../middleware/errorHandler';
import { z } from 'zod';

/**
 * Схема для запроса админского ключа
 */
export const adminKeySchema = z.object({
  adminKey: z.string().min(1, 'Ключ администратора не может быть пустым')
});

export type AdminKeyRequest = z.infer<typeof adminKeySchema>;

/**
 * Схема для расширенных параметров админских запросов
 */
export const adminParamsSchema = z.object({
  userId: z.number().optional(),
  limit: z.number().min(1).max(1000).default(100).optional(),
  offset: z.number().min(0).default(0).optional(),
  showTestAccounts: z.boolean().default(true).optional(),
  sortBy: z.enum(['createdAt', 'id', 'username', 'telegramId']).default('id').optional(),
  sortDirection: z.enum(['asc', 'desc']).default('asc').optional(),
});

export type AdminParams = z.infer<typeof adminParamsSchema>;

/**
 * Интерфейс пользователя с флагами для админской панели
 */
export interface UserWithFlags {
  id: number;
  telegramId: number | null;
  username: string | null;
  createdAt: Date | null;
  isTestAccount: boolean;
}

/**
 * Результаты списка пользователей с дополнительной статистикой
 */
export interface UsersListResult {
  users: UserWithFlags[];
  stats: {
    totalUsers: number;
    usersWithValidTelegramId: number;
    usersWithoutTelegramId: number;
    usersWithTestTelegramId: number;
    duplicateTelegramIds: Record<string, number>;
  };
  generatedAt: string;
}

/**
 * Интерфейс сервиса для административных функций
 */
export interface IAdminService {
  /**
   * Проверяет административные права доступа
   */
  verifyAdminAccess(adminKey: string): void;

  /**
   * Получает список всех пользователей с их Telegram ID
   */
  listUsersWithTelegramId(params?: AdminParams): Promise<UsersListResult>;
}

/**
 * Реализация сервиса для административных функций
 */
class AdminServiceImpl implements IAdminService {
  /**
   * Проверяет административные права доступа
   * @param adminKey - Ключ администратора
   * @throws ForbiddenError если доступ запрещен
   */
  verifyAdminAccess(adminKey: string): void {
    const IS_DEV = process.env.NODE_ENV === 'development';
    const SECRET_KEY = process.env.ADMIN_SECRET_KEY;
    
    // В режиме разработки разрешаем тестовый ключ и заглушку
    if (IS_DEV) {
      if (adminKey === 'test-admin-key' || adminKey === 'development') {
        console.log('[AdminService] Используется тестовый ключ в режиме разработки');
        return;
      }
    }
    
    if (!SECRET_KEY && !IS_DEV) {
      console.error('[AdminService] Отсутствует ADMIN_SECRET_KEY в переменных окружения');
      throw new Error('Серверная ошибка конфигурации. Обратитесь к администратору.');
    }
    
    if (!adminKey || (SECRET_KEY && adminKey !== SECRET_KEY)) {
      console.warn('[AdminService] Попытка доступа к админскому API без правильного ключа');
      throw new ForbiddenError('Доступ запрещен: неверный ключ администратора');
    }
  }

  /**
   * Получает список всех пользователей с их Telegram ID
   * @param params - Дополнительные параметры запроса
   * @returns Список пользователей с дополнительной статистикой
   */
  async listUsersWithTelegramId(params?: AdminParams): Promise<UsersListResult> {
    console.log('[AdminService] Запрос списка пользователей с Telegram ID');
    
    // Применяем параметры с дефолтными значениями
    const options = {
      limit: params?.limit || 100,
      offset: params?.offset || 0,
      showTestAccounts: params?.showTestAccounts !== false, // по умолчанию true
      sortBy: params?.sortBy || 'id',
      sortDirection: params?.sortDirection || 'asc'
    };
    
    // Получаем всех пользователей из базы
    const allUsers = await db.select({
      id: users.id,
      telegramId: users.telegram_id,
      username: users.username,
      createdAt: users.created_at
    }).from(users);
    
    // Добавляем флаг тестового аккаунта для каждого пользователя
    let usersWithFlags: UserWithFlags[] = allUsers.map(user => ({
      ...user,
      isTestAccount: !user.telegramId || user.telegramId === 1
    }));
    
    // Фильтрация тестовых аккаунтов, если нужно
    if (!options.showTestAccounts) {
      usersWithFlags = usersWithFlags.filter(user => !user.isTestAccount);
    }
    
    // Сортировка пользователей
    usersWithFlags.sort((a, b) => {
      const fieldA = (a as any)[options.sortBy];
      const fieldB = (b as any)[options.sortBy];
      
      // Обработка null значений (они всегда последние)
      if (fieldA === null && fieldB === null) return 0;
      if (fieldA === null) return 1;
      if (fieldB === null) return -1;
      
      // Обычное сравнение для числовых и строковых полей
      const compareResult = 
        typeof fieldA === 'string' 
          ? fieldA.localeCompare(fieldB) 
          : fieldA - fieldB;
      
      // Применяем направление сортировки
      return options.sortDirection === 'asc' ? compareResult : -compareResult;
    });
    
    // Применяем пагинацию
    const paginatedUsers = usersWithFlags.slice(
      options.offset, 
      options.offset + options.limit
    );
    
    // Подсчитываем статистику для диагностики
    const stats = {
      totalUsers: allUsers.length,
      usersWithValidTelegramId: allUsers.filter(u => u.telegramId && u.telegramId > 1).length,
      usersWithoutTelegramId: allUsers.filter(u => !u.telegramId).length,
      usersWithTestTelegramId: allUsers.filter(u => u.telegramId === 1).length,
      duplicateTelegramIds: this.findDuplicateTelegramIds(allUsers)
    };
    
    return {
      users: paginatedUsers,
      stats,
      generatedAt: new Date().toISOString()
    };
  }
  
  /**
   * Вспомогательная функция для поиска дубликатов Telegram ID
   * @private
   */
  private findDuplicateTelegramIds(users: { telegramId: number | null }[]): Record<string, number> {
    const idCounts: Record<string, number> = {};
    const duplicates: Record<string, number> = {};
    
    users.forEach(user => {
      if (user.telegramId) {
        const idStr = user.telegramId.toString();
        idCounts[idStr] = (idCounts[idStr] || 0) + 1;
        
        if (idCounts[idStr] > 1) {
          duplicates[idStr] = idCounts[idStr];
        }
      }
    });
    
    return duplicates;
  }
}

/**
 * Создает экземпляр административного сервиса
 * @returns Экземпляр административного сервиса
 */
export function createAdminService(): IAdminService {
  return new AdminServiceImpl();
}

// Создаем единственный экземпляр сервиса
export const adminServiceInstance = createAdminService();