/**
 * Центральний файл для експорту усіх утиліт
 * 
 * Цей файл експортує усі адаптери та утиліти з відповідних файлів,
 * що спрощує імпорт та використання у контролерах
 */

export * from './apiResponseAdapter';
export * from './responseUtils';
export * from './typeFixers';
export * from './validationUtils';
export * from './userAdapter';

// Додаємо алиас для покращення читабельності коду
import { 
  adaptedSendSuccess, 
  adaptedSendError, 
  adaptedSendServerError 
} from './apiResponseAdapter';

// Експортуємо API-адаптери під простішими іменами для зручності
export const apiSuccess = adaptedSendSuccess;
export const apiError = adaptedSendError;
export const apiServerError = adaptedSendServerError;