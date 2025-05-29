/**
 * Экземпляр сервиса для работы с пользователями
 * 
 * Этот файл создает и экспортирует экземпляр userService для использования
 * в приложении. Это позволяет избежать циклических зависимостей и обеспечивает
 * единую точку доступа к сервису пользователей.
 */

import { createUserService, IUserService } from './userService';
import { extendedStorage } from '../storage-adapter-extended';

/**
 * Создает экземпляр сервиса пользователей
 * @returns Экземпляр IUserService
 */
export function createUserServiceInstance(): IUserService {
  return createUserService(extendedStorage);
}

/**
 * Экспортируем экземпляр сервиса для использования в приложении
 */
export const userServiceInstance = createUserServiceInstance();