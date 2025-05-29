/**
 * Скрипт для обновления реферальных кодов у существующих пользователей
 * Выполняется один раз при инициализации нового функционала
 */
import { db } from '../db';
import { users } from '@shared/schema';
import { UserService } from '../services/userService';
import { isNull, or, eq } from 'drizzle-orm';
import { storage } from '../storage';

/**
 * Обновляет реферальные коды для всех пользователей, у которых они отсутствуют или установлены TEST123
 */
export async function updateRefCodes(): Promise<void> {
  try {
    console.log('[RefCodeMigration] Запуск процесса обновления реферальных кодов...');
    
    // Получаем всех пользователей без реферальных кодов или с тестовым кодом TEST123
    const usersWithoutRefCodes = await db
      .select()
      .from(users)
      .where(or(
        isNull(users.ref_code),
        eq(users.ref_code, 'TEST123')
      ));
    
    console.log(`[RefCodeMigration] Найдено ${usersWithoutRefCodes.length} пользователей без корректных реферальных кодов`);
    
    // Обновляем каждого пользователя
    let updatedCount = 0;
    for (const user of usersWithoutRefCodes) {
      try {
        // Генерируем новый код
        const refCode = storage.generateRefCode();
        
        // Обновляем пользователя
        const updatedUser = await storage.updateUserRefCode(user.id, refCode);
        
        if (updatedUser) {
          updatedCount++;
          console.log(`[RefCodeMigration] Обновлен пользователь ID=${user.id}, новый код: ${refCode}`);
        } else {
          console.error(`[RefCodeMigration] Не удалось обновить пользователя ID=${user.id}`);
        }
      } catch (userError) {
        console.error(`[RefCodeMigration] Ошибка при обновлении пользователя ID=${user.id}:`, userError);
      }
    }
    
    console.log(`[RefCodeMigration] Процесс завершен. Обновлено ${updatedCount} из ${usersWithoutRefCodes.length} пользователей`);
  } catch (error) {
    console.error('[RefCodeMigration] Ошибка в процессе обновления реферальных кодов:', error);
  }
}