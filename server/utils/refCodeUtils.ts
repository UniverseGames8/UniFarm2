/**
 * Утилиты для работы с реферальными кодами
 */

import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { storage } from '../storage';

/**
 * Символы, используемые для генерации реферальных кодов
 * Исключены потенциально путаемые символы ('0', 'O', '1', 'l', 'I')
 */
const REF_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnopqrstuvwxyz';

/**
 * Длина реферального кода
 */
const REF_CODE_LENGTH = 8;

/**
 * Генерирует случайный реферальный код
 */
export function generateRefCode(): string {
  let result = '';
  for (let i = 0; i < REF_CODE_LENGTH; i++) {
    result += REF_CODE_CHARS.charAt(Math.floor(Math.random() * REF_CODE_CHARS.length));
  }
  return result;
}

/**
 * Проверяет, что реферальный код уникален
 */
export async function isRefCodeUnique(refCode: string): Promise<boolean> {
  const user = await storage.getUserByRefCode(refCode);
  return !user;
}

/**
 * Генерирует уникальный реферальный код
 * При необходимости повторяет генерацию, пока не найдет уникальный код
 */
export async function generateUniqueRefCode(): Promise<string> {
  let refCode = generateRefCode();
  let isUnique = await isRefCodeUnique(refCode);
  
  // Повторяем генерацию, пока не получим уникальный код
  let attempts = 1;
  const maxAttempts = 10;
  
  while (!isUnique && attempts < maxAttempts) {
    refCode = generateRefCode();
    isUnique = await isRefCodeUnique(refCode);
    attempts++;
  }
  
  if (!isUnique) {
    throw new Error(`Не удалось сгенерировать уникальный реферальный код после ${maxAttempts} попыток`);
  }
  
  return refCode;
}

/**
 * Обновляет реферальный код пользователя
 */
export async function updateUserRefCode(userId: number, refCode: string): Promise<void> {
  // Используем драйзл для обновления рефкода в таблице users
  await db.update(users)
    .set({ ref_code: refCode })
    .where(eq(users.id, userId));
}