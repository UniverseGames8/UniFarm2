/**
 * Модуль для генерации страницы статуса приложения
 * 
 * Предоставляет HTML-страницу с информацией о состоянии приложения,
 * включая статус БД, Telegram бота и системные метрики.
 */

import { Request, Response } from 'express';
import { getDbEventManager, DatabaseEventType } from './db-events';
import { isTelegramBotInitialized } from '../telegram/globalState';

/**
 * Обработчик для отображения страницы статуса
 */
/**
 * Обработчик для отображения страницы статуса
 * @param req Запрос Express
 * @param res Ответ Express
 */
export function statusPageHandler(req: Request, res: any): void {
  try {
    // Получаем текущую информацию о состоянии приложения
    const dbEvents = getDbEventManager().getHistory(10);
    const telegramInitialized = isTelegramBotInitialized();
    const uptime = formatUptime(process.uptime());
    const memoryUsage = formatMemoryUsage(process.memoryUsage());
    
    // Определяем общий статус приложения
    const lastDbEvent = getDbEventManager().getLastEvent();
    const dbStatus = determineDbStatus(lastDbEvent?.type);
    
    // Генерируем HTML страницу
    const html = generateStatusHtml({
      appName: 'UniFarm',
      timestamp: new Date().toISOString(),
      uptime,
      dbStatus,
      telegramStatus: telegramInitialized ? 'online' : 'offline',
      memoryUsage,
      dbEvents
    });
    
    // Отправляем ответ
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
  } catch (error) {
    // В случае ошибки отправляем простую страницу с ошибкой
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.setHeader('Content-Type', 'text/html');
    res.status(500).send(`
      <html>
        <head><title>UniFarm - Error</title></head>
        <body>
          <h1>Status Page Error</h1>
          <p>An error occurred while generating the status page: ${errorMessage}</p>
          <p><a href="/">Back to home</a></p>
        </body>
      </html>
    `);
  }
}

/**
 * Определяет статус БД на основе последнего события
 */
function determineDbStatus(eventType?: DatabaseEventType): string {
  if (!eventType) return 'unknown';
  
  switch (eventType) {
    case DatabaseEventType.CONNECTED:
      return 'connected';
    case DatabaseEventType.DISCONNECTED:
      return 'disconnected';
    case DatabaseEventType.RECONNECTING:
      return 'reconnecting';
    case DatabaseEventType.FALLBACK_MEMORY:
      return 'memory_fallback';
    case DatabaseEventType.RECONNECT_FAILED:
      return 'connection_failed';
    default:
      return 'unknown';
  }
}

/**
 * Форматирует время работы сервера
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${secs}s`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

/**
 * Форматирует использование памяти
 */
function formatMemoryUsage(memoryUsage: NodeJS.MemoryUsage): string {
  const mbUsed = Math.round(memoryUsage.heapUsed / 1024 / 1024);
  const mbTotal = Math.round(memoryUsage.heapTotal / 1024 / 1024);
  const mbRss = Math.round(memoryUsage.rss / 1024 / 1024);
  
  return `${mbUsed}MB used of ${mbTotal}MB allocated (${mbRss}MB RSS)`;
}

/**
 * Интерфейс для параметров генерации HTML
 */
interface StatusPageParams {
  appName: string;
  timestamp: string;
  uptime: string;
  dbStatus: string;
  telegramStatus: string;
  memoryUsage: string;
  dbEvents: any[];
}

/**
 * Генерирует HTML страницу статуса
 */
function generateStatusHtml(params: StatusPageParams): string {
  // Определяем типы возможных статусов для правильной типизации
  const statusMap = {
    // Статусы базы данных
    'connected': 'background-color: #4CAF50; color: white;',
    'disconnected': 'background-color: #F44336; color: white;',
    'reconnecting': 'background-color: #FF9800; color: black;',
    'memory_fallback': 'background-color: #9C27B0; color: white;',
    'connection_failed': 'background-color: #F44336; color: white;',
    'unknown': 'background-color: #9E9E9E; color: white;',
    // Статусы телеграм бота
    'online': 'background-color: #4CAF50; color: white;',
    'offline': 'background-color: #F44336; color: white;',
  } as const;

  // Типы статусов на основе ключей объекта statusMap
  type StatusStyleKey = keyof typeof statusMap;
  
  // Функция получения стиля по статусу с проверкой существования
  const getStatusStyle = (status: string): string => {
    // Проверяем наличие статуса в нашей карте
    return (status in statusMap) 
      ? statusMap[status as StatusStyleKey] 
      : statusMap.unknown;
  };

  // Генерация HTML таблицы событий БД
  let eventsHtml = '';
  if (params.dbEvents.length > 0) {
    eventsHtml = `
      <h3>Recent Database Events</h3>
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Type</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          ${params.dbEvents.map(event => `
            <tr>
              <td>${new Date(event.timestamp).toLocaleTimeString()}</td>
              <td>${event.type}</td>
              <td>${event.message || '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${params.appName} - Status</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1000px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            border-bottom: 1px solid #eee;
            padding-bottom: 10px;
          }
          .status-panel {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
          }
          .status-card {
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 15px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .status-badge {
            display: inline-block;
            padding: 5px 10px;
            border-radius: 4px;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 12px;
          }
          h1, h2, h3 {
            margin-top: 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          th, td {
            text-align: left;
            padding: 8px;
            border-bottom: 1px solid #ddd;
          }
          th {
            background-color: #f2f2f2;
          }
          .refresh-button {
            background-color: #2196F3;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 12px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${params.appName} Status</h1>
          <button class="refresh-button" onclick="location.reload()">Refresh</button>
        </div>
        
        <div class="status-panel">
          <div class="status-card">
            <h2>System Status</h2>
            <p><strong>Time:</strong> ${params.timestamp}</p>
            <p><strong>Uptime:</strong> ${params.uptime}</p>
            <p><strong>Memory:</strong> ${params.memoryUsage}</p>
          </div>
          
          <div class="status-card">
            <h2>Services</h2>
            <p>
              <strong>Database:</strong>
              <span class="status-badge" style="${getStatusStyle(params.dbStatus)}">
                ${params.dbStatus}
              </span>
            </p>
            <p>
              <strong>Telegram Bot:</strong>
              <span class="status-badge" style="${getStatusStyle(params.telegramStatus)}">
                ${params.telegramStatus}
              </span>
            </p>
          </div>
        </div>
        
        ${eventsHtml}
        
        <div class="footer">
          <p>Generated at ${params.timestamp} • <a href="/">Back to Home</a></p>
        </div>
        
        <script>
          // Auto refresh every 30 seconds
          setTimeout(() => {
            location.reload();
          }, 30000);
        </script>
      </body>
    </html>
  `;
}