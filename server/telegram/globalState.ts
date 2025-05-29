/**
 * Модуль для управления глобальным состоянием Telegram бота
 * 
 * Предоставляет типобезопасные функции для работы с глобальным состоянием,
 * вместо использования глобальных переменных напрямую
 */

/**
 * Устанавливает флаг инициализации бота
 * @param isInitialized Статус инициализации
 */
export function setTelegramBotInitialized(isInitialized: boolean): void {
  // Сохраняем состояние в глобальном объекте
  (global as any).telegramBotInitialized = isInitialized;
}

/**
 * Проверяет, инициализирован ли бот
 * @returns Статус инициализации бота
 */
export function isTelegramBotInitialized(): boolean {
  try {
    return (global as any).telegramBotInitialized === true;
  } catch (error) {
    return false;
  }
}

/**
 * Сбрасывает статус инициализации бота
 */
export function resetTelegramBotState(): void {
  try {
    (global as any).telegramBotInitialized = false;
  } catch (error) {
    // Игнорируем ошибки при сбросе состояния
  }
}