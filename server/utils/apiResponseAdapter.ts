/**
 * Адаптер для API-відповідей
 * 
 * Цей модуль вирішує проблеми з типами у функціях відправки API-відповідей,
 * забезпечуючи сумісність старого коду з новими вимогами типізації.
 */

import { Response } from 'express';
import { sendSuccess, sendError, sendServerError } from './responseUtils';

/**
 * Адаптер для відправки успішної відповіді API
 * Підтримує як старий формат (res, data, status),
 * так і новий формат (res, data, message, status)
 * 
 * @param res Об'єкт відповіді Express
 * @param data Дані для відправки
 * @param messageOrStatus Повідомлення або статус код
 * @param status HTTP статус код
 */
export function adaptedSendSuccess(
  res: Response, 
  data: any,
  messageOrStatus?: string | number,
  status?: number
): void {
  // Визначаємо, який формат аргументів використовується
  if (typeof messageOrStatus === 'number') {
    // Старий формат: (res, data, status)
    sendSuccess(res, data, undefined, messageOrStatus);
  } else {
    // Новий формат: (res, data, message, status)
    sendSuccess(res, data, messageOrStatus, status || 200);
  }
}

/**
 * Адаптер для відправки відповіді з помилкою API
 * Підтримує як старий формат (res, message, code, status),
 * так і новий формат (res, message, status, details)
 * 
 * @param res Об'єкт відповіді Express
 * @param message Повідомлення про помилку
 * @param codeOrStatus Код помилки або статус код
 * @param statusOrDetails HTTP статус код або деталі помилки
 */
export function adaptedSendError(
  res: Response, 
  message: string,
  codeOrStatus?: string | number,
  statusOrDetails?: number | any
): void {
  // Визначаємо, який формат аргументів використовується
  if (typeof codeOrStatus === 'number') {
    // Новий формат: (res, message, status, details)
    sendError(res, message, codeOrStatus, statusOrDetails);
  } else if (typeof statusOrDetails === 'number') {
    // Старий формат: (res, message, code, status)
    sendError(res, message, statusOrDetails, { error_code: codeOrStatus });
  } else {
    // За замовчуванням
    sendError(res, message, 400, typeof codeOrStatus === 'string' ? { error_code: codeOrStatus } : codeOrStatus);
  }
}

/**
 * Адаптер для відправки серверної помилки API
 * 
 * @param res Об'єкт відповіді Express
 * @param message Повідомлення про помилку
 * @param details Деталі помилки
 */
export function adaptedSendServerError(
  res: Response, 
  message: string = 'Внутрішня помилка серверу',
  details?: any
): void {
  sendServerError(res, message, details);
}