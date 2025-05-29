/**
 * Утилита для подавления ненужных логов в консоли
 * Используется для сокрытия служебных сообщений от библиотек
 */

/**
 * Перехватывает и фильтрует сообщения console.log
 */
export function setupLogSuppression() {
  // Сохраняем оригинальные методы
  const originalConsoleLog = console.log;
  
  // Список паттернов для фильтрации
  const suppressPatterns = [
    '[Polyfill Monitor] Map constructor called with:',
  ];
  
  // Переопределяем console.log
  console.log = function(...args: any[]) {
    // Проверяем, содержит ли сообщение паттерн для подавления
    if (args.length > 0 && typeof args[0] === 'string') {
      for (const pattern of suppressPatterns) {
        if (args[0].includes(pattern)) {
          // Сообщение содержит паттерн для подавления - не выводим его
          return;
        }
      }
    }
    
    // Вызываем оригинальный метод для сообщений, которые не нужно подавлять
    originalConsoleLog.apply(console, args);
  };
}

/**
 * Восстанавливает оригинальные методы консоли
 */
export function restoreOriginalConsole() {
  // Восстанавливаем оригинальные методы, если они были сохранены через замыкание
  if (typeof window !== 'undefined') {
    // Можно использовать для восстановления оригинальных методов,
    // но в данном случае оставим переопределенные методы работать до конца сессии
  }
}