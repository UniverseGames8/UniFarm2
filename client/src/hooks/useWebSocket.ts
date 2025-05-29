import { useState, useEffect, useCallback, useRef } from 'react';

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

interface UseWebSocketOptions {
  onOpen?: (event: Event) => void;
  onMessage?: (data: any) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  reconnectInterval?: number;
}

/**
 * Хук для работы с WebSocket соединением
 * Оптимизированная версия с улучшенной стабильностью соединения и надежностью
 */
const useWebSocket = (options: UseWebSocketOptions = {}) => {
  // Состояние
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [errorCount, setErrorCount] = useState<number>(0);

  // Refs для сохранения данных между рендерами
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPingSentRef = useRef<number>(0);
  const lastPongReceivedRef = useRef<number>(0);

  // Опции
  const {
    onOpen,
    onMessage,
    onClose,
    onError,
    reconnectInterval = 2000
  } = options;

  /**
   * Очистка всех таймеров и ресурсов
   */
  const clearResources = useCallback(() => {
    // Очищаем таймаут переподключения
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Очищаем таймаут проверки пинга
    if (pingTimeoutRef.current) {
      clearTimeout(pingTimeoutRef.current);
      pingTimeoutRef.current = null;
    }

    // Очищаем интервал отправки пингов
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  /**
   * Закрытие соединения с очисткой всех ресурсов
   */
  const disconnect = useCallback(() => {
    clearResources();

    // Закрываем сокет, если он открыт
    if (socketRef.current) {
      try {
        // Удаляем все обработчики событий
        if (socketRef.current.onopen) socketRef.current.onopen = null;
        if (socketRef.current.onmessage) socketRef.current.onmessage = null;
        if (socketRef.current.onclose) socketRef.current.onclose = null;
        if (socketRef.current.onerror) socketRef.current.onerror = null;

        // Пытаемся закрыть нормально, только если сокет открыт или подключается
        if (socketRef.current.readyState === WebSocket.OPEN || 
            socketRef.current.readyState === WebSocket.CONNECTING) {
          socketRef.current.close(1000, "Normal closure");
        }
      } catch (err) {
        console.error('[WebSocket] Error closing socket:', err);
      }

      socketRef.current = null;
    }

    setIsConnected(false);
  }, [clearResources]);

  /**
   * Проверка состояния соединения по таймауту ping/pong
   */
  const checkConnectionHealth = useCallback(() => {
    const now = Date.now();
    const timeSinceLastPing = now - lastPingSentRef.current;
    const timeSinceLastPong = now - lastPongReceivedRef.current;

    // Если прошло больше 30 секунд с момента отправки ping и не получили pong
    if (lastPingSentRef.current > 0 && timeSinceLastPing > 30000 && 
        (lastPongReceivedRef.current === 0 || timeSinceLastPing > timeSinceLastPong + 20000)) {
      console.warn('[WebSocket] Connection seems dead (no pong response)');
      disconnect();
      connect();
    }
  }, []);

  /**
   * Отправка ping для проверки соединения
   */
  const sendPing = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      try {
        const pingMessage = {
          type: 'ping',
          timestamp: new Date().toISOString()
        };

        socketRef.current.send(JSON.stringify(pingMessage));
        lastPingSentRef.current = Date.now();

        // Проверяем здоровье соединения через 10 секунд
        if (pingTimeoutRef.current) {
          clearTimeout(pingTimeoutRef.current);
        }

        pingTimeoutRef.current = setTimeout(() => {
          checkConnectionHealth();
        }, 10000);

      } catch (error) {
        console.error('[WebSocket] Error sending ping:', error);
      }
    }
  }, [checkConnectionHealth]);

  /**
   * Настройка периодической отправки ping
   */
  const setupPingInterval = useCallback(() => {
    clearResources();

    // Отправляем ping каждые 25 секунд
    pingIntervalRef.current = setInterval(() => {
      sendPing();
    }, 25000);

    // Отправляем первый ping сразу
    sendPing();
  }, [sendPing, clearResources]);

  /**
   * Принудительное переподключение сбрасывает счетчики ошибок
   */
  const forceReconnect = useCallback(() => {
    console.log('[WebSocket] Forced reconnection initiated');
    setErrorCount(0);
    disconnect();

    // Небольшая задержка перед переподключением
    setTimeout(() => {
      connect();
    }, 500);
  }, [disconnect]);

  /**
   * Инициализация WebSocket соединения с оптимизированной обработкой ошибок
   */
  const connect = useCallback(() => {
    clearResources();

    if (socketRef.current) {
      disconnect();
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host.includes('replit.dev') ? window.location.host : '0.0.0.0:3000';
      const wsUrl = `${protocol}//${host}/ws`;

      console.log('[WebSocket] Initializing connection to:', wsUrl, {
        protocol: window.location.protocol,
        host: window.location.host,
        isReplit: window.location.host.includes('replit.dev')
      });

      // Создаем новое соединение с увеличенными таймаутами
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      // Обработчик успешного соединения
      socket.onopen = (event) => {
        console.log('[WebSocket] Connection established');
        setIsConnected(true);
        setErrorCount(0); // Сбрасываем счетчик ошибок при успешном соединении

        // Запускаем ping/pong механизм для поддержания соединения
        setupPingInterval();

        // Вызываем пользовательский обработчик
        if (onOpen) onOpen(event);
      };

      // Обработчик получения сообщения с улучшенной обработкой ping/pong
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[WebSocket] Message received:', data);
          setLastMessage(data);

          // Обработка ping/pong для поддержания соединения
          if (data.type === 'ping') {
            // Отправляем pong в ответ на ping
            if (socket.readyState === WebSocket.OPEN) {
              try {
                socket.send(JSON.stringify({ 
                  type: 'pong', 
                  timestamp: data.timestamp 
                }));
              } catch (sendError) {
                console.error('[WebSocket] Error sending pong:', sendError);
              }
            }
          } else if (data.type === 'pong') {
            // Регистрируем получение pong
            lastPongReceivedRef.current = Date.now();
          }

          // Вызываем пользовательский обработчик
          if (onMessage) onMessage(data);
        } catch (error) {
          console.error('[WebSocket] Error parsing message:', error);
        }
      };

      // Обработчик закрытия соединения с оптимизированной логикой переподключения
      socket.onclose = (event) => {
        // Только для отладки, не показываем пользователю
        if (process.env.NODE_ENV === 'development') {
          console.log('[WebSocket] Connection closed:', event.code, event.reason);
        }
        setIsConnected(false);

        // Очищаем ресурсы при закрытии соединения
        clearResources();

        // Вызываем пользовательский обработчик
        if (onClose) onClose(event);

        // Автоматическое переподключение при неожиданном закрытии
        if (event.code !== 1000 && event.code !== 1001) {
          setErrorCount(prev => prev + 1);

          // Переподключаемся через интервал с небольшой случайной задержкой
          const randomDelay = Math.floor(Math.random() * 1000); // 0-1000ms случайная задержка
          const delay = reconnectInterval + randomDelay;

          // Скрываем сообщение о переподключении от пользователей
          if (process.env.NODE_ENV === 'development') {
            console.log(`[WebSocket] Reconnecting in ${delay}ms...`);
          }
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      // Обработчик ошибок
      socket.onerror = (event) => {
        // Скрываем сообщение об ошибке от пользователей в production
        if (process.env.NODE_ENV === 'development') {
          console.error('[WebSocket] Error occurred');
        }
        setErrorCount(prev => prev + 1);

        // Вызываем пользовательский обработчик
        if (onError) onError(event);
      };
    } catch (error) {
      console.error('[WebSocket] Failed to connect:', error);
      setErrorCount(prev => prev + 1);

      // Автоматическое переподключение при ошибке создания соединения
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, reconnectInterval);
    }
  }, [
    onOpen, 
    onMessage, 
    onClose, 
    onError, 
    reconnectInterval, 
    clearResources, 
    disconnect, 
    setupPingInterval
  ]);

  /**
   * Отправка сообщения на сервер с улучшенной обработкой ошибок
   */
  const send = useCallback((message: any): boolean => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      try {
        const serializedMessage = typeof message === 'string' 
          ? message 
          : JSON.stringify(message);

        socketRef.current.send(serializedMessage);
        return true;
      } catch (error) {
        console.error('[WebSocket] Error sending message:', error);
        return false;
      }
    } else {
      // Если соединение не открыто, пытаемся переподключиться
      if (!reconnectTimeoutRef.current) {
        forceReconnect();
      }
      return false;
    }
  }, [forceReconnect]);

  /**
   * Подписка на обновления для пользователя с указанным ID
   */
  const subscribeToUserUpdates = useCallback((userId: number): boolean => {
    if (!userId) {
      console.error('[WebSocket] Cannot subscribe without userId');
      return false;
    }

    return send({
      type: 'subscribe',
      userId,
      timestamp: new Date().toISOString()
    });
  }, [send]);

  // Инициализация соединения при монтировании компонента
  useEffect(() => {
    // Устанавливаем соединение при монтировании
    connect();

    // Очищаем ресурсы при размонтировании
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    lastMessage,
    send,
    subscribeToUserUpdates,
    connect,
    disconnect,
    forceReconnect,
    errorCount
  };
};

export default useWebSocket;