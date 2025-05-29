/**
 * Модуль для отслеживания событий состояния базы данных
 * 
 * Предоставляет централизованный механизм для отслеживания изменений
 * в состоянии подключения к базе данных и реагирования на них.
 */

import { EventEmitter } from 'events';

// Типы событий состояния БД
export enum DatabaseEventType {
  CONNECTED = 'db:connected',           // Подключение установлено
  DISCONNECTED = 'db:disconnected',     // Подключение разорвано
  RECONNECTING = 'db:reconnecting',     // Попытка переподключения
  RECONNECT_FAILED = 'db:reconnect_failed', // Ошибка переподключения
  FALLBACK_MEMORY = 'db:fallback_memory',  // Переход в режим in-memory
  QUERY_ERROR = 'db:query_error',       // Ошибка выполнения запроса
  RECOVERY_SUCCESS = 'db:recovery_success', // Успешное восстановление
}

// Интерфейс события БД
export interface DatabaseEvent {
  type: DatabaseEventType;
  connectionName?: string;
  timestamp: Date;
  message?: string;
  error?: Error | string;
  details?: Record<string, any>;
}

// Тип для функций-обработчиков событий
export type DatabaseEventHandler = (event: DatabaseEvent) => void;

// Класс для работы с событиями БД
class DatabaseEvents {
  private static instance: DatabaseEvents;
  private emitter: EventEmitter;
  private eventHistory: DatabaseEvent[] = [];
  private readonly MAX_HISTORY = 50; // Максимальное количество хранимых событий

  private constructor() {
    this.emitter = new EventEmitter();
    // Увеличиваем максимальное количество обработчиков для избежания утечек
    this.emitter.setMaxListeners(20);
  }

  public static getInstance(): DatabaseEvents {
    if (!DatabaseEvents.instance) {
      DatabaseEvents.instance = new DatabaseEvents();
    }
    return DatabaseEvents.instance;
  }

  /**
   * Подписка на событие базы данных
   * @param eventType Тип события
   * @param handler Функция-обработчик
   */
  public on(eventType: DatabaseEventType | string, handler: DatabaseEventHandler): void {
    this.emitter.on(eventType, handler);
  }

  /**
   * Одноразовая подписка на событие
   * @param eventType Тип события
   * @param handler Функция-обработчик
   */
  public once(eventType: DatabaseEventType | string, handler: DatabaseEventHandler): void {
    this.emitter.once(eventType, handler);
  }

  /**
   * Отписка от события
   * @param eventType Тип события
   * @param handler Функция-обработчик
   */
  public off(eventType: DatabaseEventType | string, handler: DatabaseEventHandler): void {
    this.emitter.off(eventType, handler);
  }

  /**
   * Публикация события базы данных
   * @param event Событие для публикации
   */
  public emit(event: DatabaseEvent): void {
    // Добавляем временную метку, если ее нет
    if (!event.timestamp) {
      event.timestamp = new Date();
    }

    // Сохраняем событие в истории
    this.eventHistory.unshift(event);
    
    // Ограничиваем размер истории
    if (this.eventHistory.length > this.MAX_HISTORY) {
      this.eventHistory = this.eventHistory.slice(0, this.MAX_HISTORY);
    }

    // Публикуем событие
    this.emitter.emit(event.type, event);
    
    // Публикуем также в общий канал всех событий
    this.emitter.emit('db:all', event);
    
    // Логируем событие
    console.log(`[DB Event] ${event.type}: ${event.message || ''}`);
  }

  /**
   * Получить историю событий
   * @param limit Максимальное количество событий для возврата
   * @returns Массив событий базы данных
   */
  public getHistory(limit = 10): DatabaseEvent[] {
    return this.eventHistory.slice(0, Math.min(limit, this.eventHistory.length));
  }

  /**
   * Получить последнее событие определенного типа
   * @param eventType Тип события
   * @returns Последнее событие указанного типа или null
   */
  public getLastEvent(eventType?: DatabaseEventType): DatabaseEvent | null {
    if (!eventType) {
      return this.eventHistory.length > 0 ? this.eventHistory[0] : null;
    }
    
    return this.eventHistory.find(event => event.type === eventType) || null;
  }

  /**
   * Очистить историю событий
   */
  public clearHistory(): void {
    this.eventHistory = [];
  }
}

// Экспортируем функцию для получения экземпляра менеджера событий
export function getDbEventManager(): DatabaseEvents {
  return DatabaseEvents.getInstance();
}

// Экспортируем помощника для публикации событий
export function emitDbEvent(
  type: DatabaseEventType,
  message?: string,
  error?: Error | string,
  details?: Record<string, any>,
  connectionName?: string
): void {
  const event: DatabaseEvent = {
    type,
    message,
    error,
    details,
    connectionName,
    timestamp: new Date()
  };
  
  DatabaseEvents.getInstance().emit(event);
}

export default getDbEventManager;