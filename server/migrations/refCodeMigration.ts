/**
 * Модуль для миграции и проверки реферальных кодов пользователей
 * Обеспечивает, что у каждого пользователя есть корректный реферальный код
 */
import { db } from '../db';
import { users } from '@shared/schema';
import { storage } from '../storage';
import { eq, isNull } from 'drizzle-orm';

/**
 * Проверяет и обновляет реферальные коды всех пользователей
 * @returns Отчет о процессе обновления
 */
export async function migrateRefCodes(): Promise<{ 
  updated: number, 
  total: number, 
  detailedReport: Array<{ id: number, telegram_id: number | null, oldRefCode: string | null, newRefCode: string }>
}> {
  console.log('[RefCodeMigration] Запуск процесса обновления реферальных кодов...');

  // Получаем всех пользователей без реферального кода
  const usersWithoutRefCode = await db
    .select()
    .from(users)
    .where(
      isNull(users.ref_code) || eq(users.ref_code, '')
    );

  console.log(`[RefCodeMigration] Найдено ${usersWithoutRefCode.length} пользователей без корректных реферальных кодов`);

  // Детальный отчет для логирования и отладки
  const detailedReport: Array<{ 
    id: number, 
    telegram_id: number | null, 
    oldRefCode: string | null, 
    newRefCode: string 
  }> = [];

  // Счетчик обновленных пользователей
  let updatedCount = 0;

  // Обрабатываем каждого пользователя без реферального кода
  for (const user of usersWithoutRefCode) {
    try {
      // Генерируем новый уникальный реферальный код
      const newRefCode = storage.generateRefCode();
      
      // Обновляем пользователя с новым реферальным кодом
      await db
        .update(users)
        .set({ ref_code: newRefCode })
        .where(eq(users.id, user.id));
      
      // Добавляем информацию в отчет
      detailedReport.push({
        id: user.id,
        telegram_id: user.telegram_id,
        oldRefCode: user.ref_code,
        newRefCode
      });
      
      updatedCount++;
      console.log(`[RefCodeMigration] Обновлен пользователь ID=${user.id}, TG_ID=${user.telegram_id}: ${user.ref_code} -> ${newRefCode}`);
    } catch (error) {
      console.error(`[RefCodeMigration] Ошибка обновления пользователя ID=${user.id}:`, error);
    }
  }

  console.log(`[RefCodeMigration] Процесс завершен. Обновлено ${updatedCount} из ${usersWithoutRefCode.length} пользователей`);

  return {
    updated: updatedCount,
    total: usersWithoutRefCode.length,
    detailedReport
  };
}

/**
 * Проверяет и обновляет реферальный код для конкретного пользователя
 * @param userId ID пользователя для проверки
 * @returns Информация об обновлении
 */
export async function checkAndUpdateUserRefCode(userId: number): Promise<{
  updated: boolean;
  oldRefCode: string | null;
  newRefCode: string | null;
}> {
  try {
    // Получаем пользователя по ID
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));
    
    if (!user) {
      console.log(`[RefCodeMigration] Пользователь с ID=${userId} не найден`);
      return { updated: false, oldRefCode: null, newRefCode: null };
    }
    
    // Если у пользователя уже есть реферальный код, возвращаем его
    if (user.ref_code) {
      console.log(`[RefCodeMigration] Пользователь ID=${userId} уже имеет реферальный код: ${user.ref_code}`);
      return { updated: false, oldRefCode: user.ref_code, newRefCode: null };
    }
    
    // Генерируем новый реферальный код
    const newRefCode = storage.generateRefCode();
    
    // Обновляем пользователя
    await db
      .update(users)
      .set({ ref_code: newRefCode })
      .where(eq(users.id, userId));
    
    console.log(`[RefCodeMigration] Обновлен пользователь ID=${userId}: ${user.ref_code} -> ${newRefCode}`);
    
    return { updated: true, oldRefCode: user.ref_code, newRefCode };
  } catch (error) {
    console.error(`[RefCodeMigration] Ошибка при обновлении реферального кода для пользователя ID=${userId}:`, error);
    return { updated: false, oldRefCode: null, newRefCode: null };
  }
}

/**
 * Устанавливает реферальный код для заданного пользователя
 * Использовать с осторожностью - только для ручного обновления!
 */
export async function setRefCodeForUser(userId: number, refCode: string): Promise<boolean> {
  try {
    // Получаем пользователя по ID
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));
    
    if (!user) {
      console.error(`[RefCodeMigration] Ошибка: пользователь с ID=${userId} не найден`);
      return false;
    }
    
    // Проверяем, не используется ли этот код другим пользователем
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.ref_code, refCode));
    
    if (existingUser && existingUser.id !== userId) {
      console.error(`[RefCodeMigration] Реферальный код ${refCode} уже используется пользователем ID=${existingUser.id}`);
      return false;
    }
    
    // Обновляем реферальный код пользователя
    await db
      .update(users)
      .set({ ref_code: refCode })
      .where(eq(users.id, userId));
    
    console.log(`[RefCodeMigration] Установлен реферальный код ${refCode} для пользователя ID=${userId}`);
    return true;
  } catch (error) {
    console.error(`[RefCodeMigration] Ошибка при установке реферального кода для пользователя ID=${userId}:`, error);
    return false;
  }
}