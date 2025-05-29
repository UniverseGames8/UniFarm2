/**
 * Централизованный сервис валидации для всех финансовых операций
 * 
 * Этот сервис обеспечивает единую точку валидации для всех операций,
 * связанных с изменением баланса пользователя, фармингом и партнерской программой.
 * 
 * Включает проверки:
 * - Минимальных и максимальных значений для депозитов и выводов
 * - Формата и точности чисел
 * - Идемпотентности операций (защита от дублирования)
 * - Логики и зависимостей между различными финансовыми потоками
 */

import { ValidationError, InsufficientFundsError } from '../middleware/errorHandler';
import { WalletCurrency } from './walletServiceInstance';
import { z } from 'zod';
import * as crypto from 'crypto';

/**
 * Интерфейс для запросов операций с балансом
 */
export interface BalanceOperationRequest {
  userId: number;
  amount: string | number;
  currency: string;
  source?: string;
  category?: string;
  operationType: string;
  idempotencyKey?: string;
}

/**
 * Результат валидации
 */
export interface ValidationResult {
  success: boolean;
  error?: string;
  data?: any; // Дополнительные данные, если нужны
}

/**
 * Интерфейс валидатора
 */
export interface IValidationService {
  /**
   * Валидирует операцию с балансом пользователя
   * @param request Параметры операции
   * @returns Результат валидации
   */
  validateBalanceOperation(request: BalanceOperationRequest): ValidationResult;

  /**
   * Валидирует операцию фарминга
   * @param userId ID пользователя
   * @param amount Сумма депозита/харвеста
   * @param operationType Тип операции (deposit, harvest)
   * @param idempotencyKey Ключ идемпотентности для предотвращения дублирования
   * @returns Результат валидации
   */
  validateFarmingOperation(
    userId: number,
    amount: string | number,
    operationType: string,
    idempotencyKey?: string
  ): ValidationResult;

  /**
   * Валидирует операцию партнерской программы
   * @param userId ID пользователя
   * @param referralId ID реферала
   * @param amount Сумма бонуса
   * @param level Уровень партнерства
   * @param idempotencyKey Ключ идемпотентности
   * @returns Результат валидации
   */
  validateReferralOperation(
    userId: number,
    referralId: number,
    amount: string | number,
    level: number,
    idempotencyKey?: string
  ): ValidationResult;

  /**
   * Проверяет и парсит число
   * @param value Значение для проверки
   * @param options Опции проверки
   * @returns Число в формате string с фиксированной точностью
   */
  validateAndParseNumber(
    value: string | number,
    options?: {
      min?: number;
      max?: number;
      currency?: string;
      precision?: number;
    }
  ): string;

  /**
   * Генерирует ключ идемпотентности для операции
   * @param operationData Данные операции
   * @returns Ключ идемпотентности
   */
  generateIdempotencyKey(operationData: any): string;

  /**
   * Проверяет, была ли операция уже выполнена с данным ключом идемпотентности
   * @param idempotencyKey Ключ идемпотентности
   * @returns true, если операция уже выполнялась
   */
  isOperationDuplicate(idempotencyKey: string): boolean;

  /**
   * Регистрирует выполненную операцию с ключом идемпотентности
   * @param idempotencyKey Ключ идемпотентности
   * @param result Результат операции
   */
  registerCompletedOperation(idempotencyKey: string, result: any): void;
}

/**
 * Класс для реализации валидации всех финансовых операций
 */
export class ValidationService implements IValidationService {
  // Кэш операций для предотвращения дублирования
  private operationCache: Map<string, any> = new Map();

  // Константы валидации
  private readonly LIMITS = {
    UNI: {
      MIN_DEPOSIT: 1,           // Минимальный депозит UNI
      MAX_DEPOSIT: 10000000,    // Максимальный депозит UNI
      MIN_WITHDRAW: 100,        // Минимальный вывод UNI
      MAX_WITHDRAW: 1000000     // Максимальный вывод UNI
    },
    TON: {
      MIN_DEPOSIT: 0.1,          // Минимальный депозит TON
      MAX_DEPOSIT: 1000,         // Максимальный депозит TON 
      MIN_WITHDRAW: 0.1,         // Минимальный вывод TON
      MAX_WITHDRAW: 100          // Максимальный вывод TON
    },
    FARMING: {
      MIN_DEPOSIT: 0.001,        // Минимальный депозит в фарминг (согласовано с сервисом)
      MAX_DEPOSIT: 1000000,      // Максимальный депозит в фарминг
      MIN_HARVEST: 0.000001,     // Минимальный сбор с фарминга
      MAX_HARVEST: 1000000       // Максимальный сбор с фарминга
    },
    PRECISION: {
      UNI: 6,                    // Кол-во значащих цифр после запятой для UNI
      TON: 6                     // Кол-во значащих цифр после запятой для TON
    }
  };

  /**
   * Валидирует операцию с балансом пользователя
   * @param request Параметры операции
   * @returns Результат валидации
   */
  validateBalanceOperation(request: BalanceOperationRequest): ValidationResult {
    try {
      // Проверка idempotency key, если указан
      if (request.idempotencyKey && this.isOperationDuplicate(request.idempotencyKey)) {
        return {
          success: false,
          error: 'Эта операция уже была выполнена ранее'
        };
      }

      // Проверка обязательных полей
      if (!request.userId) {
        return { success: false, error: 'Не указан ID пользователя' };
      }

      if (request.userId <= 0) {
        return { success: false, error: 'Некорректный ID пользователя' };
      }

      if (!request.amount) {
        return { success: false, error: 'Не указана сумма операции' };
      }

      if (!request.currency) {
        return { success: false, error: 'Не указана валюта операции' };
      }

      if (!request.operationType) {
        return { success: false, error: 'Не указан тип операции' };
      }

      // Проверка и нормализация валюты
      const currency = request.currency.toUpperCase();
      if (currency !== 'UNI' && currency !== 'TON') {
        return { success: false, error: 'Неподдерживаемая валюта' };
      }

      // Проверка типа операции и соответствующих лимитов
      const parsedAmount = parseFloat(String(request.amount));
      
      if (isNaN(parsedAmount)) {
        return { success: false, error: 'Некорректный формат суммы' };
      }

      // Проверка на отрицательное значение
      if (request.operationType !== 'withdraw' && parsedAmount < 0) {
        return { success: false, error: 'Сумма не может быть отрицательной' };
      }

      // Валидация по типу операции
      switch (request.operationType) {
        case 'deposit':
          if (parsedAmount < this.LIMITS[currency].MIN_DEPOSIT) {
            return { 
              success: false, 
              error: `Минимальная сумма для депозита ${currency}: ${this.LIMITS[currency].MIN_DEPOSIT}` 
            };
          }
          if (parsedAmount > this.LIMITS[currency].MAX_DEPOSIT) {
            return { 
              success: false, 
              error: `Максимальная сумма для депозита ${currency}: ${this.LIMITS[currency].MAX_DEPOSIT}` 
            };
          }
          break;
        
        case 'withdraw':
          const absAmount = Math.abs(parsedAmount);
          if (absAmount < this.LIMITS[currency].MIN_WITHDRAW) {
            return { 
              success: false, 
              error: `Минимальная сумма для вывода ${currency}: ${this.LIMITS[currency].MIN_WITHDRAW}` 
            };
          }
          if (absAmount > this.LIMITS[currency].MAX_WITHDRAW) {
            return { 
              success: false, 
              error: `Максимальная сумма для вывода ${currency}: ${this.LIMITS[currency].MAX_WITHDRAW}` 
            };
          }
          break;
          
        case 'transfer':
          // Проверки для трансфера между пользователями
          if (parsedAmount <= 0) {
            return { success: false, error: 'Сумма трансфера должна быть положительной' };
          }
          break;
          
        case 'reward':
        case 'bonus':
          // Для наград и бонусов проверяем только положительность
          if (parsedAmount <= 0) {
            return { success: false, error: 'Сумма награды должна быть положительной' };
          }
          break;
          
        default:
          return { success: false, error: 'Неизвестный тип операции' };
      }

      // Если все проверки пройдены, возвращаем успех
      return { 
        success: true,
        data: {
          userId: request.userId,
          amount: this.validateAndParseNumber(parsedAmount, { 
            currency, 
            precision: this.LIMITS.PRECISION[currency] 
          }),
          currency,
          operationType: request.operationType,
          source: request.source,
          category: request.category
        }
      };
    } catch (error) {
      console.error('[ValidationService] Error validating balance operation:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Ошибка валидации операции с балансом' 
      };
    }
  }

  /**
   * Валидирует операцию фарминга
   * @param userId ID пользователя
   * @param amount Сумма депозита/харвеста
   * @param operationType Тип операции (deposit, harvest)
   * @param idempotencyKey Ключ идемпотентности для предотвращения дублирования
   * @returns Результат валидации
   */
  validateFarmingOperation(
    userId: number,
    amount: string | number,
    operationType: string,
    idempotencyKey?: string
  ): ValidationResult {
    try {
      // Проверка idempotency key, если указан
      if (idempotencyKey && this.isOperationDuplicate(idempotencyKey)) {
        return {
          success: false,
          error: 'Эта операция фарминга уже была выполнена ранее'
        };
      }

      // Проверка обязательных полей
      if (!userId || userId <= 0) {
        return { success: false, error: 'Некорректный ID пользователя' };
      }

      if (amount === undefined || amount === null) {
        return { success: false, error: 'Не указана сумма операции фарминга' };
      }

      if (!operationType) {
        return { success: false, error: 'Не указан тип операции фарминга' };
      }

      // Проверка типа операции и соответствующих лимитов
      const parsedAmount = parseFloat(String(amount));
      
      if (isNaN(parsedAmount)) {
        return { success: false, error: 'Некорректный формат суммы фарминга' };
      }

      // Валидация по типу операции фарминга
      switch (operationType) {
        case 'deposit':
          if (parsedAmount < this.LIMITS.FARMING.MIN_DEPOSIT) {
            return { 
              success: false, 
              error: `Минимальная сумма для депозита в фарминг: ${this.LIMITS.FARMING.MIN_DEPOSIT} UNI` 
            };
          }
          if (parsedAmount > this.LIMITS.FARMING.MAX_DEPOSIT) {
            return { 
              success: false, 
              error: `Максимальная сумма для депозита в фарминг: ${this.LIMITS.FARMING.MAX_DEPOSIT} UNI` 
            };
          }
          break;
        
        case 'harvest':
          if (parsedAmount < this.LIMITS.FARMING.MIN_HARVEST) {
            return { 
              success: false, 
              error: `Минимальная сумма для сбора наград: ${this.LIMITS.FARMING.MIN_HARVEST} UNI` 
            };
          }
          if (parsedAmount > this.LIMITS.FARMING.MAX_HARVEST) {
            return { 
              success: false, 
              error: `Максимальная сумма для сбора наград: ${this.LIMITS.FARMING.MAX_HARVEST} UNI` 
            };
          }
          break;
          
        default:
          return { success: false, error: 'Неизвестный тип операции фарминга' };
      }

      // Если все проверки пройдены, возвращаем успех
      return { 
        success: true,
        data: {
          userId,
          amount: this.validateAndParseNumber(parsedAmount, { 
            currency: 'UNI', 
            precision: this.LIMITS.PRECISION.UNI 
          }),
          operationType
        }
      };
    } catch (error) {
      console.error('[ValidationService] Error validating farming operation:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Ошибка валидации операции фарминга' 
      };
    }
  }

  /**
   * Валидирует операцию партнерской программы
   * @param userId ID пользователя (получатель бонуса)
   * @param referralId ID реферала (источник бонуса)
   * @param amount Сумма бонуса
   * @param level Уровень партнерства
   * @param idempotencyKey Ключ идемпотентности
   * @returns Результат валидации
   */
  validateReferralOperation(
    userId: number,
    referralId: number,
    amount: string | number,
    level: number,
    idempotencyKey?: string
  ): ValidationResult {
    try {
      // Проверка idempotency key, если указан
      if (idempotencyKey && this.isOperationDuplicate(idempotencyKey)) {
        return {
          success: false,
          error: 'Эта операция партнерской программы уже была выполнена ранее'
        };
      }

      // Проверка обязательных полей
      if (!userId || userId <= 0) {
        return { success: false, error: 'Некорректный ID получателя бонуса' };
      }

      if (!referralId || referralId <= 0) {
        return { success: false, error: 'Некорректный ID реферала' };
      }

      if (amount === undefined || amount === null) {
        return { success: false, error: 'Не указана сумма партнерского бонуса' };
      }

      if (!level || level <= 0 || level > 10) {
        return { success: false, error: 'Некорректный уровень партнерства (допустимы значения от 1 до 10)' };
      }

      // Нельзя получать бонусы от самого себя
      if (userId === referralId) {
        return { success: false, error: 'Невозможно получить партнерский бонус от самого себя' };
      }

      // Проверка суммы бонуса
      const parsedAmount = parseFloat(String(amount));
      
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return { success: false, error: 'Некорректная сумма партнерского бонуса' };
      }

      // Если все проверки пройдены, возвращаем успех
      return { 
        success: true,
        data: {
          userId,
          referralId,
          amount: this.validateAndParseNumber(parsedAmount, { 
            currency: 'UNI', 
            precision: this.LIMITS.PRECISION.UNI 
          }),
          level
        }
      };
    } catch (error) {
      console.error('[ValidationService] Error validating referral operation:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Ошибка валидации операции партнерской программы' 
      };
    }
  }

  /**
   * Проверяет и парсит число
   * @param value Значение для проверки
   * @param options Опции проверки
   * @returns Число в формате string с фиксированной точностью
   */
  validateAndParseNumber(
    value: string | number,
    options: {
      min?: number;
      max?: number;
      currency?: string;
      precision?: number;
    } = {}
  ): string {
    // Определяем значения по умолчанию
    const {
      min = Number.MIN_SAFE_INTEGER,
      max = Number.MAX_SAFE_INTEGER,
      currency = 'UNI',
      precision = this.LIMITS.PRECISION.UNI
    } = options;

    // Пытаемся преобразовать значение в число
    let numValue: number;
    let strValue: string;
    
    if (typeof value === 'string') {
      // Заменяем запятую на точку в строковом значении
      strValue = value.replace(',', '.');
      numValue = parseFloat(strValue);
    } else {
      numValue = value;
      strValue = value.toString();
    }

    // Проверяем, что значение является числом
    if (isNaN(numValue)) {
      throw new ValidationError('Некорректный формат числа', { value: strValue });
    }

    // Проверяем ограничения min и max
    if (numValue < min) {
      throw new ValidationError(`Значение не может быть меньше ${min} ${currency}`, { value: strValue, min: min.toString() });
    }

    if (numValue > max) {
      throw new ValidationError(`Значение не может быть больше ${max} ${currency}`, { value: strValue, max: max.toString() });
    }

    // Форматируем число с указанной точностью
    return numValue.toFixed(precision);
  }

  /**
   * Генерирует ключ идемпотентности для операции
   * @param operationData Данные операции
   * @returns Ключ идемпотентности
   */
  generateIdempotencyKey(operationData: any): string {
    try {
      // Преобразуем данные операции в строку JSON
      const dataString = JSON.stringify(operationData);
      
      // Создаем хеш из данных операции
      return crypto.createHash('sha256').update(dataString).digest('hex');
    } catch (error) {
      console.error('[ValidationService] Error generating idempotency key:', error);
      // В случае ошибки возвращаем случайный ключ с префиксом 'fallback'
      return `fallback-${crypto.randomBytes(16).toString('hex')}`;
    }
  }

  /**
   * Проверяет, была ли операция уже выполнена с данным ключом идемпотентности
   * @param idempotencyKey Ключ идемпотентности
   * @returns true, если операция уже выполнялась
   */
  isOperationDuplicate(idempotencyKey: string): boolean {
    // Проверяем наличие ключа в кэше операций
    return this.operationCache.has(idempotencyKey);
  }

  /**
   * Регистрирует выполненную операцию с ключом идемпотентности
   * @param idempotencyKey Ключ идемпотентности
   * @param result Результат операции
   */
  registerCompletedOperation(idempotencyKey: string, result: any): void {
    // Сохраняем результат операции в кэше по ключу идемпотентности
    this.operationCache.set(idempotencyKey, {
      timestamp: new Date(),
      result
    });

    // Удаляем старые записи из кэша (например, старше 1 часа)
    this.cleanupOperationCache();
  }

  /**
   * Очищает устаревшие записи из кэша операций
   * @param maxAge Максимальный возраст записи в миллисекундах (по умолчанию 1 час)
   */
  private cleanupOperationCache(maxAge: number = 3600000): void {
    const now = new Date().getTime();
    
    // Проходим по всем записям в кэше (с использованием Array.from для итерации)
    Array.from(this.operationCache.entries()).forEach(([key, value]) => {
      const timestamp = value.timestamp.getTime();
      
      // Если запись старше maxAge, удаляем её
      if (now - timestamp > maxAge) {
        this.operationCache.delete(key);
      }
    });
  }
}

/**
 * Создаем единственный экземпляр сервиса валидации
 */
export const validationServiceInstance = new ValidationService();

/**
 * Фабрика для создания сервиса валидации
 */
export function createValidationService(): IValidationService {
  return validationServiceInstance;
}