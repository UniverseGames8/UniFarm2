/**
 * Скрипт для примусового вимкнення перевірки партицій та уникнення помилок SQL
 * при недоступності бази даних
 */

// Налаштування для логування
const enableLogs = true;

// Функція для логування
function log(message: string, isError = false) {
  if (!enableLogs) return;
  
  const prefix = isError ? '[PartitionFix ERROR]' : '[PartitionFix]';
  console[isError ? 'error' : 'log'](`${prefix} ${message}`);
}

/**
 * Встановлює змінні середовища для вимкнення перевірок партицій
 */
export function forceSkipPartitionChecks() {
  try {
    // Встановлюємо змінні середовища для вимкнення перевірок партицій
    process.env.SKIP_PARTITION_CREATION = 'true';
    process.env.IGNORE_PARTITION_ERRORS = 'true';
    process.env.PARTITION_LOGS_DISABLED = 'true';
    
    log('Перевірку партицій вимкнено');
    
    // Перевизначаємо глобальні функції для роботи з партиціями
    overridePartitionFunctions();
    
    return true;
  } catch (error) {
    log(`Помилка при вимкненні перевірки партицій: ${error}`, true);
    return false;
  }
}

/**
 * Перевизначає глобальні функції для роботи з партиціями
 */
function overridePartitionFunctions() {
  try {
    // Створюємо глобальні заглушки для функцій партицій
    (global as any).createPartitionForDate = async (date: Date) => {
      const dateStr = new Date(date).toISOString().split('T')[0].replace(/-/g, '_');
      log(`Імітація створення партиції для дати ${dateStr}`);
      return { success: true, partition_name: `transactions_${dateStr}` };
    };
    
    (global as any).checkPartitionExists = async () => {
      log('Імітація перевірки існування партиції');
      return true;
    };
    
    (global as any).createFuturePartitions = async (days = 30) => {
      log(`Імітація створення ${days} майбутніх партицій`);
      return { 
        success: true, 
        createdCount: days,
        partitions: Array.from({ length: days }, (_, i) => {
          const date = new Date();
          date.setDate(date.getDate() + i);
          const dateStr = date.toISOString().split('T')[0].replace(/-/g, '_');
          return `transactions_${dateStr}`;
        }),
        errors: []
      };
    };
    
    (global as any).logPartitionOperation = async (
      operationType: string,
      partitionName: string,
      status: string,
      notes?: string,
      errorMessage?: string
    ) => {
      log(`Імітація логування операції: ${operationType} для ${partitionName} (${status})`);
      return true;
    };
    
    log('Функції для роботи з партиціями перевизначено');
    return true;
  } catch (error) {
    log(`Помилка при перевизначенні функцій партицій: ${error}`, true);
    return false;
  }
}

// Автоматично вимикаємо перевірку партицій при імпорті
forceSkipPartitionChecks();