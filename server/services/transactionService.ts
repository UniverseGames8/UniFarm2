/**
 * Сервис для работы с транзакциями - файл-посредник
 * 
 * Этот файл экспортирует функциональность из инстанс-ориентированной реализации
 * для обеспечения совместимости импортов и перенаправляет статические вызовы на инстанс.
 */

// Импортируем тип из схемы
import { type InsertTransaction } from '@shared/schema';

// Импортируем остальные типы и интерфейсы из инстанса
import { 
  TransactionType, 
  Currency, 
  TransactionStatus,
  TransactionCategory,
  type TransactionData
} from './transactionServiceInstance';

// Импортируем инстанс сервиса транзакций из центрального экспорта
import { transactionService } from './index';

// Реэкспортируем типы для совместимости
export { 
  TransactionType, 
  Currency, 
  TransactionStatus,
  TransactionData,
  TransactionCategory // Теперь импортируем TransactionCategory из инстанса
};

// Переопределяем статический API для обеспечения обратной совместимости
export const TransactionService = {
  // Создание транзакции
  async createTransaction(data: InsertTransaction): Promise<any> {
    return transactionService.createTransaction(data);
  },
  
  // Получение транзакции по ID
  async getTransactionById(id: number): Promise<any | undefined> {
    return transactionService.getTransactionById(id);
  },
  
  // Получение транзакций пользователя
  async getUserTransactions(userId: number, limit = 50): Promise<any[]> {
    return transactionService.getUserTransactions(userId, limit);
  },
  
  // Обновление статуса транзакции
  async updateTransactionStatus(id: number, status: TransactionStatus): Promise<any | undefined> {
    return transactionService.updateTransactionStatus(id, status);
  },
  
  // Логирование транзакции
  async logTransaction(data: TransactionData): Promise<any> {
    return transactionService.logTransaction(data);
  }
};