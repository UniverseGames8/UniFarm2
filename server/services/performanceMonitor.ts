/**
 * Система мониторинга производительности UniFarm
 * 
 * Отслеживает производительность критических операций,
 * собирает метрики и предоставляет отчеты для оптимизации
 */

import { db } from '../db-connect-unified';
import { users, uniFarmingDeposits, tonBoostDeposits, transactions } from '@shared/schema';
import { sql, count, desc, eq, and, gte } from 'drizzle-orm';

interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: Date;
  status: 'success' | 'error';
  details?: any;
}

interface SystemHealth {
  databaseConnected: boolean;
  activeUsers: number;
  totalTransactions: number;
  avgResponseTime: number;
  systemLoad: 'low' | 'medium' | 'high';
  lastUpdate: Date;
}

export class PerformanceMonitor {
  private static metrics: PerformanceMetric[] = [];
  private static readonly MAX_METRICS = 1000;

  /**
   * Записывает метрику производительности
   */
  static recordMetric(operation: string, duration: number, status: 'success' | 'error', details?: any): void {
    const metric: PerformanceMetric = {
      operation,
      duration,
      timestamp: new Date(),
      status,
      details
    };

    this.metrics.push(metric);

    // Ограничиваем количество хранимых метрик
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }

    // Логируем медленные операции
    if (duration > 5000) { // Более 5 секунд
      console.warn(`[PerformanceMonitor] ⚠️ Slow operation detected: ${operation} took ${duration}ms`);
    }
  }

  /**
   * Измеряет время выполнения операции
   */
  static async measureOperation<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    let status: 'success' | 'error' = 'success';
    let result: T;

    try {
      result = await fn();
      return result;
    } catch (error) {
      status = 'error';
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      this.recordMetric(operation, duration, status);
    }
  }

  /**
   * Получает системное состояние здоровья
   */
  static async getSystemHealth(): Promise<SystemHealth> {
    return await this.measureOperation('getSystemHealth', async () => {
      try {
        // Проверяем подключение к базе данных
        const dbTest = await db.select({ count: count() }).from(users);
        const databaseConnected = dbTest.length > 0;

        // Подсчитываем активных пользователей (с активными депозитами)
        const activeUsersResult = await db
          .select({ count: count() })
          .from(users)
          .leftJoin(uniFarmingDeposits, eq(uniFarmingDeposits.user_id, users.id))
          .leftJoin(tonBoostDeposits, eq(tonBoostDeposits.user_id, users.id))
          .where(
            and(
              sql`${uniFarmingDeposits.is_active} = true OR ${tonBoostDeposits.is_active} = true`
            )
          );

        const activeUsers = activeUsersResult[0]?.count || 0;

        // Подсчитываем общее количество транзакций за последние 24 часа
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentTransactionsResult = await db
          .select({ count: count() })
          .from(transactions)
          .where(gte(transactions.created_at, oneDayAgo));

        const totalTransactions = recentTransactionsResult[0]?.count || 0;

        // Вычисляем среднее время отклика
        const recentMetrics = this.metrics.filter(
          m => Date.now() - m.timestamp.getTime() < 60 * 60 * 1000 // Последний час
        );
        const avgResponseTime = recentMetrics.length > 0
          ? recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length
          : 0;

        // Определяем нагрузку системы
        let systemLoad: 'low' | 'medium' | 'high' = 'low';
        if (avgResponseTime > 2000) systemLoad = 'high';
        else if (avgResponseTime > 1000) systemLoad = 'medium';

        return {
          databaseConnected,
          activeUsers,
          totalTransactions,
          avgResponseTime: Math.round(avgResponseTime),
          systemLoad,
          lastUpdate: new Date()
        };
      } catch (error) {
        console.error('[PerformanceMonitor] Error getting system health:', error);
        return {
          databaseConnected: false,
          activeUsers: 0,
          totalTransactions: 0,
          avgResponseTime: 0,
          systemLoad: 'high',
          lastUpdate: new Date()
        };
      }
    });
  }

  /**
   * Получает отчет о производительности
   */
  static getPerformanceReport(): {
    totalOperations: number;
    avgDuration: number;
    successRate: number;
    slowOperations: PerformanceMetric[];
    operationStats: { [operation: string]: { count: number; avgDuration: number; successRate: number } };
  } {
    const totalOperations = this.metrics.length;
    const avgDuration = totalOperations > 0
      ? this.metrics.reduce((sum, m) => sum + m.duration, 0) / totalOperations
      : 0;
    
    const successfulOperations = this.metrics.filter(m => m.status === 'success').length;
    const successRate = totalOperations > 0 ? (successfulOperations / totalOperations) * 100 : 100;

    const slowOperations = this.metrics
      .filter(m => m.duration > 3000)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    // Статистика по операциям
    const operationStats: { [operation: string]: { count: number; avgDuration: number; successRate: number } } = {};
    
    this.metrics.forEach(metric => {
      if (!operationStats[metric.operation]) {
        operationStats[metric.operation] = { count: 0, avgDuration: 0, successRate: 0 };
      }
      operationStats[metric.operation].count++;
    });

    Object.keys(operationStats).forEach(operation => {
      const operationMetrics = this.metrics.filter(m => m.operation === operation);
      const avgDur = operationMetrics.reduce((sum, m) => sum + m.duration, 0) / operationMetrics.length;
      const successCount = operationMetrics.filter(m => m.status === 'success').length;
      const successRate = (successCount / operationMetrics.length) * 100;
      
      operationStats[operation].avgDuration = Math.round(avgDur);
      operationStats[operation].successRate = Math.round(successRate);
    });

    return {
      totalOperations,
      avgDuration: Math.round(avgDuration),
      successRate: Math.round(successRate),
      slowOperations,
      operationStats
    };
  }

  /**
   * Очищает старые метрики
   */
  static clearOldMetrics(olderThanHours: number = 24): void {
    const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000);
    this.metrics = this.metrics.filter(m => m.timestamp.getTime() > cutoffTime);
    console.log(`[PerformanceMonitor] Cleared metrics older than ${olderThanHours} hours`);
  }

  /**
   * Экспортирует метрики для анализа
   */
  static exportMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Получает топ самых медленных операций
   */
  static getSlowestOperations(limit: number = 10): PerformanceMetric[] {
    return [...this.metrics]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  /**
   * Получает статистику ошибок
   */
  static getErrorStats(): {
    totalErrors: number;
    errorRate: number;
    errorsByOperation: { [operation: string]: number };
    recentErrors: PerformanceMetric[];
  } {
    const errors = this.metrics.filter(m => m.status === 'error');
    const totalErrors = errors.length;
    const errorRate = this.metrics.length > 0 ? (totalErrors / this.metrics.length) * 100 : 0;

    const errorsByOperation: { [operation: string]: number } = {};
    errors.forEach(error => {
      errorsByOperation[error.operation] = (errorsByOperation[error.operation] || 0) + 1;
    });

    const recentErrors = errors
      .filter(e => Date.now() - e.timestamp.getTime() < 60 * 60 * 1000) // Последний час
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);

    return {
      totalErrors,
      errorRate: Math.round(errorRate),
      errorsByOperation,
      recentErrors
    };
  }
}

export default PerformanceMonitor;