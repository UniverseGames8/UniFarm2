/**
 * ВНИМАНИЕ: Используйте импорт из services/index.ts вместо прямого импорта
 * 
 * Этот файл является прокси-оберткой для обратной совместимости.
 * Для новых разработок используйте инстанс partitionService из services/index.ts
 */
import { partitionServiceInstance } from './partitionServiceInstance';
import { 
  PartitionInfo, 
  PartitionLog, 
  IPartitionService 
} from './partitionServiceInstance';
import { format, addDays } from 'date-fns';
import { sql } from '@vercel/postgres';
import { db } from '../db';

// Реэкспортируем типы для удобства
export { 
  PartitionInfo, 
  PartitionLog, 
  IPartitionService 
};

/**
 * @deprecated Используйте инстанс partitionService из services/index.ts вместо статических методов
 */
export class PartitionService {
  /**
   * Проверяет, является ли таблица партиционированной
   */
  static async isTablePartitioned(tableName?: string): Promise<boolean> {
    return partitionServiceInstance.isTablePartitioned(tableName);
  }

  /**
   * Получает список всех партиций с информацией о них
   */
  static async getPartitionsList(): Promise<PartitionInfo[]> {
    return partitionServiceInstance.getPartitionsList();
  }

  /**
   * Получает логи операций с партициями
   * @param limit максимальное количество записей
   */
  static async getPartitionLogs(limit?: number): Promise<PartitionLog[]> {
    return partitionServiceInstance.getPartitionLogs(limit);
  }

  /**
   * Проверяет существование партиции
   */
  static async isPartitionExists(partitionName: string): Promise<boolean> {
    try {
      const result = await db.execute(sql`
        SELECT EXISTS (
          SELECT 1 FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = ${partitionName}
        );
      `);
      
      return result.rows[0].exists;
    } catch (error) {
      console.error(`Error checking if partition ${partitionName} exists:`, error);
      return false;
    }
  }

  /**
   * Создаёт партицию для указанной даты
   */
  static async createPartitionForDate(date: Date): Promise<{
    success: boolean;
    partition_name?: string;
    error?: string;
    message?: string;
  }> {
    try {
      // Проверяем, не пересекается ли дата с future partition
      const today = new Date();
      if (date > today && date < new Date(today.getFullYear() + 1, 0, 1)) {
        return {
          success: false,
          error: 'Cannot create partition that overlaps with future partition'
        };
      }

      const partitionName = `transactions_${date.getFullYear()}_${String(date.getMonth() + 1).padStart(2, '0')}`;

      // Оптимизированная проверка для Neon
      const partitionExists = await this.isPartitionExists(partitionName);
      if (partitionExists) {
        return {
          success: true,
          partition_name: partitionName,
          message: 'Partition already exists'
        };
      }

      // Создаем новую партицию напрямую
      await this.createPartitionDirect(date, partitionName);
      
      return {
        success: true,
        partition_name: partitionName,
        message: 'Partition created successfully'
      };
    } catch (error) {
      console.error('Error creating partition:', error);
      return {
        success: false,
        error: error.message || 'Unknown error'
      };
    }
  }

  /**
   * Создаёт партицию для указанной даты напрямую через SQL
   */
  static async createPartitionDirect(date: Date, partitionName: string): Promise<void> {
    try {
      // Safely detach future partition
      const futureExists = await db.execute(sql`
        SELECT EXISTS (
          SELECT 1 FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = 'transactions_future'
        );
      `);
      
      if (futureExists.rows[0].exists) {
        await db.execute(sql`
          BEGIN;
          ALTER TABLE transactions DETACH PARTITION transactions_future;
          DROP TABLE IF EXISTS transactions_future;
          COMMIT;
        `);
      }

      // Create new partition
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS ${sql.identifier(partitionName)} (
          LIKE transactions INCLUDING ALL
        );

        ALTER TABLE ${sql.identifier(partitionName)} ADD CONSTRAINT ${sql.identifier(`${partitionName}_date_check`)} 
        CHECK (created_at >= ${format(date, 'yyyy-MM-dd')}::timestamp AND created_at < ${format(addDays(date, 1), 'yyyy-MM-dd')}::timestamp);

        ALTER TABLE transactions ATTACH PARTITION ${sql.identifier(partitionName)}
        FOR VALUES FROM (${format(date, 'yyyy-MM-dd')}) TO (${format(addDays(date, 1), 'yyyy-MM-dd')});
      `);

      // Recreate future partition
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS transactions_future (
          LIKE transactions INCLUDING ALL
        );

        ALTER TABLE transactions ATTACH PARTITION transactions_future
        FOR VALUES FROM (${format(addDays(date, 1), 'yyyy-MM-dd')}) TO (MAXVALUE);
      `);
    } catch (error) {
      console.error('Error in createPartitionDirect:', error);
      throw error;
    }
  }

  /**
   * Создаёт партиции на будущие даты
   * @param daysAhead на сколько дней вперед создавать партиции
   */
  static async createFuturePartitions(daysAhead?: number): Promise<{
    success: boolean;
    createdCount: number;
    partitions: string[];
    errors: string[];
  }> {
    // Партиції створюються через сервісний екземпляр
    return partitionServiceInstance.createFuturePartitions(daysAhead);
  }

  /**
   * Добавляет запись в лог операций с партициями
   */
  static async logPartitionOperation(
    operationType: string,
    partitionName: string,
    status: string,
    notes?: string,
    errorMessage?: string
  ): Promise<boolean> {
    return partitionServiceInstance.logPartitionOperation(
      operationType,
      partitionName,
      status,
      notes,
      errorMessage
    );
  }
}