/**
 * Адаптер для перетворення даних користувача
 * 
 * Цей модуль містить функції для забезпечення сумісності 
 * між різними інтерфейсами та форматами даних користувача.
 */

import { insertUserSchema } from '@shared/schema';
import { format } from 'date-fns';
import { ensureDate } from './typeFixers';
/**
 * Інтерфейс для представлення користувача в базі даних
 * Містить всі поля з 'users' таблиці та додаткові поля для сумісності
 */

/**
 * Адаптує користувача з БД до формату API-відповіді з урахуванням типів timestamp
 * @param user Користувач з бази даних
 * @returns Адаптований об'єкт користувача для API-відповіді
 */
export function dbUserToApiUser(user: any): ApiUser {
  if (!user) return null as any;
  
  return {
    ...user,
    id: Number(user.id),
    telegram_id: user.telegram_id ? Number(user.telegram_id) : null,
    checkin_streak: user.checkin_streak !== undefined && user.checkin_streak !== null ? 
      Number(user.checkin_streak) : 0,
    // Приведення всіх timestamp-полів до рядкового типу через ensureDate
    created_at: ensureDate(user.created_at),
    uni_farming_start_timestamp: ensureDate(user.uni_farming_start_timestamp),
    ton_farming_start_timestamp: ensureDate(user.ton_farming_start_timestamp),
    uni_farming_last_update: ensureDate(user.uni_farming_last_update),
    uni_farming_activated_at: ensureDate(user.uni_farming_activated_at),
    checkin_last_date: ensureDate(user.checkin_last_date),
    last_login_at: ensureDate(user.last_login_at),
    last_claim_at: ensureDate(user.last_claim_at)
  };
}
export type DbUser = {
  id: number;
  telegram_id: number | null;
  guest_id: string | null;
  username: string | null;
  wallet: string | null;
  ton_wallet_address: string | null;
  ref_code: string | null;
  parent_ref_code: string | null;
  balance_uni: string;
  balance_ton: string;
  farming_amount: string;
  farming_rewards: string;
  boost_level: string;
  ton_boost_level: string;
  is_verified: boolean;
  is_blocked: boolean;
  created_at: Date | string;
  last_login_at: Date | string | null;
  last_claim_at: Date | string | null;
  checkin_streak: number | null;
  uni_deposit_amount: string | null;
  uni_farming_start_timestamp: Date | string | null;
  uni_farming_balance: string | null;
  uni_farming_rate: string | null;
  uni_farming_last_update: Date | string | null;
  uni_farming_deposit: string | null;
  uni_farming_activated_at: Date | string | null;
  ton_deposit_amount: string | null;
  ton_farming_start_timestamp: Date | string | null;
  ton_farming_balance: string | null;
  ton_farming_rate: string | null;
  checkin_last_date: Date | string | null;
  // Додаткові поля для сумісності
  telegram_username?: string | null;
  is_fallback?: boolean;
};

/**
 * Інтерфейс для представлення користувача в API
 * Містить всі поля і використовується для типізації відповідей API
 */
export type ApiUser = {
  id: number;
  telegram_id: number | null;
  guest_id: string | null;
  username: string | null;
  wallet: string | null;
  ton_wallet_address: string | null;
  ref_code: string | null;
  parent_ref_code: string | null;
  balance_uni: string;
  balance_ton: string;
  farming_amount: string;
  farming_rewards: string;
  boost_level: string;
  ton_boost_level: string;
  is_verified: boolean;
  is_blocked: boolean;
  created_at: string;
  last_login_at: string | null;
  last_claim_at: string | null;
  checkin_streak: number | null;
  uni_deposit_amount: string | null;
  uni_farming_start_timestamp: string | null;
  uni_farming_balance: string | null;
  uni_farming_rate: string | null;
  uni_farming_last_update: string | null;
  uni_farming_deposit: string | null;
  uni_farming_activated_at: string | null;
  ton_deposit_amount: string | null;
  ton_farming_start_timestamp: string | null;
  ton_farming_balance: string | null;
  ton_farming_rate: string | null;
  checkin_last_date: string | null;
  telegram_username?: string | null;
  is_fallback?: boolean;
};

/**
 * Створює заглушку користувача для режиму fallback
 * @param userId ID користувача
 * @returns Заглушка користувача з усіма необхідними полями
 */
export function createUserFallback(userId: number | string): DbUser {
  const id = typeof userId === 'string' ? parseInt(userId, 10) : userId;
  const now = new Date(); // Використовуємо об'єкт Date замість рядка

  return {
    id,
    username: `user_${id}`,
    ref_code: `REF${id}${Math.floor(Math.random() * 1000)}`,
    telegram_id: null,
    telegram_username: null,
    guest_id: null,
    wallet: null,
    ton_wallet_address: null,
    parent_ref_code: null,
    balance_uni: "0",
    balance_ton: "0",
    farming_amount: "0",
    farming_rewards: "0",
    boost_level: "0",
    ton_boost_level: "0",
    created_at: now, // Використовуємо об'єкт Date замість рядка
    is_verified: false,
    is_blocked: false,
    last_login_at: null,
    last_claim_at: null,
    checkin_streak: 0,
    uni_deposit_amount: "0",
    uni_farming_start_timestamp: null,
    uni_farming_balance: "0",
    uni_farming_rate: "0",
    uni_farming_last_update: null,
    uni_farming_deposit: "0",
    uni_farming_activated_at: null,
    ton_deposit_amount: "0",
    ton_farming_start_timestamp: null,
    ton_farming_balance: "0",
    ton_farming_rate: "0",
    checkin_last_date: null,
    is_fallback: true
  };
}

/**
 * Створює заглушку користувача по guest_id для режиму fallback
 * @param guestId Guest ID користувача
 * @returns Заглушка користувача з усіма необхідними полями
 */
export function createGuestUserFallback(guestId: string): DbUser {
  const randomId = Math.floor(10000 + Math.random() * 90000);
  const now = new Date(); // Використовуємо об'єкт Date замість рядка
  
  return {
    id: randomId,
    username: `guest_${guestId.substring(0, 6)}`,
    ref_code: `REF${guestId.substring(0, 6)}`,
    telegram_id: null,
    telegram_username: null,
    guest_id: guestId,
    wallet: null,
    ton_wallet_address: null,
    parent_ref_code: null,
    balance_uni: "0",
    balance_ton: "0",
    farming_amount: "0",
    farming_rewards: "0",
    boost_level: "0",
    ton_boost_level: "0",
    created_at: now, // Використовуємо об'єкт Date замість рядка
    is_verified: false,
    is_blocked: false,
    last_login_at: null,
    last_claim_at: null,
    checkin_streak: 0,
    uni_deposit_amount: "0",
    uni_farming_start_timestamp: null,
    uni_farming_balance: "0",
    uni_farming_rate: "0",
    uni_farming_last_update: null,
    uni_farming_deposit: "0",
    uni_farming_activated_at: null,
    ton_deposit_amount: "0",
    ton_farming_start_timestamp: null,
    ton_farming_balance: "0",
    ton_farming_rate: "0",
    checkin_last_date: null,
    is_fallback: true
  };
}

/**
 * Створює заглушку зареєстрованого гостьового користувача для режиму fallback
 * @param guestId Guest ID користувача
 * @param username Ім'я користувача
 * @param parentRefCode Реферальний код запрошувача
 * @returns Заглушка користувача з усіма необхідними полями
 */
export function createRegisteredGuestFallback(
  guestId: string, 
  username?: string | null, 
  parentRefCode?: string | null
): DbUser {
  const randomId = Math.floor(10000 + Math.random() * 90000);
  const now = new Date(); // Використовуємо об'єкт Date замість рядка
  
  return {
    id: randomId,
    username: username || `guest_${randomId}`,
    guest_id: guestId,
    ref_code: `REF${randomId}`,
    parent_ref_code: parentRefCode || null,
    telegram_id: null,
    telegram_username: null,
    wallet: null,
    ton_wallet_address: null,
    balance_uni: "0",
    balance_ton: "0",
    farming_amount: "0",
    farming_rewards: "0",
    boost_level: "0",
    ton_boost_level: "0",
    created_at: now, // Використовуємо об'єкт Date замість рядка
    is_verified: false,
    is_blocked: false,
    last_login_at: null,
    last_claim_at: null,
    checkin_streak: 0,
    uni_deposit_amount: "0",
    uni_farming_start_timestamp: null,
    uni_farming_balance: "0",
    uni_farming_rate: "0",
    uni_farming_last_update: null,
    uni_farming_deposit: "0",
    uni_farming_activated_at: null,
    ton_deposit_amount: "0",
    ton_farming_start_timestamp: null,
    ton_farming_balance: "0",
    ton_farming_rate: "0",
    checkin_last_date: null,
    is_fallback: true
  };
}