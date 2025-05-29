/**
 * Контролер для роботи з транзакціями користувачів
 * 
 * Цей файл містить всі операції, пов'язані з історією транзакцій,
 * створенням нових транзакцій та обробкою виведення коштів
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { transactions, User } from '@shared/schema';
import { db } from '../db';
import { eq, desc } from 'drizzle-orm';
import { transactionService, userService } from '../services';
import { adaptedSendSuccess as sendSuccess, adaptedSendError as sendError, adaptedSendServerError as sendServerError } from '../utils/apiResponseAdapter';
import { DatabaseService } from "../db-service-wrapper";
import { ensureNumber, ensureDate, ensureDateObject } from '../utils/typeFixers';

// Визначення необхідних перерахувань
export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  REWARD = 'reward',
  TRANSFER = 'transfer',
  FEE = 'fee'
}

export enum Currency {
  UNI = 'uni',
  TON = 'ton'
}

export enum TransactionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  DECLINED = 'declined',
  FAILED = 'failed'
}

export enum TransactionCategory {
  FARMING = 'farming',
  REFERRAL = 'referral',
  BONUS = 'bonus',
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal'
}
// Контролер для роботи з транзакціями
export class TransactionController {
  // Тестовый массив транзакций для демонстрации
  static testTransactions = [
    {
      id: 1,
      user_id: 1,
      type: 'deposit',
      currency: 'UNI',
      amount: '100',
      status: 'confirmed',
      created_at: new Date(Date.now() - 3600000 * 24 * 5)
    },
    {
      id: 2,
      user_id: 1,
      type: 'reward',
      currency: 'UNI',
      amount: '50',
      status: 'confirmed',
      created_at: new Date(Date.now() - 3600000 * 24 * 3)
    },
    {
      id: 3,
      user_id: 1,
      type: 'withdraw',
      currency: 'TON',
      amount: '1.5',
      status: 'pending',
      created_at: new Date(Date.now() - 3600000 * 24 * 1)
    }
  ];

  /**
   * Получает историю транзакций пользователя
   * Поддерживает поиск по user_id или wallet_address
   */
  static async getUserTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Валидация параметров запроса
      const querySchema = z.object({
        user_id: z.string().optional(),
        wallet_address: z.string().optional(),
        limit: z.string().optional(),
        offset: z.string().optional(),
      });

      const validation = querySchema.safeParse(req.query);
      if (!validation.success) {
        console.error("[TransactionController] Ошибка валидации запроса:", validation.error);
        sendError(res, "Некорректные параметры запроса", 400, validation.error.format());
        return;
      }

      const { user_id, wallet_address, limit = '50', offset = '0' } = validation.data;
      
      console.log(`[TransactionController] Запрос транзакций: user_id=${user_id}, wallet_address=${wallet_address}, limit=${limit}, offset=${offset}`);
      
      // Более подробное логирование для аудита
      if (wallet_address) {
        console.log(`[TransactionController AUDIT] Получен запрос с wallet_address: ${wallet_address}`);
      }
      
      let userId: number | undefined;
      
      // Если указан wallet_address, находим пользователя по адресу кошелька
      if (wallet_address) {
        const getUserByWallet = DatabaseService(
          userService.getUserByWalletAddress.bind(userService),
          async (error) => {
            console.error('[TransactionController] Ошибка при поиске пользователя по адресу кошелька:', error);
            return null;
          }
        );
        
        const dbUser = await getUserByWallet(wallet_address);
        if (dbUser) {
          // Адаптуємо об'єкт користувача, щоб уникнути помилок LSP з типами даних
          // Просто використовуємо оригінальний об'єкт користувача
          const user = dbUser;
          userId = user.id;
          console.log(`[TransactionController] Найден пользователь ${userId} по адресу кошелька ${wallet_address}`);
        } else {
          console.log(`[TransactionController] Пользователь не найден по адресу кошелька ${wallet_address}`);
          
          // Для аудита - вывод сообщения о возвращении пустого массива
          console.log(`[TransactionController AUDIT] Пользователь не найден по адресу кошелька, возвращаем пустой массив транзакций`);
          const emptyResponse = {
            success: true,
            data: {
              total: 0,
              transactions: []
            }
          };
          console.log(`[TransactionController AUDIT] Возвращаемый ответ:`, JSON.stringify(emptyResponse));
          
          // Если пользователь не найден по адресу кошелька, возвращаем пустой список
          sendSuccess(res, {
            total: 0,
            transactions: []
          });
          return;
        }
      } else if (user_id) {
        // Если указан user_id, используем его
        userId = parseInt(user_id);
      } else {
        // Если не указаны ни user_id, ни wallet_address, возвращаем ошибку
        sendError(res, "Необходимо указать user_id или wallet_address", 400);
        return;
      }
      
      // Получаем транзакции из базы данных
      // Явно визначаємо тип для транзакцій
      type TransactionType = typeof transactions.$inferSelect;
      let userTransactions: TransactionType[] = [];
      
      if (userId !== undefined) {
        userTransactions = await db
          .select()
          .from(transactions)
          .where(userId ? eq(transactions.user_id, userId) : undefined)
          .orderBy(desc(transactions.created_at))
          .limit(parseInt(limit))
          .offset(parseInt(offset));
      }
      
      console.log(`[TransactionController] Найдено ${userTransactions.length} транзакций для пользователя ${userId} в БД`);
      
      // Дополнительное логирование для отладки
      if (userTransactions.length > 0) {
        console.log(`[TransactionController] Примеры транзакций:`, 
          userTransactions.slice(0, 2).map((tx) => ({
            id: tx.id,
            type: tx.type ?? 'unknown',
            currency: tx.currency ?? 'unknown',
            amount: tx.amount ?? '0',
            status: tx.status ?? 'unknown',
            source: tx.source ?? 'unknown',
            category: tx.category ?? 'unknown',
            created_at: ensureDate(tx.created_at) // Обеспечиваем стабильный формат даты
          }))
        );
      } else {
        console.log(`[TransactionController] Транзакции не найдены для пользователя ${userId}`);
      }
      
      // Стабілізуємо формат timestamp-полів для відповіді API
      const formattedTransactions = userTransactions.map(tx => ({
        ...tx,
        created_at: ensureDate(tx.created_at) // Забезпечуємо стабільний формат дати
      }));

      sendSuccess(res, {
        total: userTransactions.length, // В реальном приложении здесь должен быть отдельный запрос для подсчета общего количества
        transactions: formattedTransactions
      });

    } catch (error) {
      console.error("[TransactionController] Ошибка при получении транзакций:", error);
      sendServerError(res, "Произошла ошибка при обработке запроса");
    }
  }

  /**
   * Запрос на вывод средств
   */
  static async withdrawFunds(req: Request, res: Response): Promise<void> {
    try {
      // Валидация входных данных с помощью Zod
      const schema = z.object({
        user_id: z.number().int().positive("ID пользователя должен быть положительным целым числом"),
        amount: z.string().or(z.number()).refine(val => {
          const num = typeof val === "string" ? parseFloat(val) : val;
          return !isNaN(num) && num > 0;
        }, { message: "Сумма должна быть положительным числом" }),
        currency: z.string().min(1, "Валюта должна быть указана").refine(val => 
          ['UNI', 'TON'].includes(val.toUpperCase()), 
          { message: "Валюта должна быть UNI или TON" }
        ),
        address: z.string().min(1, "Адрес кошелька должен быть указан")
      });
      
      const validation = schema.safeParse(req.body);
      
      if (!validation.success) {
        console.error("[TransactionController] Ошибка валидации запроса:", validation.error.format());
        sendError(res, "Некорректные параметры запроса", 400, validation.error.format());
        return;
      }
      
      const { user_id, amount, currency, address } = validation.data;
      
      // Преобразование суммы к числу
      const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
      
      // Верхнеуровневый формат валюты для унификации
      const formattedCurrency = currency.toUpperCase();
      
      console.log(`[TransactionController] Запрос на вывод: user_id=${user_id}, amount=${numAmount}, currency=${formattedCurrency}, address=${address}`);
      
      // Проверка формата адреса (для TON)
      if (formattedCurrency === 'TON') {
        const tonAddressRegex = /^(?:UQ|EQ)[A-Za-z0-9_-]{46,48}$/;
        if (!tonAddressRegex.test(address)) {
          console.error(`[TransactionController] Некорректный формат TON-адреса: ${address}`);
          sendError(res, "Некорректный формат TON-адреса", 400);
          return;
        }
      }
      
      // Проверяем существование пользователя через сервис пользователей
      const getUserById = DatabaseService(
        userService.getUserById.bind(userService),
        async (error) => {
          console.error('[TransactionController] Ошибка при поиске пользователя по ID:', error);
          return null;
        }
      );
      
      const dbUser = await getUserById(user_id);
      if (!dbUser) {
        console.error(`[TransactionController] Пользователь не найден: ${user_id}`);
        sendError(res, "Пользователь не найден", 404);
        return;
      }
      
      // Просто використовуємо оригінальний об'єкт користувача без додаткових перетворень
      const user = dbUser;
      
      // Проверяем достаточность средств на балансе
      // Используем безопасное получение значений баланса с учетом возможных отличий в типе пользователя
      const balanceUni = typeof user.balance_uni === 'string' ? user.balance_uni : '0';
      const balanceTon = typeof user.balance_ton === 'string' ? user.balance_ton : '0';
      
      const balance = formattedCurrency === 'UNI' 
        ? parseFloat(balanceUni || '0')
        : parseFloat(balanceTon || '0');
        
      if (balance < numAmount) {
        console.error(`[TransactionController] Недостаточно средств для вывода: на балансе ${balance} ${formattedCurrency}, запрошено ${numAmount}`);
        sendError(res, `Недостаточно средств для вывода. Доступный баланс: ${balance} ${formattedCurrency}`, 400);
        return;
      }
      
      // Создаем запись о транзакции через TransactionService
      const transactionData = {
        userId: user_id,
        type: 'withdraw',
        currency: formattedCurrency,
        amount: numAmount.toString(),
        status: 'pending',
        source: 'user_request',
        category: 'withdrawal'
      };
      
      const transaction = await transactionService.logTransaction(transactionData);
      
      // Здесь должен быть код для обработки запроса на вывод средств
      // Обновление баланса пользователя будет выполняться после подтверждения вывода
      
      // Форматируем дату для ответа API
      const formattedTransaction = {
        ...transaction,
        created_at: ensureDate(transaction.created_at)
      };
      
      sendSuccess(res, {
        message: "Запрос на вывод средств принят",
        transaction_id: formattedTransaction.id,
        status: formattedTransaction.status,
        amount: numAmount,
        currency: formattedCurrency,
        created_at: formattedTransaction.created_at // Добавляем отформатированную дату в ответ
      });
    } catch (error) {
      console.error("[TransactionController] Ошибка при запросе на вывод средств:", error);
      sendServerError(res, "Произошла ошибка при обработке запроса на вывод средств");
    }
  }

  /**
   * Создает транзакцию (для внутреннего использования)
   */
  static async createTransaction(req: Request, res: Response): Promise<void> {
    try {
      const schema = z.object({
        user_id: z.number(),
        type: z.string(),
        currency: z.string(),
        amount: z.string().or(z.number()),
        status: z.string().optional(),
        source: z.string().optional(),
        category: z.string().optional(),
        tx_hash: z.string().optional()
      });

      const validation = schema.safeParse(req.body);
      if (!validation.success) {
        console.error("[TransactionController] Ошибка валидации запроса:", validation.error);
        sendError(res, "Некорректные параметры запроса", 400, validation.error.format());
        return;
      }

      const { user_id, type, currency, amount, status = 'pending', source = 'api', category = 'system', tx_hash = null } = validation.data;

      // Создаем транзакцию через сервис
      const transaction = await transactionService.logTransaction({
        userId: user_id,
        type: String(type), // Гарантуємо тип string
        currency: String(currency), // Гарантуємо тип string
        amount: String(amount), // Гарантуємо тип string
        status: String(status), // Гарантуємо тип string
        source: String(source), // Гарантуємо тип string
        category: String(category), // Гарантуємо тип string
        tx_hash: tx_hash // Опціональне поле
      });

      sendSuccess(res, { transaction });
    } catch (error) {
      console.error("[TransactionController] Ошибка при создании транзакции:", error);
      sendServerError(res, "Произошла ошибка при создании транзакции");
    }
  }
}