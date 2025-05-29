/**
 * Временная заглушка сервиса для управления партициями
 * Создана для избежания ошибок деплоя
 */

// Базовые интерфейсы
export interface PartitionInfo {
  partition_name: string;
  partition_expression?: string;
  record_count?: number;
  size?: string;
}

export interface PartitionLog {
  id: number;
  operation_type: string;
  partition_name: string;
  status: string;
  notes?: string;
  error_message?: string;
  created_at: Date;
}

// Интерфейс сервиса
export interface IPartitionService {
  isTablePartitioned(tableName?: string): Promise<boolean>;
  getPartitionsList(): Promise<PartitionInfo[]>;
  getPartitionLogs(limit?: number): Promise<PartitionLog[]>;
  createPartitionForDate(date: Date): Promise<{
    success: boolean;
    partition_name?: string;
    error?: string;
  }>;
  createFuturePartitions(daysAhead?: number): Promise<{
    success: boolean;
    createdCount: number;
    partitions: string[];
    errors: string[];
  }>;
  logPartitionOperation(
    operationType: string,
    partitionName: string,
    status: string,
    notes?: string,
    errorMessage?: string
  ): Promise<boolean>;
}

// Реализация заглушки
class PartitionServiceStub implements IPartitionService {
  async isTablePartitioned(tableName: string = 'transactions'): Promise<boolean> {
    console.log(`[PartitionService Stub] isTablePartitioned called for ${tableName}`);
    return false;
  }
  
  async getPartitionsList(): Promise<PartitionInfo[]> {
    console.log('[PartitionService Stub] getPartitionsList called');
    return [];
  }
  
  async getPartitionLogs(limit: number = 50): Promise<PartitionLog[]> {
    console.log(`[PartitionService Stub] getPartitionLogs called with limit ${limit}`);
    return [];
  }
  
  async createPartitionForDate(date: Date): Promise<{
    success: boolean;
    partition_name?: string;
    error?: string;
  }> {
    console.log(`[PartitionService Stub] createPartitionForDate called for ${date.toISOString()}`);
    return {
      success: false,
      error: 'Партиционирование временно отключено для деплоя'
    };
  }
  
  async createFuturePartitions(daysAhead: number = 5): Promise<{
    success: boolean;
    createdCount: number;
    partitions: string[];
    errors: string[];
  }> {
    console.log(`[PartitionService Stub] createFuturePartitions called for ${daysAhead} days ahead`);
    return {
      success: false,
      createdCount: 0,
      partitions: [],
      errors: ['Партиционирование временно отключено для деплоя']
    };
  }
  
  async logPartitionOperation(
    operationType: string,
    partitionName: string,
    status: string,
    notes?: string,
    errorMessage?: string
  ): Promise<boolean> {
    console.log(`[PartitionService Stub] logPartitionOperation called for ${operationType} on ${partitionName}`);
    return true;
  }
}

// Функция для создания сервиса
export function createPartitionService(): IPartitionService {
  console.log('[PartitionService] Creating partition service stub for deployment');
  return new PartitionServiceStub();
}

// Экспортируем экземпляр сервиса-заглушки
export const partitionServiceInstance = createPartitionService();