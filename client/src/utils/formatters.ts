/**
 * Утилиты форматирования для UniFarm
 */

/**
 * Форматирует сумму с учетом типа токена
 * @param amount Сумма
 * @param tokenType Тип токена (UNI/TON)
 * @returns Отформатированная сумма в виде строки
 */
export function formatAmount(amount: number, tokenType: string = 'UNI'): string {
  try {
    if (typeof amount !== 'number' || isNaN(amount)) {
      return `0 ${tokenType}`;
    }
    
    // Используем соответствующий форматтер в зависимости от типа токена
    const formattedValue = tokenType.toUpperCase() === 'TON' 
      ? formatTonNumber(amount) 
      : formatUniNumber(amount);
    
    return `${formattedValue} ${tokenType}`;
  } catch (error) {
    console.error('[ERROR] Ошибка в formatAmount:', error);
    return `${amount} ${tokenType}`;
  }
}

/**
 * Форматирует дату транзакции в понятный формат
 * @param date Дата для форматирования
 * @returns Отформатированная дата в виде строки
 */
export function formatDate(date: Date | string): string {
  try {
    return formatDateTime(date);
  } catch (error) {
    console.error('[ERROR] Ошибка в formatDate:', error);
    return typeof date === 'string' ? date : date.toLocaleString();
  }
}

/**
 * Определяет оптимальное количество десятичных знаков для форматирования числа
 * в зависимости от его величины и типа валюты
 * 
 * @param value Числовое значение для анализа
 * @param currency Тип валюты ('UNI' или 'TON')
 * @returns Рекомендуемое количество десятичных знаков
 */
export function getOptimalDecimals(value: number | string, currency: string = 'UNI'): number {
  try {
    // Преобразование к числу, если передана строка
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    // Проверка на валидное число
    if (numValue === undefined || numValue === null || !isFinite(numValue)) {
      return 5; // Используем 5 знаков по умолчанию для обеих валют
    }
    
    // Унифицированная стратегия для обеих валют (TON и UNI)
    // для лучшей читаемости и единообразия
    if (numValue < 0.00001) return 5;
    if (numValue < 0.0001) return 5;
    if (numValue < 0.001) return 5;
    if (numValue < 0.01) return 5;
    if (numValue < 0.1) return 4;
    if (numValue < 1) return 3;
    if (numValue < 10) return 2;
    return 2;
  } catch (error) {
    console.error("[ERROR] Ошибка в getOptimalDecimals:", error);
    return 5; // Безопасное значение по умолчанию
  }
}

/**
 * Форматирует число UNI в строковое представление с нужной точностью
 * @param value Числовое значение UNI
 * @param maximumFractionDigits Максимальное количество знаков после запятой (по умолчанию 5)
 * @returns Отформатированное значение в виде строки
 */
export function formatUniNumber(value: number, maximumFractionDigits: number = 5): string {
  if (typeof value !== 'number' || isNaN(value)) {
    return '0.00000';
  }

  // Если число целое, добавляем десятичную часть с нулями для единообразия
  if (Number.isInteger(value)) {
    return value.toString() + '.00000'.substring(0, maximumFractionDigits + 1);
  }

  // Для очень маленьких сумм обеспечиваем отображение до 5 знаков
  const formatted = value.toLocaleString('en-US', {
    minimumFractionDigits: Math.min(3, maximumFractionDigits),
    maximumFractionDigits
  }).replace(/,/g, '');
  
  // Не обрезаем нули в конце, чтобы сохранить единообразие отображения
  return formatted;
}

/**
 * Форматирует число TON в строковое представление с нужной точностью
 * @param value Числовое значение TON
 * @param maximumFractionDigits Максимальное количество знаков после запятой (по умолчанию 5)
 * @returns Отформатированное значение в виде строки
 */
export function formatTonNumber(value: number, maximumFractionDigits: number = 5): string {
  if (typeof value !== 'number' || isNaN(value)) {
    return '0.00000';
  }

  // Если число целое, добавляем десятичную часть с нулями для единообразия
  if (Number.isInteger(value)) {
    return value.toString() + '.00000'.substring(0, maximumFractionDigits + 1);
  }

  // Для TON обеспечиваем отображение до 5 знаков (как и для UNI)
  const formatted = value.toLocaleString('en-US', {
    minimumFractionDigits: Math.min(3, maximumFractionDigits),
    maximumFractionDigits
  }).replace(/,/g, '');
  
  // Не обрезаем нули в конце, чтобы сохранить единообразие отображения
  return formatted;
}

/**
 * Форматирует сумму транзакции с знаком и символом валюты
 * @param amount Сумма
 * @param tokenType Тип токена (UNI/TON)
 * @param type Тип транзакции (для определения знака)
 * @returns Отформатированная строка суммы
 */
export function formatTransactionAmount(amount: number, tokenType: string, type?: string): string {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return `+0 ${tokenType || 'UNI'}`;
  }

  // Знак для суммы (withdrawals и ton_boost показываем как отрицательные)
  const isNegative = type === 'withdrawal' || type === 'purchase' || type === 'ton_boost' || type === 'boost';
  // Если сумма уже отрицательная, не добавляем еще один минус
  const isAlreadyNegative = typeof amount === 'number' && amount < 0;
  // Для ton_farming_reward всегда показываем как положительную сумму
  const isPositiveOverride = type === 'ton_farming_reward';
  const sign = isPositiveOverride ? '+' : (isNegative && !isAlreadyNegative ? '-' : '+');
  const absoluteAmount = Math.abs(amount);
  
  // Форматируем в зависимости от типа токена
  const formattedAmount = tokenType === 'TON' 
    ? formatTonNumber(absoluteAmount) 
    : formatUniNumber(absoluteAmount);
  
  return `${sign}${formattedAmount} ${tokenType}`;
}

/**
 * Форматирует дату в формат "день месяц • часы:минуты"
 * @param date Объект даты или строка с датой
 * @returns Отформатированная строка даты
 */
export function formatDateTime(date: Date | string): string {
  // Преобразуем строку в объект даты, если это необходимо
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  // Проверяем валидность даты
  if (isNaN(dateObj.getTime())) {
    return 'Только что';
  }
  
  try {
    const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    const day = dateObj.getDate();
    const month = months[dateObj.getMonth()];
    const hours = dateObj.getHours().toString().padStart(2, '0');
    const minutes = dateObj.getMinutes().toString().padStart(2, '0');
    
    return `${day} ${month} • ${hours}:${minutes}`;
  } catch (error) {
    console.error('Ошибка форматирования даты:', error);
    return 'Только что';
  }
}

/**
 * Возвращает класс для стилизации транзакции в зависимости от типа и токена
 * @param tokenType Тип токена (UNI/TON)
 * @param type Тип транзакции
 * @returns CSS-класс для оформления
 */
export function getTransactionColorClass(tokenType: string, type?: string): string {
  if (tokenType === 'TON') {
    if (type === 'ton_boost' || type === 'boost') {
      return 'bg-indigo-500/10 text-indigo-400';
    }
    if (type === 'ton_farming_reward') {
      return 'bg-amber-500/10 text-amber-400';
    }
    return 'bg-cyan-500/10 text-cyan-400';
  }
  
  return 'bg-green-500/10 text-green-400';
}

/**
 * Возвращает эквивалент в USD для указанной суммы токена
 * @param amount Количество токена
 * @param tokenType Тип токена ('UNI' или 'TON')
 * @returns Строка с USD эквивалентом
 */
export function getUSDEquivalent(amount: number, tokenType: 'UNI' | 'TON'): string {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return '$0.00';
  }
  
  // Динамические курсы токенов к USD
  const exchangeRates = {
    'TON': 5.57, // Актуальный курс TON/USD
    'UNI': 0.12  // Актуальный курс UNI/USD
  };
  
  const rate = exchangeRates[tokenType];
  const usdValue = amount * rate;
  
  // Форматируем с двумя знаками после запятой и символом доллара
  return `$${usdValue.toFixed(2)}`;
}

/**
 * Возвращает иконку для транзакции в зависимости от типа
 * @param type Тип транзакции
 * @param tokenType Тип токена
 * @returns Название иконки из FontAwesome
 */
export function getTransactionIcon(type: string, tokenType: string): string {
  if (type === 'farming' || type === 'farming_reward' || type === 'farming_harvest') {
    return 'fa-seedling';
  }
  if (type === 'boost_farming') {
    return 'fa-bolt';
  }
  if (type === 'ton_boost' || type === 'boost') {
    return 'fa-rocket';
  }
  if (type === 'ton_farming_reward') {
    return 'fa-bolt';
  }
  if (type === 'check-in' || type === 'daily_bonus' || type === 'signup_bonus') {
    return 'fa-gift';
  }
  if (type === 'reward' || type === 'mission' || type === 'referral_reward' || type === 'referral_bonus' || type === 'referral') {
    return 'fa-award';
  }
  if (type === 'withdrawal') {
    return 'fa-arrow-up';
  }
  if (type === 'deposit') {
    return 'fa-arrow-down';
  }
  
  // Возвращаем иконку по умолчанию
  return tokenType === 'UNI' ? 'fa-leaf' : 'fa-tenge';
}

/**
 * Безопасно форматирует число с учётом типа валюты
 * Использует соответствующие форматтеры, с защитой от ошибок
 * 
 * @param value Числовое значение для форматирования
 * @param decimals Количество десятичных знаков (по умолчанию определяется автоматически)
 * @param currency Валюта (TON или UNI)
 * @returns Отформатированная строка
 */
export function safeFormatAmount(value: number | string, decimals?: number, currency: string = 'UNI'): string {
  try {
    // Валидация входных параметров
    if (value === undefined || value === null) {
      return decimals !== undefined ? "0".padEnd(decimals + 2, "0") : "0";
    }
    
    // Безопасное преобразование к числу
    let numValue: number;
    if (typeof value === 'string') {
      // Очистка строки от нечисловых символов, кроме точки и минуса
      const cleanStr = value.replace(/[^\d.-]/g, '');
      numValue = parseFloat(cleanStr);
    } else if (typeof value === 'number') {
      numValue = value;
    } else {
      console.warn(`[WARNING] Форматтер - Неподдерживаемый тип значения: ${typeof value}`);
      return decimals !== undefined ? "0".padEnd(decimals + 2, "0") : "0";
    }
    
    // Проверка на валидное число
    if (!isFinite(numValue)) {
      console.warn(`[WARNING] Форматтер - Невалидное число для форматирования: ${value}`);
      return decimals !== undefined ? "0".padEnd(decimals + 2, "0") : "0";
    }
    
    // Определяем оптимальное количество десятичных знаков, если не указано явно
    const optimalDecimals = decimals !== undefined ? decimals : getOptimalDecimals(numValue, currency);
    
    // Используем глобальные форматтеры
    try {
      if (currency === 'TON') {
        return formatTonNumber(numValue, optimalDecimals);
      } else {
        return formatUniNumber(numValue, optimalDecimals);
      }
    } catch (formatterError) {
      console.error("[ERROR] Форматтер - Ошибка при использовании форматтера:", formatterError);
      
      // Запасной вариант, если глобальный форматтер не сработал
      if (numValue > 0 && numValue < Math.pow(10, -optimalDecimals)) {
        const minDisplayValue = Math.pow(10, -optimalDecimals);
        const formatted = minDisplayValue.toFixed(optimalDecimals);
        return formatted;
      }
      
      // Форматируем с нужным количеством знаков и добавляем нули, если нужно
      const formatted = numValue.toFixed(optimalDecimals);
      return formatted;
    }
  } catch (error) {
    console.error("[ERROR] Форматтер - Критическая ошибка в safeFormatAmount:", error);
    // Безопасное значение при ошибке
    return decimals !== undefined ? "0".padEnd(decimals + 2, "0") : "0";
  }
}