/**
 * Утилиты для работы со строками
 */

/**
 * Генерирует случайную строку указанной длины
 * @param length Длина генерируемой строки
 * @param charset Набор символов для генерации (по умолчанию a-z0-9)
 * @returns Сгенерированная случайная строка
 */
export function generateRandomString(length: number, charset: string = 'abcdefghijklmnopqrstuvwxyz0123456789'): string {
  let result = '';
  const charsetLength = charset.length;
  
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charsetLength));
  }
  
  return result;
}

/**
 * Генерирует UUID v4
 * @returns Сгенерированный UUID v4
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Форматирует число с фиксированным количеством десятичных знаков
 * @param num Число для форматирования
 * @param decimals Количество десятичных знаков
 * @returns Отформатированная строка
 */
export function formatNumber(num: number | string, decimals: number = 2): string {
  const number = typeof num === 'string' ? parseFloat(num) : num;
  return number.toFixed(decimals);
}

/**
 * Обрезает строку до указанной длины и добавляет многоточие
 * @param str Исходная строка
 * @param maxLength Максимальная длина
 * @returns Обрезанная строка с многоточием, если необходимо
 */
export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Проверяет, является ли строка валидным JSON
 * @param str Строка для проверки
 * @returns true, если строка является валидным JSON
 */
export function isValidJSON(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Нормализует строку для использования в качестве идентификатора
 * @param str Исходная строка
 * @returns Нормализованная строка (lowercase, без пробелов и спецсимволов)
 */
export function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\w\-]/g, '');
}

/**
 * Форматирует дату в человекочитаемый формат
 * @param date Дата для форматирования
 * @returns Отформатированная строка
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}