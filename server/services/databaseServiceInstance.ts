/**
 * Сервис для работы с базой данных
 * 
 * Предоставляет унифицированный интерфейс для выполнения запросов к базе данных,
 * управления подключениями и мониторинга состояния базы данных.
 */

import { db, pool } from "../db";
import { eq } from "drizzle-orm";

export interface IDatabaseService {
  /**
   * Проверка состояния подключения к базе данных
   */
  checkConnection(): Promise<{ isConnected: boolean, error?: string }>;
  
  /**
   * Получение информации о состоянии базы данных
   */
  getDatabaseStatus(): Promise<{
    connectionStatus: string;
    tablesCount?: number;
    lastOperations?: Array<{ query: string, timestamp: Date }>;
    error?: string;
  }>;
  
  /**
   * Выполнение произвольного SQL-запроса
   */
  executeRawQuery<T = any>(query: string, params?: any[]): Promise<T[]>;
  
  /**
   * Получение списка таблиц в базе данных
   */
  getTablesList(): Promise<string[]>;
  
  /**
   * Получение информации о структуре таблицы
   */
  getTableInfo(tableName: string): Promise<{
    columns: Array<{ name: string, type: string, nullable: boolean }>;
    constraints: Array<{ name: string, type: string, definition: string }>;
    indexes: Array<{ name: string, definition: string }>;
  }>;
  
  /**
   * Создание резервной копии данных таблицы
   */
  backupTable(tableName: string): Promise<{ success: boolean, backupData?: any[], error?: string }>;
  
  /**
   * Проверка целостности данных
   */
  checkDataIntegrity(options?: { tables?: string[], relations?: boolean }): Promise<{
    success: boolean;
    issues: Array<{ table: string, issue: string, severity: 'high' | 'medium' | 'low' }>;
  }>;
}

class DatabaseService implements IDatabaseService {
  // Сохраняем последние выполненные запросы для анализа
  private lastQueries: Array<{ query: string, timestamp: Date }> = [];
  private readonly MAX_QUERY_HISTORY = 20;

  // Логируем запрос в историю
  private logQuery(query: string): void {
    this.lastQueries.unshift({ query, timestamp: new Date() });
    
    if (this.lastQueries.length > this.MAX_QUERY_HISTORY) {
      this.lastQueries.pop();
    }
  }

  /**
   * Проверка состояния подключения к базе данных
   */
  async checkConnection(): Promise<{ isConnected: boolean, error?: string }> {
    try {
      // Выполняем простой запрос для проверки соединения
      await this.executeRawQuery('SELECT 1 as check_connection');
      return { isConnected: true };
    } catch (error) {
      console.error('[DatabaseService] Error in checkConnection:', error);
      return { 
        isConnected: false, 
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Получение информации о состоянии базы данных
   */
  async getDatabaseStatus(): Promise<{
    connectionStatus: string;
    tablesCount?: number;
    lastOperations?: Array<{ query: string, timestamp: Date }>;
    error?: string;
    databaseSize?: string;
    activeConnections?: string;
  }> {
    try {
      const tables = await this.getTablesList();
      
      // Получаем информацию о размере базы данных
      const sizeResult = await this.executeRawQuery<{ size: string }>(`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size
      `);
      
      // Получаем информацию о количестве активных соединений
      const connectionsResult = await this.executeRawQuery<{ count: string }>(`
        SELECT count(*) as count FROM pg_stat_activity 
        WHERE datname = current_database()
      `);
      
      return {
        connectionStatus: 'connected',
        tablesCount: tables.length,
        lastOperations: this.lastQueries,
        databaseSize: sizeResult[0]?.size,
        activeConnections: connectionsResult[0]?.count
      };
    } catch (error) {
      console.error('[DatabaseService] Error in getDatabaseStatus:', error);
      return { 
        connectionStatus: 'error', 
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Выполнение произвольного SQL-запроса
   */
  async executeRawQuery<T = any>(query: string, params: any[] = []): Promise<T[]> {
    try {
      // Логируем запрос в историю
      this.logQuery(query);
      
      // Выполняем запрос через пул соединений
      const result = await pool.query(query, params);
      return result.rows as T[];
    } catch (error) {
      console.error('[DatabaseService] Error in executeRawQuery:', error);
      throw error;
    }
  }

  /**
   * Получение списка таблиц в базе данных
   */
  async getTablesList(): Promise<string[]> {
    try {
      const tablesResult = await this.executeRawQuery<{ table_name: string }>(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);
      
      return tablesResult.map(row => row.table_name);
    } catch (error) {
      console.error('[DatabaseService] Error in getTablesList:', error);
      throw error;
    }
  }

  /**
   * Получение информации о структуре таблицы
   */
  async getTableInfo(tableName: string): Promise<{
    columns: Array<{ name: string, type: string, nullable: boolean }>;
    constraints: Array<{ name: string, type: string, definition: string }>;
    indexes: Array<{ name: string, definition: string }>;
  }> {
    try {
      // Получаем информацию о колонках таблицы
      const columnsResult = await this.executeRawQuery<{
        column_name: string;
        data_type: string;
        is_nullable: string;
      }>(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);
      
      // Получаем информацию о ограничениях таблицы
      const constraintsResult = await this.executeRawQuery<{
        constraint_name: string;
        constraint_type: string;
        definition: string;
      }>(`
        SELECT
          c.conname as constraint_name,
          CASE
            WHEN c.contype = 'p' THEN 'PRIMARY KEY'
            WHEN c.contype = 'f' THEN 'FOREIGN KEY'
            WHEN c.contype = 'u' THEN 'UNIQUE'
            WHEN c.contype = 'c' THEN 'CHECK'
            ELSE c.contype::text
          END as constraint_type,
          pg_get_constraintdef(c.oid) as definition
        FROM pg_constraint c
        JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE n.nspname = 'public'
        AND c.conrelid = (SELECT oid FROM pg_class WHERE relname = $1 AND relnamespace = n.oid)
        ORDER BY constraint_type, constraint_name
      `, [tableName]);
      
      // Получаем информацию об индексах таблицы
      const indexesResult = await this.executeRawQuery<{
        indexname: string;
        indexdef: string;
      }>(`
        SELECT
          i.relname as indexname,
          pg_get_indexdef(idx.indexrelid) as indexdef
        FROM pg_index idx
        JOIN pg_class i ON i.oid = idx.indexrelid
        JOIN pg_class t ON t.oid = idx.indrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
        AND t.relname = $1
        ORDER BY i.relname
      `, [tableName]);
      
      return {
        columns: columnsResult.map(col => ({
          name: col.column_name,
          type: col.data_type,
          nullable: col.is_nullable === 'YES'
        })),
        constraints: constraintsResult.map(con => ({
          name: con.constraint_name,
          type: con.constraint_type,
          definition: con.definition
        })),
        indexes: indexesResult.map(idx => ({
          name: idx.indexname,
          definition: idx.indexdef
        }))
      };
    } catch (error) {
      console.error('[DatabaseService] Error in getTableInfo:', error);
      throw error;
    }
  }

  /**
   * Создание резервной копии данных таблицы
   */
  async backupTable(tableName: string): Promise<{ success: boolean, backupData?: any[], error?: string }> {
    try {
      // Выполняем запрос для получения всех данных из таблицы
      const result = await this.executeRawQuery(`SELECT * FROM ${tableName}`);
      
      return {
        success: true,
        backupData: result
      };
    } catch (error) {
      console.error('[DatabaseService] Error in backupTable:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  /**
   * Проверка целостности данных
   */
  async checkDataIntegrity(options?: { tables?: string[], relations?: boolean }): Promise<{
    success: boolean;
    issues: Array<{ table: string, issue: string, severity: 'high' | 'medium' | 'low' }>;
  }> {
    const issues: Array<{ table: string, issue: string, severity: 'high' | 'medium' | 'low' }> = [];
    
    try {
      // Получаем список таблиц для проверки
      let tables = options?.tables || [];
      
      if (!tables.length) {
        tables = await this.getTablesList();
      }
      
      // Проверяем каждую таблицу на наличие NULL в обязательных полях
      for (const table of tables) {
        // Получаем информацию о структуре таблицы
        const tableInfo = await this.getTableInfo(table);
        
        // Проверяем поля, которые не должны быть NULL
        const nonNullableColumns = tableInfo.columns
          .filter(col => !col.nullable)
          .map(col => col.name);
        
        for (const column of nonNullableColumns) {
          // Проверяем наличие NULL значений
          const nullResult = await this.executeRawQuery<{ count: string }>(`
            SELECT COUNT(*) as count FROM ${table} WHERE ${column} IS NULL
          `);
          
          const nullCount = parseInt(nullResult[0].count);
          
          if (nullCount > 0) {
            issues.push({
              table,
              issue: `Найдено ${nullCount} NULL значений в колонке ${column}, которая должна быть NOT NULL`,
              severity: 'high'
            });
          }
        }
        
        // Проверяем дублирующиеся записи в полях с UNIQUE индексами
        const uniqueIndexes = tableInfo.constraints
          .filter(constraint => constraint.type === 'UNIQUE')
          .concat(tableInfo.constraints.filter(constraint => constraint.type === 'PRIMARY KEY'));
        
        for (const index of uniqueIndexes) {
          // Извлекаем имена колонок из определения индекса
          const columnMatch = index.definition.match(/\(([^)]+)\)/);
          
          if (columnMatch && columnMatch[1]) {
            const columns = columnMatch[1].split(',').map(col => col.trim());
            
            // Проверяем наличие дубликатов
            const duplicatesQuery = `
              SELECT ${columns.join(', ')}, COUNT(*)
              FROM ${table}
              GROUP BY ${columns.join(', ')}
              HAVING COUNT(*) > 1
            `;
            
            const duplicatesResult = await this.executeRawQuery(duplicatesQuery);
            
            if (duplicatesResult.length > 0) {
              issues.push({
                table,
                issue: `Найдено ${duplicatesResult.length} дублирующихся записей в полях ${columns.join(', ')}`,
                severity: 'high'
              });
            }
          }
        }
      }
      
      // Если требуется, проверяем целостность связей между таблицами
      if (options?.relations) {
        // Получаем все внешние ключи
        const foreignKeysResult = await this.executeRawQuery<{
          table_name: string;
          constraint_name: string;
          column_name: string;
          foreign_table_name: string;
          foreign_column_name: string;
        }>(`
          SELECT
            tc.table_name,
            tc.constraint_name,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
          FROM
            information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
          WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
        `);
        
        // Проверяем каждый внешний ключ
        for (const fk of foreignKeysResult) {
          // Пропускаем, если таблица не входит в список проверяемых
          if (options?.tables && !options.tables.includes(fk.table_name)) {
            continue;
          }
          
          // Проверяем наличие "висящих" ссылок
          const brokenRefsQuery = `
            SELECT count(*) as count
            FROM ${fk.table_name} t1
            LEFT JOIN ${fk.foreign_table_name} t2
              ON t1.${fk.column_name} = t2.${fk.foreign_column_name}
            WHERE t1.${fk.column_name} IS NOT NULL
              AND t2.${fk.foreign_column_name} IS NULL
          `;
          
          const brokenRefsResult = await this.executeRawQuery<{ count: string }>(brokenRefsQuery);
          const brokenCount = parseInt(brokenRefsResult[0].count);
          
          if (brokenCount > 0) {
            issues.push({
              table: fk.table_name,
              issue: `Найдено ${brokenCount} записей с неверными ссылками на ${fk.foreign_table_name} (FK: ${fk.constraint_name})`,
              severity: 'high'
            });
          }
        }
      }
      
      return {
        success: issues.length === 0,
        issues
      };
    } catch (error) {
      console.error('[DatabaseService] Error in checkDataIntegrity:', error);
      
      issues.push({
        table: 'system',
        issue: `Ошибка при проверке целостности данных: ${error instanceof Error ? error.message : String(error)}`,
        severity: 'high'
      });
      
      return {
        success: false,
        issues
      };
    }
  }
}

export const databaseServiceInstance = new DatabaseService();