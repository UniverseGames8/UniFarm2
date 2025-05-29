/**
 * Утилиты для работы с реферальными ссылками
 */

/**
 * Создает реферальную ссылку на основе реферального кода
 * @param refCode - Реферальный код пользователя
 * @returns Полная ссылка в формате https://t.me/UniFarming_Bot?start=CODE
 * 
 * УНИФИКАЦИЯ: Обновлена структура URL для единого стандарта.
 * Формат строго такой: https://t.me/UniFarming_Bot?start=КОД
 * 
 * ВАЖНО: Используется стандартный параметр start для Telegram ботов
 * для корректной обработки реферальных кодов через команду /start
 */
export function buildReferralLink(refCode: string | undefined | null): string {
  if (!refCode) {
    return '';
  }
  
  // Унифицированный формат для всех реферальных ссылок
  // Использует стандартный параметр start для Telegram ботов
  return `https://t.me/UniFarming_Bot?start=${refCode}`;
}

/**
 * Создает реферальную ссылку для прямого перехода к боту
 * Эта ссылка не открывает Mini App, а открывает диалог с ботом
 * С параметром start, который будет обработан ботом
 * 
 * @param refCode - Реферальный код пользователя
 * @returns Полная ссылка в формате https://t.me/UniFarming_Bot?start=ref_CODE
 */
export function buildDirectBotReferralLink(refCode: string | undefined | null): string {
  if (!refCode) {
    return '';
  }
  
  // Для прямого обращения к боту (не через Mini App) используем другой формат
  return `https://t.me/UniFarming_Bot?start=ref_${refCode}`;
}