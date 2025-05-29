/**
 * Утиліта для уніфікованого керування транзакціями бази даних
 * 
 * Цей модуль забезпечує стандартизований підхід до роботи з транзакціями
 * для всіх сервісів. Він надає функції-обгортки, які автоматично обробляють
 * початок, фіксацію та відкат транзакцій.
 */

import { PoolClient } from 'pg';
import { pool } from '../db';

/**
 * Опції для виконання транзакції
 */
export interface TransactionOptions {
  /** Максимальна кількість спроб при помилці (за замовчуванням 3) */
  maxRetries?: number;
  /** Затримка між повторними спробами в мс (за замовчуванням 500) */
  retryDelay?: number;
  /** Таймаут транзакції в мс (за замовчуванням 30000) */
  timeout?: number;
  /** Ізоляція транзакції (за замовчуванням READ COMMITTED) */
  isolationLevel?: 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';
  /** Чи логувати транзакцію (за замовчуванням false) */
  logging?: boolean;
}

/**
 * Виконує операцію в межах транзакції з автоматичним управлінням підключенням
 * 
 * @param operation Функція, яка виконується в межах транзакції (отримує клієнт БД)
 * @param options Опції для виконання транзакції
 * @returns Результат виконання операції
 */
export async function withTransaction<T>(
  operation: (client: PoolClient) => Promise<T>,
  options: TransactionOptions = {}
): Promise<T> {
  // Встановлюємо значення за замовчуванням
  const {
    maxRetries = 3,
    retryDelay = 500,
    timeout = 30000,
    isolationLevel = 'READ COMMITTED',
    logging = false
  } = options;
  
  let client: PoolClient | null = null;
  let retries = 0;
  let lastError: Error | null = null;
  
  while (retries <= maxRetries) {
    try {
      // Отримуємо клієнт з пулу
      client = await pool.connect();
      
      if (logging) {
        console.log(`[Transaction] Початок транзакції (спроба ${retries + 1}/${maxRetries + 1})`);
      }
      
      // Встановлюємо таймаут для транзакції
      await client.query(`SET statement_timeout = ${timeout}`);
      
      // Встановлюємо рівень ізоляції
      await client.query(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`);
      
      // Починаємо транзакцію
      await client.query('BEGIN');
      
      // Виконуємо операцію
      const result = await operation(client);
      
      // Фіксуємо транзакцію
      await client.query('COMMIT');
      
      if (logging) {
        console.log('[Transaction] Транзакція успішно завершена');
      }
      
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Якщо клієнт існує, пробуємо відкатити транзакцію
      if (client) {
        try {
          await client.query('ROLLBACK');
          if (logging) {
            console.error(`[Transaction] Транзакція відкачена: ${lastError.message}`);
          }
        } catch (rollbackError) {
          console.error('[Transaction] Помилка при відкаті транзакції:', rollbackError);
        }
      }
      
      // Перевіряємо, чи потрібно повторити спробу
      const isRetryableError = isErrorRetryable(lastError);
      
      if (isRetryableError && retries < maxRetries) {
        retries++;
        const delay = retryDelay * Math.pow(2, retries - 1); // Експоненційна затримка
        
        if (logging) {
          console.log(`[Transaction] Повторна спроба через ${delay}мс...`);
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Якщо не можна повторити або вичерпані спроби, пробрасываємо помилку
      throw new TransactionError(
        `Помилка транзакції: ${lastError.message}`, 
        lastError
      );
    } finally {
      // Завжди звільняємо клієнт
      if (client) {
        try {
          client.release();
        } catch (releaseError) {
          console.error('[Transaction] Помилка при звільненні клієнта:', releaseError);
        }
      }
    }
  }
  
  // Цей код не повинен бути досягнутий, але для TypeScript
  throw lastError || new Error('Невідома помилка транзакції');
}

/**
 * Виконує групу операцій в межах однієї транзакції
 * 
 * @param operations Масив функцій для виконання в транзакції
 * @param options Опції для виконання транзакції
 * @returns Масив результатів виконання операцій
 */
export async function withBatchTransaction<T>(
  operations: ((client: PoolClient) => Promise<T>)[],
  options: TransactionOptions = {}
): Promise<T[]> {
  return withTransaction(async (client) => {
    const results: T[] = [];
    
    for (const operation of operations) {
      const result = await operation(client);
      results.push(result);
    }
    
    return results;
  }, options);
}

/**
 * Перевіряє, чи можна повторити операцію при даній помилці
 * 
 * @param error Об'єкт помилки
 * @returns true, якщо помилку можна обробити повторною спробою
 */
function isErrorRetryable(error: Error): boolean {
  const errorMessage = error.message.toLowerCase();
  
  // Помилки, які можна повторити
  const retryableErrors = [
    'deadlock detected',
    'could not serialize access',
    'serialization failure',
    'connection',
    'timeout',
    'temporarily unavailable',
    'idle in transaction',
    'connection terminated',
    'connection reset',
    'server closed the connection',
    'socket closed'
  ];
  
  return retryableErrors.some(errMsg => errorMessage.includes(errMsg));
}

/**
 * Клас для помилок транзакцій з додатковим контекстом
 */
export class TransactionError extends Error {
  cause: Error;
  
  constructor(message: string, cause: Error) {
    super(message);
    this.name = 'TransactionError';
    this.cause = cause;
  }
}