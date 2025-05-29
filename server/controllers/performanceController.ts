/**
 * Контроллер для мониторинга производительности
 * 
 * Предоставляет API для получения метрик производительности,
 * состояния системы и диагностической информации
 */

import { Request, Response } from 'express';
import PerformanceMonitor from '../services/performanceMonitor';
import OptimizedBackgroundService from '../services/optimizedBackgroundService';

export class PerformanceController {
  
  /**
   * Получает текущее состояние здоровья системы
   */
  static async getSystemHealth(req: Request, res: Response): Promise<void> {
    try {
      const healthData = await PerformanceMonitor.getSystemHealth();
      
      res.json({
        success: true,
        data: {
          status: healthData.databaseConnected ? 'healthy' : 'unhealthy',
          ...healthData,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('[PerformanceController] Error getting system health:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get system health'
      });
    }
  }

  /**
   * Получает отчет о производительности
   */
  static async getPerformanceReport(req: Request, res: Response): Promise<void> {
    try {
      const report = PerformanceMonitor.getPerformanceReport();
      
      res.json({
        success: true,
        data: {
          ...report,
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('[PerformanceController] Error getting performance report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get performance report'
      });
    }
  }

  /**
   * Получает статистику ошибок
   */
  static async getErrorStats(req: Request, res: Response): Promise<void> {
    try {
      const errorStats = PerformanceMonitor.getErrorStats();
      
      res.json({
        success: true,
        data: {
          ...errorStats,
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('[PerformanceController] Error getting error stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get error statistics'
      });
    }
  }

  /**
   * Получает самые медленные операции
   */
  static async getSlowestOperations(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const slowestOps = PerformanceMonitor.getSlowestOperations(limit);
      
      res.json({
        success: true,
        data: {
          operations: slowestOps,
          limit,
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('[PerformanceController] Error getting slowest operations:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get slowest operations'
      });
    }
  }

  /**
   * Запускает сравнение производительности
   */
  static async runPerformanceComparison(req: Request, res: Response): Promise<void> {
    try {
      const comparison = await OptimizedBackgroundService.performanceComparison();
      
      res.json({
        success: true,
        data: {
          comparison,
          message: 'Performance comparison completed successfully',
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('[PerformanceController] Error running performance comparison:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to run performance comparison'
      });
    }
  }

  /**
   * Экспортирует все метрики для анализа
   */
  static async exportMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = PerformanceMonitor.exportMetrics();
      
      res.json({
        success: true,
        data: {
          metrics,
          count: metrics.length,
          exportedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('[PerformanceController] Error exporting metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export metrics'
      });
    }
  }

  /**
   * Очищает старые метрики
   */
  static async clearOldMetrics(req: Request, res: Response): Promise<void> {
    try {
      const hours = parseInt(req.body.hours) || 24;
      PerformanceMonitor.clearOldMetrics(hours);
      
      res.json({
        success: true,
        data: {
          message: `Cleared metrics older than ${hours} hours`,
          clearedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('[PerformanceController] Error clearing old metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clear old metrics'
      });
    }
  }

  /**
   * Получает детальную диагностику системы
   */
  static async getSystemDiagnostics(req: Request, res: Response): Promise<void> {
    try {
      const [healthData, performanceReport, errorStats] = await Promise.all([
        PerformanceMonitor.getSystemHealth(),
        PerformanceMonitor.getPerformanceReport(),
        PerformanceMonitor.getErrorStats()
      ]);

      // Определяем общий статус системы
      let overallStatus = 'healthy';
      const issues: string[] = [];

      if (!healthData.databaseConnected) {
        overallStatus = 'critical';
        issues.push('Database connection failed');
      }

      if (healthData.avgResponseTime > 3000) {
        overallStatus = overallStatus === 'healthy' ? 'warning' : overallStatus;
        issues.push('High response times detected');
      }

      if (errorStats.errorRate > 10) {
        overallStatus = overallStatus === 'healthy' ? 'warning' : overallStatus;
        issues.push('High error rate detected');
      }

      if (performanceReport.successRate < 95) {
        overallStatus = overallStatus === 'healthy' ? 'warning' : overallStatus;
        issues.push('Low success rate detected');
      }

      res.json({
        success: true,
        data: {
          overallStatus,
          issues,
          health: healthData,
          performance: performanceReport,
          errors: errorStats,
          recommendations: this.generateRecommendations(healthData, performanceReport, errorStats),
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('[PerformanceController] Error getting system diagnostics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get system diagnostics'
      });
    }
  }

  /**
   * Генерирует рекомендации для улучшения производительности
   */
  private static generateRecommendations(healthData: any, performanceReport: any, errorStats: any): string[] {
    const recommendations: string[] = [];

    if (healthData.avgResponseTime > 2000) {
      recommendations.push('Consider optimizing database queries to reduce response times');
    }

    if (errorStats.errorRate > 5) {
      recommendations.push('Investigate and fix high error rate issues');
    }

    if (healthData.activeUsers > 100 && healthData.avgResponseTime > 1000) {
      recommendations.push('Consider implementing caching mechanisms for better performance');
    }

    if (performanceReport.slowOperations.length > 5) {
      recommendations.push('Review and optimize slow operations identified in the report');
    }

    if (healthData.systemLoad === 'high') {
      recommendations.push('System is under high load - consider scaling resources');
    }

    if (recommendations.length === 0) {
      recommendations.push('System is performing well - no immediate optimizations needed');
    }

    return recommendations;
  }
}

export default PerformanceController;