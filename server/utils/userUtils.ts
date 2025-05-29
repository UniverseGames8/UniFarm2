import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { NotFoundError } from '../middleware/errorHandler';
import type { User } from '@shared/schema';

/**
 * Получает пользователя по ID или выбрасывает NotFoundError, если пользователь не найден
 * 
 * @param userId ID пользователя
 * @returns Пользователь
 * @throws NotFoundError если пользователь не найден
 */
export async function getUserOrThrow(userId: number): Promise<User> {
  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  
  if (!user[0]) {
    throw new NotFoundError(`Пользователь с ID ${userId} не найден`);
  }
  
  return user[0];
}

/**
 * Получает пользователя по guest_id или выбрасывает NotFoundError, если пользователь не найден
 * 
 * @param guestId Идентификатор гостя
 * @returns Пользователь
 * @throws NotFoundError если пользователь не найден
 */
export async function getUserByGuestIdOrThrow(guestId: string): Promise<User> {
  const user = await db.select().from(users).where(eq(users.guest_id, guestId)).limit(1);
  
  if (!user[0]) {
    throw new NotFoundError(`Пользователь с guest_id ${guestId} не найден`);
  }
  
  return user[0];
}

/**
 * Получает пользователя по имени пользователя или выбрасывает NotFoundError, если пользователь не найден
 * 
 * @param username Имя пользователя
 * @returns Пользователь
 * @throws NotFoundError если пользователь не найден
 */
export async function getUserByUsernameOrThrow(username: string): Promise<User> {
  const user = await db.select().from(users).where(eq(users.username, username)).limit(1);
  
  if (!user[0]) {
    throw new NotFoundError(`Пользователь с именем ${username} не найден`);
  }
  
  return user[0];
}