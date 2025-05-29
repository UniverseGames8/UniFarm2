/**
 * Допоміжний модуль для роботи з партиціями в режимі memory storage
 * 
 * Цей модуль забезпечує можливість роботи додатку без залежності від бази даних,
 * створюючи заглушки для операцій з партиціями та надаючи in-memory сховище
 * для логування операцій.
 */

import { format, addDays } from 'date-fns';
import fs from 'fs';
import path from 'path';

// Логгер для виводу інформації
const logger = {
  log: (message: string) => console.log(`[PartitionHelper] ${message}`),
  error: (message: string, error?: any) => console.error(`[PartitionHelper] ${message}`, error || ''),
  warn: (message: string) => console.warn(`[PartitionHelper] ${message}`)
};

// In-memory сховище для логів партицій
interface PartitionLog {
  id: number;
  operation_type: string;
  partition_name: string;
  status: string;
  notes?: string;
  error_message?: string;
  created_at: Date;
}

class PartitionMemoryStorage {
  private static instance: PartitionMemoryStorage;
  private logs: PartitionLog[] = [];
  private lastId = 0;
  
  private constructor() {
    // Приватний конструктор для сінглтона
  }
  
  public static getInstance(): PartitionMemoryStorage {
    if (!PartitionMemoryStorage.instance) {
      PartitionMemoryStorage.instance = new PartitionMemoryStorage();
    }
    return PartitionMemoryStorage.instance;
  }
  
  public addLog(
    operation_type: string,
    partition_name: string,
    status: string,
    notes?: string,
    error_message?: string
  ): PartitionLog {
    const log: PartitionLog = {
      id: ++this.lastId,
      operation_type,
      partition_name,
      status,
      notes,
      error_message,
      created_at: new Date()
    };
    
    this.logs.push(log);
    
    // Обмежуємо кількість логів у пам'яті
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }
    
    return log;
  }
  
  public getLogs(): PartitionLog[] {
    return [...this.logs];
  }
  
  public getLogsByOperation(operation_type: string): PartitionLog[] {
    return this.logs.filter(log => log.operation_type === operation_type);
  }
  
  public getLogsByPartition(partition_name: string): PartitionLog[] {
    return this.logs.filter(log => log.partition_name === partition_name);
  }
  
  public clearLogs(): void {
    this.logs = [];
    this.lastId = 0;
  }
}

/**
 * Функція для логування операцій з партиціями (в пам'яті)
 */
export async function logPartitionOperation(
  operationType: string,
  partitionName: string,
  status: string,
  notes?: string,
  errorMessage?: string
): Promise<boolean> {
  try {
    // Зберігаємо в in-memory сховище
    PartitionMemoryStorage.getInstance().addLog(
      operationType,
      partitionName,
      status,
      notes,
      errorMessage
    );
    
    logger.log(`Операція логування: ${operationType} для ${partitionName} зі статусом ${status}`);
    return true;
  } catch (error) {
    logger.error('Помилка при логуванні операції з партицією:', error);
    return false;
  }
}

/**
 * Перевіряє чи увімкнені партиції в середовищі
 */
export function isPartitioningEnabled(): boolean {
  return process.env.SKIP_PARTITION_CREATION !== 'true';
}

/**
 * Генерує імена партицій для заданого діапазону дат
 */
export function generatePartitionNames(startDate: Date, days: number = 30): string[] {
  const partitions: string[] = [];
  
  for (let i = 0; i < days; i++) {
    const date = addDays(startDate, i);
    const dateStr = format(date, 'yyyy_MM_dd');
    partitions.push(`transactions_${dateStr}`);
  }
  
  return partitions;
}

/**
 * Створює заглушку для операцій з партиціями, щоб уникнути помилок SQL
 */
export function createPartitionStub(): void {
  const stubPath = path.resolve(process.cwd(), 'server/scripts/partition_stub.ts');
  
  // Вміст файлу-заглушки
  const stubContent = `/**
 * Заглушка для операцій з партиціями при вимкненій БД
 */
import { format, addDays } from 'date-fns';

// Логгер
const logger = {
  log: (message: string) => console.log(\`[PartitionStub] \${message}\`),
  error: (message: string, error?: any) => console.error(\`[PartitionStub] \${message}\`, error || ''),
  warn: (message: string) => console.warn(\`[PartitionStub] \${message}\`)
};

// In-memory сховище для логів партицій
const partitionLogs = [];

/**
 * Додає запис у лог операцій з партиціями
 */
export async function logPartitionOperation(
  operationType,
  partitionName,
  status,
  notes,
  errorMessage
) {
  try {
    // Зберігаємо в пам'яті
    partitionLogs.push({
      id: partitionLogs.length + 1,
      operation_type: operationType,
      partition_name: partitionName,
      status,
      notes,
      error_message: errorMessage,
      created_at: new Date()
    });
    
    logger.log(\`Logged operation: \${operationType} for \${partitionName} with status \${status}\`);
    return true;
  } catch (error) {
    logger.error('Error logging partition operation:', error);
    return false;
  }
}

/**
 * Перевіряє наявність партиції для вказаної дати
 */
export async function checkPartitionExists(date) {
  // Завжди повертаємо true у режимі заглушки
  return true;
}

/**
 * Створює партицію для вказаної дати (заглушка)
 */
export async function createPartitionForDate(date) {
  const dateStr = format(date, 'yyyy_MM_dd');
  const partitionName = \`transactions_\${dateStr}\`;
  
  logger.log(\`Creating partition stub for \${partitionName}\`);
  
  // Логуємо операцію
  await logPartitionOperation(
    'create',
    partitionName,
    'success',
    \`Stub partition created for \${dateStr}\`
  );
  
  return {
    success: true,
    partition_name: partitionName
  };
}

/**
 * Створює майбутні партиції (заглушка)
 */
export async function createFuturePartitions(days = 30) {
  logger.log(\`Creating \${days} future partition stubs\`);
  
  const partitions = [];
  const today = new Date();
  
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    const result = await createPartitionForDate(date);
    
    if (result.success) {
      partitions.push(result.partition_name);
    }
  }
  
  return {
    success: true,
    createdCount: partitions.length,
    partitions,
    errors: []
  };
}
`;
  
  // Записуємо файл-заглушку
  if (!fs.existsSync(stubPath)) {
    fs.writeFileSync(stubPath, stubContent, 'utf8');
    logger.log('Створено заглушку для операцій з партиціями');
  }
}

/**
 * Ініціалізує допоміжні модулі для роботи з партиціями
 */
export function initPartitionHelpers(): void {
  // Встановлюємо змінні середовища для вимкнення помилок партицій
  process.env.SKIP_PARTITION_CREATION = 'true';
  process.env.IGNORE_PARTITION_ERRORS = 'true';
  
  // Створюємо заглушку
  createPartitionStub();
  
  logger.log('Ініціалізовано допоміжні модулі для роботи з партиціями');
}

// Автоматично ініціалізуємо при імпорті
initPartitionHelpers();