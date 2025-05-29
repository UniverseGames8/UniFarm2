/**
 * Типы для модуля подключения к PostgreSQL через Drizzle ORM
 */

import { Pool, QueryResult } from 'pg';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../shared/schema';

export const db: NodePgDatabase<typeof schema>;
export const pool: Pool;

/**
 * Функция для выполнения SQL-запросов напрямую
 */
export function query(text: string, params?: any[]): Promise<QueryResult>;

/**
 * Функция для выполнения SQL-запросов с повторными попытками
 */
export function queryWithRetry(
  text: string, 
  params?: any[], 
  retries?: number, 
  delay?: number
): Promise<QueryResult>;

/**
 * Интерфейс для результата проверки соединения с базой данных
 */
export interface TestConnectionResult {
  success: boolean;
  timestamp?: Date;
  message?: string;
}

/**
 * Интерфейс для статуса соединения с базой данных
 */
export interface DbConnectionStatus {
  isConnected: boolean;
  lastConnectionAttempt: Date | null;
  error: Error | null;
  update(): Promise<boolean>;
}

/**
 * Текущий статус соединения с базой данных
 */
export const dbConnectionStatus: DbConnectionStatus;

/**
 * Функция для тестирования соединения с базой данных
 */
export function testDatabaseConnection(): Promise<TestConnectionResult>;