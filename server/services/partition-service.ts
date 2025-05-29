/**
 * ВНИМАНИЕ: Используйте импорт из services/index.ts вместо прямого импорта
 * 
 * Этот файл является прокси-оберткой для обратной совместимости.
 * Для новых разработок используйте инстанс partitionService из services/index.ts
 */

import { partitionServiceInstance } from './partitionServiceInstance';
export * from './partitionServiceInstance';

/**
 * @deprecated Используйте инстанс partitionService из services/index.ts
 */
class PartitionService {
  async isTablePartitioned(tableName: string = 'transactions'): Promise<boolean> {
    return partitionServiceInstance.isTablePartitioned(tableName);
  }
  
  async getPartitionsList() {
    return partitionServiceInstance.getPartitionsList();
  }
  
  async getPartitionLogs(limit: number = 50) {
    return partitionServiceInstance.getPartitionLogs(limit);
  }
  
  async createPartitionForDate(date: Date) {
    return partitionServiceInstance.createPartitionForDate(date);
  }
  
  async createFuturePartitions(daysAhead: number = 5) {
    return partitionServiceInstance.createFuturePartitions(daysAhead);
  }
  
  async logPartitionOperation(
    operationType: string,
    partitionName: string,
    status: string,
    notes?: string,
    errorMessage?: string
  ) {
    return partitionServiceInstance.logPartitionOperation(
      operationType,
      partitionName,
      status,
      notes,
      errorMessage
    );
  }
}

// Для обратной совместимости экспортируем старый экземпляр сервиса,
// но теперь он делегирует все вызовы новому экземпляру из partitionServiceInstance
export const partitionService = new PartitionService();