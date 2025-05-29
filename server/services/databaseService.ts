/**
 * Прокси для сервиса базы данных
 * 
 * Обеспечивает обратную совместимость со статическими вызовами
 * методов databaseService путем перенаправления их на экземпляр сервиса.
 */

import { databaseServiceInstance, IDatabaseService } from './databaseServiceInstance';

/**
 * Прокси класс для сервиса базы данных, перенаправляющий статические вызовы на экземпляр
 */
export class DatabaseService implements IDatabaseService {
  /**
   * Проверка состояния подключения к базе данных
   */
  static async checkConnection(): Promise<{ isConnected: boolean, error?: string }> {
    return databaseServiceInstance.checkConnection();
  }

  /**
   * Получение информации о состоянии базы данных
   */
  static async getDatabaseStatus(): Promise<{
    connectionStatus: string;
    tablesCount?: number;
    lastOperations?: Array<{ query: string, timestamp: Date }>;
    error?: string;
    databaseSize?: string;
    activeConnections?: string;
  }> {
    return databaseServiceInstance.getDatabaseStatus();
  }

  /**
   * Выполнение произвольного SQL-запроса
   */
  static async executeRawQuery<T = any>(query: string, params?: any[]): Promise<T[]> {
    return databaseServiceInstance.executeRawQuery<T>(query, params);
  }

  /**
   * Получение списка таблиц в базе данных
   */
  static async getTablesList(): Promise<string[]> {
    return databaseServiceInstance.getTablesList();
  }

  /**
   * Получение информации о структуре таблицы
   */
  static async getTableInfo(tableName: string): Promise<{
    columns: Array<{ name: string, type: string, nullable: boolean }>;
    constraints: Array<{ name: string, type: string, definition: string }>;
    indexes: Array<{ name: string, definition: string }>;
  }> {
    return databaseServiceInstance.getTableInfo(tableName);
  }

  /**
   * Создание резервной копии данных таблицы
   */
  static async backupTable(tableName: string): Promise<{ success: boolean, backupData?: any[], error?: string }> {
    return databaseServiceInstance.backupTable(tableName);
  }

  /**
   * Проверка целостности данных
   */
  static async checkDataIntegrity(options?: { tables?: string[], relations?: boolean }): Promise<{
    success: boolean;
    issues: Array<{ table: string, issue: string, severity: 'high' | 'medium' | 'low' }>;
  }> {
    return databaseServiceInstance.checkDataIntegrity(options);
  }

  async checkConnection(): Promise<{ isConnected: boolean, error?: string }> {
    return databaseServiceInstance.checkConnection();
  }

  async getDatabaseStatus(): Promise<{
    connectionStatus: string;
    tablesCount?: number;
    lastOperations?: Array<{ query: string, timestamp: Date }>;
    error?: string;
    databaseSize?: string;
    activeConnections?: string;
  }> {
    return databaseServiceInstance.getDatabaseStatus();
  }

  async executeRawQuery<T = any>(query: string, params: any[] = []): Promise<T[]> {
    return databaseServiceInstance.executeRawQuery<T>(query, params);
  }

  async getTablesList(): Promise<string[]> {
    return databaseServiceInstance.getTablesList();
  }

  async getTableInfo(tableName: string): Promise<{
    columns: Array<{ name: string, type: string, nullable: boolean }>;
    constraints: Array<{ name: string, type: string, definition: string }>;
    indexes: Array<{ name: string, definition: string }>;
  }> {
    return databaseServiceInstance.getTableInfo(tableName);
  }

  async backupTable(tableName: string): Promise<{ success: boolean, backupData?: any[], error?: string }> {
    return databaseServiceInstance.backupTable(tableName);
  }

  async checkDataIntegrity(options?: { tables?: string[], relations?: boolean }): Promise<{
    success: boolean;
    issues: Array<{ table: string, issue: string, severity: 'high' | 'medium' | 'low' }>;
  }> {
    return databaseServiceInstance.checkDataIntegrity(options);
  }
}

export const databaseService = databaseServiceInstance;