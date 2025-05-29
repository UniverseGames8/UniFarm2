/**
 * Контроллер для мониторинга состояния базы данных
 * Предоставляет API для проверки соединения и отображения статистики
 */

import { Request, Response } from 'express';
import { testConnection, reconnect } from '../db-connect';
import * as dbMonitorModule from '../db-monitor';

// Разрешаем импорт по умолчанию
const DatabaseMonitor = dbMonitorModule.default;

/**
 * GET /api/db-monitor
 * Получение информации о состоянии соединения с базой данных
 */
export async function getMonitorStatus(req: Request, res: Response) {
  try {
    const status = DatabaseMonitor.getStatus();
    const lastCheckResult = DatabaseMonitor.getLastCheckResult();
    const lastReconnectResult = DatabaseMonitor.getLastReconnectResult();
    const stats = DatabaseMonitor.getStats();
    
    return res.json({
      success: true,
      data: {
        status,
        lastCheckResult,
        lastReconnectResult,
        stats,
        isPrimaryDatabase: process.env.DATABASE_URL?.includes('neon') ? 'neon' : 'replit',
        checkInterval: DatabaseMonitor.getCheckInterval(),
        connectionConfig: {
          max: parseInt(process.env.PG_MAX_CONNECTIONS || '10'),
          idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT || '60000'),
          connectionTimeoutMillis: parseInt(process.env.PG_CONNECTION_TIMEOUT || '10000')
        }
      }
    });
  } catch (error) {
    console.error('Ошибка при получении статуса монитора БД:', error);
    return res.status(500).json({
      success: false,
      error: `Не удалось получить статус монитора: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}

/**
 * POST /api/db-monitor/force-check
 * Принудительная проверка соединения с базой данных
 */
export async function forceCheckConnection(req: Request, res: Response) {
  try {
    const startTime = Date.now();
    const isConnected = await testConnection();
    const elapsedTime = Date.now() - startTime;
    
    return res.json({
      success: true,
      data: {
        isConnected,
        elapsedTime,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Ошибка при проверке соединения:', error);
    return res.status(500).json({
      success: false,
      error: `Ошибка проверки соединения: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}

/**
 * POST /api/db-monitor/reset
 * Сброс статистики мониторинга
 */
export async function resetMonitor(req: Request, res: Response) {
  try {
    DatabaseMonitor.resetStats();
    
    return res.json({
      success: true,
      data: {
        message: 'Статистика монитора сброшена',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Ошибка при сбросе статистики:', error);
    return res.status(500).json({
      success: false,
      error: `Ошибка сброса статистики: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}

/**
 * POST /api/db-monitor/reconnect
 * Принудительное переподключение к базе данных
 */
export async function forceReconnect(req: Request, res: Response) {
  try {
    const startTime = Date.now();
    const isReconnected = await reconnect();
    const elapsedTime = Date.now() - startTime;
    
    return res.json({
      success: true,
      data: {
        isReconnected,
        elapsedTime,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Ошибка при переподключении:', error);
    return res.status(500).json({
      success: false,
      error: `Ошибка переподключения: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}

/**
 * POST /api/db-monitor/set-interval
 * Изменение интервала проверки соединения
 */
export async function setCheckInterval(req: Request, res: Response) {
  try {
    const { interval } = req.body;
    
    if (!interval || typeof interval !== 'number' || interval < 1000) {
      return res.status(400).json({
        success: false,
        error: 'Необходимо указать интервал в миллисекундах (не менее 1000)'
      });
    }
    
    DatabaseMonitor.setCheckInterval(interval);
    
    return res.json({
      success: true,
      data: {
        message: `Интервал проверки изменен на ${interval} мс`,
        newInterval: interval,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Ошибка при изменении интервала:', error);
    return res.status(500).json({
      success: false,
      error: `Ошибка изменения интервала: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}