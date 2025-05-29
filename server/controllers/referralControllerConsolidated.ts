import { Request, Response, NextFunction } from 'express';
import { referralService, userService } from '../services';
import { referralServiceInstance } from '../services/referralServiceInstance';
import { sendSuccess, sendSuccessArray, sendError, sendServerError } from '../utils/responseUtils';
import { extractUserId } from '../utils/validationUtils';
import { ValidationError } from '../middleware/errorHandler';
import { storage as memStorage } from '../storage-memory';
import { DatabaseService } from "../db-service-wrapper";
import { ReferralService } from '../services/referralService';

/**
 * Консолидированный контроллер для работы с реферальной системой с поддержкой fallback
 * 
 * Отвечает за обработку HTTP-запросов, связанных с реферальной системой.
 * Соответствует принципу единственной ответственности (SRP).
 * Имеет встроенную поддержку работы в случае недоступности базы данных.
 */
export class ReferralController {
  /**
   * Генерирует реферальный код для пользователя
   * [TG REGISTRATION FIX] Обновленная версия согласно ТЗ
   * @route GET /api/referral/code
   */
  static async generateReferralCode(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      // Извлекаем ID пользователя
      const userIdRaw = extractUserId(req);
      if (!userIdRaw || isNaN(userIdRaw) || userIdRaw <= 0) {
        return sendError(res, 'Некорректный идентификатор пользователя', 400);
      }
      
      const userId = Number(userIdRaw);
      console.log(`[TG REF FIX] Запрос реферального кода для пользователя: ${userId}`);
      
      try {
        // Получаем пользователя и его реферальный код
        const user = await userService.getUserById(userId);
        
        if (user) {
          // Пользователь найден - проверяем, есть ли у него реферальный код
          if (user.ref_code) {
            // У пользователя есть код - возвращаем его
            const result = {
              user_id: userId,
              ref_code: user.ref_code,
              share_url: `https://t.me/UniFarming_Bot?start=${user.ref_code}`,
              is_fallback: false
            };
            
            console.log(`[TG REF FIX] Найден существующий пользователь с кодом: ${user.ref_code}`);
            return sendSuccess(res, result);
          } else {
            // У пользователя нет кода - генерируем и сохраняем
            console.log(`[TG REF FIX] У пользователя ${userId} нет реферального кода, генерируем новый`);
            const newRefCode = await userService.generateRefCode();
            await userService.updateUserRefCode(userId, newRefCode);
            
            const result = {
              user_id: userId,
              ref_code: newRefCode,
              share_url: `https://t.me/UniFarming_Bot?start=${newRefCode}`,
              is_fallback: false,
              message: 'Создан и сохранен новый реферальный код'
            };
            
            console.log(`[TG REF FIX] Создан и сохранен новый код: ${newRefCode}`);
            return sendSuccess(res, result);
          }
        } else {
          // Пользователь не найден - согласно ТЗ создаем его через userService
          console.log(`[TG REF FIX] Пользователь ${userId} не найден, но это не должно происходить`);
          console.log(`[TG REF FIX] Пользователь должен быть создан через API /api/register/telegram перед запросом реферального кода`);
          
          return sendError(res, 'Пользователь не найден. Сначала зарегистрируйтесь через Telegram', 404);
        }
      } catch (error) {
        console.error(`[TG REF FIX] Ошибка при работе с реферальным кодом:`, error);
        return sendError(res, 'Ошибка при получении реферального кода', 500);
      }
    } catch (error) {
      console.error(`[TG REF FIX] Критическая ошибка в generateReferralCode:`, error);
      if (next) {
        next(error);
      } else {
        return sendError(res, 'Внутренняя ошибка сервера', 500);
      }
    }
  }

  /**
   * Получает реферальное дерево для пользователя 
   * @route GET /api/referrals/tree
   */
  static async getReferralTree(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      // Извлекаем ID пользователя
      const userIdRaw = extractUserId(req);
      if (!userIdRaw || isNaN(userIdRaw) || userIdRaw <= 0) {
        return sendError(res, 'Некорректный идентификатор пользователя', 400);
      }
      
      const userId = Number(userIdRaw);
      console.log(`[ReferralController] Запрос реферального дерева для пользователя: ${userId}`);
      
      try {
        // Получаем все реферальные связи пользователя
        const referrals = await referralService.getUserReferrals(userId);
        
        // В таблице referrals user_id - тот, кто был приглашен, а inviter_id - кто пригласил
        // Для дерева рефералов нам нужны те, кого пригласил текущий пользователь (где наш userId - это inviter_id)
        const invitees = referrals.filter(ref => ref.inviter_id === userId)
          .map(ref => ({
            id: ref.user_id, // Тот, кого пригласил текущий пользователь
            username: null, // Будет заполнено в отдельном запросе, если нужно
            level: ref.level || 1
          }));
        
        // Формируем реферальное дерево
        const referralTree = {
          user_id: userId,
          invitees: invitees,
          total_invitees: invitees.length,
          levels_data: []
        };
        
        // Диагностический лог согласно ТЗ
        console.log(`[REF TREE REQUEST] User ${userId} tree with ${invitees.length} invitees`);
        
        // Форматируем и отправляем ответ
        sendSuccess(res, referralTree);
      } catch (error) {
        console.log(`[ReferralController] Ошибка при получении реферального дерева: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
        
        // Запускаем fallback режим
        await ReferralController._getReferralTreeWithFallback(req, res, next);
      }
    } catch (error) {
      console.error('[ReferralController] Ошибка при обработке запроса реферального дерева:', error);
      
      if (next) {
        next(error);
      } else {
        sendServerError(res, 'Ошибка при получении реферального дерева');
      }
    }
  }
  
  /**
   * Fallback метод для получения реферального дерева
   * @private
   */
  private static async _getReferralTreeWithFallback(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      // Извлекаем ID пользователя
      const userIdRaw = extractUserId(req);
      if (!userIdRaw || isNaN(userIdRaw) || userIdRaw <= 0) {
        return sendError(res, 'Некорректный идентификатор пользователя', 400);
      }
      
      const userId = Number(userIdRaw);
      console.log(`[ReferralController] Fallback: Запрос реферального дерева для пользователя: ${userId}`);
      
      // Заворачиваем вызов сервиса в обработчик ошибок
      const getReferralTreeFallback = DatabaseService(
        ReferralService.getReferralTree.bind(ReferralService),
        async (error, userId) => {
          console.log(`[ReferralController] Используем fallback для получения реферального дерева для пользователя: ${userId}`, error);
          
          try {
            // Проверяем существование пользователя
            const user = await memStorage.getUser(userId);
            if (!user) {
              console.log(`[ReferralController] Fallback: Пользователь с ID ${userId} не найден в MemStorage`);
              return {
                user_id: userId,
                invitees: [],
                total_invitees: 0,
                levels_data: [],
                is_fallback: true,
                message: 'Данные в режиме fallback'
              };
            }
            
            // Получаем всех пользователей из MemStorage
            const allUsers = memStorage['users'];
            console.log(`[ReferralController] Fallback: Получено ${allUsers.length} пользователей из MemStorage`);
            
            // Фильтруем пользователей, чтобы получить рефералов
            const invitees = allUsers.filter(refUser => 
              refUser.parent_ref_code === user.ref_code
            ).map(refUser => ({
              id: refUser.id,
              username: refUser.username || 'user',
              level: 1
            }));
            
            console.log(`[ReferralController] Fallback: Найдено ${invitees.length} прямых рефералов`);
            
            // Формируем результат
            return {
              user_id: userId,
              invitees: invitees,
              total_invitees: invitees.length,
              levels_data: [],
              is_fallback: true,
              message: 'Данные получены из резервного хранилища'
            };
          } catch (memError) {
            console.error(`[ReferralController] Fallback: Ошибка при получении данных из MemStorage:`, memError);
            
            // Возвращаем пустые данные при ошибке
            return {
              user_id: userId,
              invitees: [],
              total_invitees: 0,
              levels_data: [],
              is_fallback: true,
              message: 'Недоступно из-за ошибки в резервном хранилище'
            };
          }
        }
      );
      
      // Получаем данные через обёртку
      const treeData = await getReferralTreeFallback(userId);
      sendSuccess(res, treeData);
    } catch (error) {
      console.error('[ReferralController] Fallback: Критическая ошибка:', error);
      
      if (next) {
        next(error);
      } else {
        sendServerError(res, 'Критическая ошибка при получении реферального дерева');
      }
    }
  }
  
  /**
   * Получает статистику рефералов для пользователя
   * @route GET /api/referrals/stats
   */
  static async getReferralStats(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      // Извлекаем ID пользователя
      const userIdRaw = extractUserId(req);
      if (!userIdRaw || isNaN(userIdRaw) || userIdRaw <= 0) {
        return sendError(res, 'Некорректный идентификатор пользователя', 400);
      }
      
      const userId = Number(userIdRaw);
      console.log(`[ReferralController] Запрос статистики рефералов для пользователя: ${userId}`);
      
      try {
        // Получаем все реферальные связи пользователя
        const referrals = await referralService.getUserReferrals(userId);
        
        // Группируем рефералов по уровням
        const levelCounts: Record<number, number> = {};
        referrals.forEach(ref => {
          const level = ref.level || 1;
          levelCounts[level] = (levelCounts[level] || 0) + 1;
        });
        
        // Формируем объект статистики
        const stats = {
          user_id: userId,
          total_invitees: referrals.length,
          levels: levelCounts,
          total_earned: {
            amount: "0", // Это значение должно быть получено из сервиса балансов
            currency: "TON"
          }
        };
        
        // Диагностический лог согласно ТЗ
        console.log(`[REF STATS RETURNED] User ${userId} stats: ${stats.total_invitees} invitees across ${Object.keys(stats.levels).length} levels`);
        
        // Форматируем и отправляем ответ
        sendSuccess(res, stats);
      } catch (error) {
        console.log(`[ReferralController] Ошибка при получении статистики рефералов: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
        
        // Запускаем fallback режим
        await ReferralController._getReferralStatsWithFallback(req, res, next);
      }
    } catch (error) {
      console.error('[ReferralController] Ошибка при обработке запроса статистики рефералов:', error);
      
      if (next) {
        next(error);
      } else {
        sendServerError(res, 'Ошибка при получении статистики рефералов');
      }
    }
  }
  
  /**
   * Fallback метод для получения статистики рефералов
   * @private
   */
  private static async _getReferralStatsWithFallback(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      // Извлекаем ID пользователя
      const userIdRaw = extractUserId(req);
      if (!userIdRaw || isNaN(userIdRaw) || userIdRaw <= 0) {
        return sendError(res, 'Некорректный идентификатор пользователя', 400);
      }
      
      const userId = Number(userIdRaw);
      console.log(`[ReferralController] Fallback: Запрос реферальной статистики для пользователя: ${userId}`);
      
      // Заворачиваем вызов сервиса в обработчик ошибок
      const getReferralStatsFallback = DatabaseService(
        ReferralService.getReferralStats.bind(ReferralService),
        async (error, userId) => {
          console.log(`[ReferralController] Fallback: Используем fallback для получения реферальной статистики:`, error);
          
          try {
            // Проверяем существование пользователя
            const user = await memStorage.getUser(userId);
            if (!user) {
              console.log(`[ReferralController] Fallback: Пользователь с ID ${userId} не найден в MemStorage`);
              return {
                user_id: userId,
                total_invitees: 0,
                levels: {},
                total_earned: {
                  amount: "0",
                  currency: "TON"
                },
                is_fallback: true,
                message: 'Данные в режиме fallback'
              };
            }
            
            // Получаем всех пользователей из MemStorage
            const allUsers = memStorage['users'];
            
            // Фильтруем пользователей, чтобы получить рефералов
            const referrals = allUsers.filter(refUser => 
              refUser.parent_ref_code === user.ref_code
            );
            
            // В режиме fallback все рефералы считаются уровня 1
            const levels = { 1: referrals.length };
            
            // Формируем результат
            return {
              user_id: userId,
              total_invitees: referrals.length,
              levels: levels,
              total_earned: {
                amount: "0",
                currency: "TON"
              },
              is_fallback: true,
              message: 'Статистика получена из резервного хранилища'
            };
          } catch (memError) {
            console.error(`[ReferralController] Fallback: Ошибка при получении данных из MemStorage:`, memError);
            
            // Возвращаем пустые данные при ошибке
            return {
              user_id: userId,
              total_invitees: 0,
              levels: {},
              total_earned: {
                amount: "0",
                currency: "TON"
              },
              is_fallback: true,
              message: 'Недоступно из-за ошибки в резервном хранилище'
            };
          }
        }
      );
      
      // Получаем данные через обёртку
      const statsData = await getReferralStatsFallback(userId);
      sendSuccess(res, statsData);
    } catch (error) {
      console.error('[ReferralController] Fallback: Критическая ошибка:', error);
      
      if (next) {
        next(error);
      } else {
        sendServerError(res, 'Критическая ошибка при получении статистики рефералов');
      }
    }
  }
  
  /**
   * Обрабатывает запрос на регистрацию параметра start
   * Этот параметр получается из Telegram WebApp.startParam и используется для
   * отслеживания реферальных приглашений
   */
  static async registerStartParam(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const startParam = req.body.startParam || req.headers['x-start-param'];
      const telegramUserId = req.headers['x-telegram-user-id'];
      
      // Подробное логирование для отладки
      console.log(`[ReferralController] [StartParam] Processing request:`, {
        startParam,
        telegramUserId,
        hasBody: !!req.body,
        headers: Object.keys(req.headers)
      });
      
      if (!startParam) {
        console.warn('[ReferralController] [StartParam] No startParam provided');
        return sendError(res, 'Отсутствует параметр start', 400);
      }
      
      // Логика для поиска пользователя по реферальному коду
      let inviterId = null;
      let refCode = startParam;
      
      try {
        // Ищем пользователя по ref_code в базе
        console.log(`[ReferralController] Ищем пользователя по коду: ${refCode}`);
        
        // Пытаемся найти пользователя с таким кодом
        const inviterUser = await userService.getUserByRefCode(refCode);
        
        if (inviterUser) {
          inviterId = inviterUser.id;
          console.log(`[ReferralController] Найден пригласитель: ${inviterId} по реферальному коду: ${refCode}`);
        } else {
          console.warn(`[ReferralController] [StartParam] Пригласитель не найден для кода: ${refCode}`);
        }
      } catch (error) {
        console.error(`[ReferralController] Ошибка при поиске пригласителя:`, error);
        
        // Запускаем fallback для поиска пользователя
        try {
          const fallbackUser = await memStorage.getUserByRefCode(refCode);
          if (fallbackUser) {
            inviterId = fallbackUser.id;
            console.log(`[ReferralController] Fallback: Найден пригласитель в MemStorage: ${inviterId} по коду: ${refCode}`);
          }
        } catch (fallbackError) {
          console.error(`[ReferralController] Fallback: Ошибка при поиске пригласителя:`, fallbackError);
        }
      }
      
      // Если пригласитель не найден, возвращаем ошибку
      if (!inviterId) {
        console.warn(`[ReferralController] [StartParam] No inviter found for startParam: ${startParam}`);
        return sendError(res, `Пригласитель не найден для параметра: ${startParam}`, 404);
      }
      
      try {
        // Получаем данные о пользователе-пригласителе
        const inviterUser = await userService.getUserById(inviterId);
        
        if (inviterUser) {
          console.log(`[ReferralController] [StartParam] Successfully processed startParam. Inviter: ${inviterUser.username} (ID: ${inviterId})`);
          
          // Возвращаем успешный результат с данными
          sendSuccess(res, {
            message: 'Параметр start успешно обработан',
            inviterId: inviterId,
            inviterUsername: inviterUser.username,
            refCode: refCode
          });
        } else {
          // Пытаемся получить данные о пользователе из MemStorage
          const fallbackUser = await memStorage.getUser(inviterId);
          
          if (fallbackUser) {
            console.log(`[ReferralController] Fallback: Successfully processed startParam from MemStorage. Inviter ID: ${inviterId}`);
            
            sendSuccess(res, {
              message: 'Параметр start успешно обработан (fallback режим)',
              inviterId: inviterId,
              inviterUsername: fallbackUser.username || 'user',
              refCode: refCode,
              is_fallback: true
            });
          } else {
            console.warn(`[ReferralController] [StartParam] Inviter user not found with id: ${inviterId}`);
            return sendError(res, 'Пригласитель не найден в базе данных', 500);
          }
        }
      } catch (error) {
        console.error('[ReferralController] [StartParam] Error getting inviter details:', error);
        
        // Пытаемся получить данные о пользователе из MemStorage
        try {
          const fallbackUser = await memStorage.getUser(inviterId);
          
          if (fallbackUser) {
            console.log(`[ReferralController] Fallback: Successfully processed startParam from MemStorage. Inviter ID: ${inviterId}`);
            
            sendSuccess(res, {
              message: 'Параметр start успешно обработан (fallback режим)',
              inviterId: inviterId,
              inviterUsername: fallbackUser.username || 'user',
              refCode: refCode,
              is_fallback: true
            });
          } else {
            sendError(res, 'Пригласитель не найден в базе данных', 500);
          }
        } catch (fallbackError) {
          console.error('[ReferralController] Fallback: Error getting inviter details:', fallbackError);
          sendServerError(res, 'Ошибка обработки параметра start');
        }
      }
    } catch (error) {
      console.error('[ReferralController] [StartParam] Error processing startParam:', error);
      
      // Обрабатываем ValidationError отдельно
      if (error instanceof ValidationError) {
        return sendError(res, error.message, 400, error.errors);
      }
      
      if (next) {
        next(error);
      } else {
        sendServerError(res, 'Ошибка обработки параметра start');
      }
    }
  }
  
  /**
   * Получает данные по партнерке для пользователя
   * @route GET /api/referrals/user
   */
  static async getUserReferrals(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      // Валидация userId с использованием безопасной обертки
      const userIdRaw = extractUserId(req);
      
      // Проверяем, что userId - это положительное целое число
      if (!userIdRaw || isNaN(userIdRaw) || userIdRaw <= 0) {
        console.log('[ReferralController] Некорректный userId в запросе:', userIdRaw);
        return sendError(res, 'Некорректный идентификатор пользователя', 400);
      }
      
      const userId = Number(userIdRaw);
      console.log(`[ReferralController] Запрос данных для пользователя: ${userId}`);

      try {
        // Получаем список рефералов пользователя
        const referrals = await referralService.getUserReferrals(userId);
        
        // Формируем структуру ответа
        const referralData = {
          user_id: userId,
          username: null, // Будет заполнено при необходимости
          ref_code: null, // Будет заполнено при необходимости
          total_referrals: referrals.length,
          referral_counts: {}, // Подсчёт рефералов по уровням
          level_income: {},    // Доход по уровням
          referrals: referrals
        };
        
        // Отправляем успешный ответ
        sendSuccess(res, referralData);
      } catch (error) {
        console.error('[ReferralController] Ошибка при получении реферальных данных:', error);
        
        // Используем fallback режим
        await ReferralController._getUserReferralsWithFallback(req, res, next);
      }
    } catch (error) {
      console.error('[ReferralController] Критическая ошибка:', error);
      
      if (next) {
        next(error);
      } else {
        sendServerError(res, 'Критическая ошибка при обработке запроса реферальных данных');
      }
    }
  }
  
  /**
   * Fallback метод для получения данных о рефералах пользователя
   * @private
   */
  private static async _getUserReferralsWithFallback(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      // Валидация userId с использованием безопасной обертки
      const userIdRaw = extractUserId(req);
      
      // Проверяем, что userId - это положительное целое число
      if (!userIdRaw || isNaN(userIdRaw) || userIdRaw <= 0) {
        console.log('[ReferralController] Fallback: Некорректный userId в запросе:', userIdRaw);
        return sendError(res, 'Некорректный идентификатор пользователя', 400);
      }
      
      const userId = Number(userIdRaw);
      console.log(`[ReferralController] Fallback: Запрос данных для пользователя: ${userId}`);
      
      // Заворачиваем вызов сервиса в обработчик ошибок
      const getUserReferralsFallback = DatabaseService(
        referralService.getUserReferrals.bind(referralService),
        async (error, userId) => {
          console.log(`[ReferralController] Fallback: Используем fallback для получения данных рефералов:`, error);
          
          try {
            // Проверяем существование пользователя
            const user = await memStorage.getUser(userId);
            if (!user) {
              console.log(`[ReferralController] Fallback: Пользователь с ID ${userId} не найден в MemStorage`);
              return [];
            }
            
            // Получаем всех пользователей из MemStorage
            const allUsers = memStorage['users'];
            
            // Фильтруем пользователей, чтобы получить рефералов
            const referrals = allUsers.filter(refUser => 
              refUser.parent_ref_code === user.ref_code
            ).map(refUser => ({
              user_id: refUser.id,
              inviter_id: userId,
              username: refUser.username || 'user',
              level: 1,
              created_at: refUser.created_at || new Date(),
              is_fallback: true
            }));
            
            console.log(`[ReferralController] Fallback: Найдено ${referrals.length} рефералов`);
            return referrals;
          } catch (memError) {
            console.error(`[ReferralController] Fallback: Ошибка при получении данных из MemStorage:`, memError);
            return [];
          }
        }
      );
      
      // Получаем данные через обёртку
      const referrals = await getUserReferralsFallback(userId);
      
      // Формируем структуру ответа
      const referralData = {
        user_id: userId,
        username: null,
        ref_code: null,
        total_referrals: referrals.length,
        referral_counts: { 1: referrals.length },
        level_income: {},
        referrals: referrals,
        is_fallback: true,
        message: 'Данные получены из резервного хранилища'
      };
      
      // Отправляем успешный ответ
      sendSuccess(res, referralData);
    } catch (error) {
      console.error('[ReferralController] Fallback: Критическая ошибка:', error);
      
      if (next) {
        next(error);
      } else {
        sendServerError(res, 'Критическая ошибка при обработке запроса реферальных данных');
      }
    }
  }
  
  /**
   * Проверяет наличие пригласителя у пользователя
   * @route GET /api/referrals/inviter
   */
  static async getUserInviter(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      // Получаем ID пользователя из запроса
      const userIdRaw = extractUserId(req);
      
      // Проверяем, что userID - валидное положительное число
      if (!userIdRaw || isNaN(userIdRaw) || userIdRaw <= 0) {
        console.log('[ReferralController] Некорректный userId в запросе на получение пригласителя:', userIdRaw);
        return sendError(res, 'Некорректный идентификатор пользователя', 400);
      }
      
      const userId = Number(userIdRaw);
      console.log(`[ReferralController] Запрос данных о пригласителе для пользователя: ${userId}`);

      try {
        // Проверяем существование пользователя
        const user = await userService.getUserById(userId);
        if (!user) {
          console.log(`[ReferralController] Пользователь с ID ${userId} не найден`);
          
          // Пытаемся найти пользователя в MemStorage
          const fallbackUser = await memStorage.getUser(userId);
          if (!fallbackUser) {
            return sendError(res, 'Пользователь не найден', 404);
          }
        }
        
        // Получаем информацию о пригласителе из сервиса
        const inviter = await referralService.getUserInviter(userId);
        
        if (inviter) {
          // Получаем данные о пользователе-пригласителе
          let inviterUser = null;
          if (inviter.inviter_id !== null && typeof inviter.inviter_id === 'number') {
            inviterUser = await userService.getUserById(inviter.inviter_id);
          }
          
          // Формируем ответ с информацией о пригласителе
          const response = {
            user_id: userId,
            inviter_id: inviter.inviter_id,
            inviter_username: inviterUser?.username || null,
            level: inviter.level || 1,
            created_at: inviter.created_at || new Date()
          };
          
          // Отправляем успешный ответ
          sendSuccess(res, response);
        } else {
          // Используем fallback для поиска пригласителя
          await ReferralController._getUserInviterWithFallback(req, res, next);
        }
      } catch (error) {
        console.error('[ReferralController] Ошибка при получении данных о пригласителе:', error);
        
        // Используем fallback для поиска пригласителя
        await ReferralController._getUserInviterWithFallback(req, res, next);
      }
    } catch (error) {
      console.error('[ReferralController] Критическая ошибка при получении пригласителя:', error);
      
      if (next) {
        next(error);
      } else {
        sendServerError(res, 'Критическая ошибка при получении данных о пригласителе');
      }
    }
  }
  
  /**
   * Fallback метод для получения данных о пригласителе
   * @private
   */
  private static async _getUserInviterWithFallback(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      // Получаем ID пользователя из запроса
      const userIdRaw = extractUserId(req);
      
      // Проверяем, что userID - валидное положительное число
      if (!userIdRaw || isNaN(userIdRaw) || userIdRaw <= 0) {
        console.log('[ReferralController] Fallback: Некорректный userId в запросе на получение пригласителя:', userIdRaw);
        return sendError(res, 'Некорректный идентификатор пользователя', 400);
      }
      
      const userId = Number(userIdRaw);
      console.log(`[ReferralController] Fallback: Запрос данных о пригласителе для пользователя: ${userId}`);
      
      try {
        // Проверяем существование пользователя в MemStorage
        const user = await memStorage.getUser(userId);
        if (!user) {
          console.log(`[ReferralController] Fallback: Пользователь с ID ${userId} не найден в MemStorage`);
          return sendError(res, 'Пользователь не найден', 404);
        }
        
        // Получаем информацию о пригласителе из parent_ref_code
        if (!user.parent_ref_code) {
          console.log(`[ReferralController] Fallback: У пользователя ${userId} нет parent_ref_code`);
          return sendError(res, 'Пригласитель не найден', 404);
        }
        
        // Ищем пользователя с ref_code, равным parent_ref_code целевого пользователя
        const inviterUser = await memStorage.getUserByRefCode(user.parent_ref_code);
        
        if (!inviterUser) {
          console.log(`[ReferralController] Fallback: Пригласитель с ref_code ${user.parent_ref_code} не найден`);
          return sendError(res, 'Пригласитель не найден', 404);
        }
        
        // Формируем ответ с информацией о пригласителе
        const response = {
          user_id: userId,
          inviter_id: inviterUser.id,
          inviter_username: inviterUser.username || null,
          level: 1, // В fallback режиме всегда 1 уровень
          created_at: user.created_at || new Date(),
          is_fallback: true,
          message: 'Данные получены из резервного хранилища'
        };
        
        // Отправляем успешный ответ
        sendSuccess(res, response);
      } catch (error) {
        console.error('[ReferralController] Fallback: Ошибка при получении данных о пригласителе:', error);
        
        if (next) {
          next(error);
        } else {
          sendServerError(res, 'Ошибка при получении данных о пригласителе');
        }
      }
    } catch (error) {
      console.error('[ReferralController] Fallback: Критическая ошибка при получении пригласителя:', error);
      
      if (next) {
        next(error);
      } else {
        sendServerError(res, 'Критическая ошибка при получении данных о пригласителе');
      }
    }
  }

  /**
   * Применяет реферальный код для пользователя
   * КРИТИЧЕСКИ ВАЖНЫЙ МЕТОД ПО REDMAP
   * @route POST /api/v2/referrals/apply
   */
  static async applyReferralCode(req: Request, res: Response, next?: NextFunction): Promise<void> {
    try {
      const { user_id, referral_code } = req.body;
      
      // Валидация входных данных
      if (!user_id || !referral_code) {
        return sendError(res, 'user_id и referral_code обязательны', 400);
      }

      const userId = Number(user_id);
      if (isNaN(userId) || userId <= 0) {
        return sendError(res, 'Некорректный user_id', 400);
      }

      console.log(`[ReferralController] Применение реферального кода ${referral_code} для пользователя ${userId}`);

      try {
        // Находим пользователя-пригласителя по реферальному коду
        const inviterUser = await userService.getUserByRefCode(referral_code);
        
        if (!inviterUser) {
          return sendError(res, 'Реферальный код не найден', 404);
        }

        // Проверяем, что пользователь не пытается применить свой собственный код
        if (inviterUser.id === userId) {
          return sendError(res, 'Нельзя применить собственный реферальный код', 400);
        }

        // Проверяем, что у пользователя еще нет пригласителя
        const currentUser = await userService.getUserById(userId);
        if (currentUser && currentUser.parent_ref_code) {
          return sendError(res, 'У пользователя уже есть пригласитель', 400);
        }

        // Создаем реферальную связь согласно REDMAP (20 уровней)
        const referralResult = await referralService.createReferralConnection(userId, inviterUser.id, referral_code);
        
        const result = {
          success: true,
          user_id: userId,
          inviter_id: inviterUser.id,
          referral_code: referral_code,
          connection_created: true,
          message: 'Реферальный код успешно применен'
        };

        console.log(`[ReferralController] Реферальная связь создана: ${userId} → ${inviterUser.id}`);
        return sendSuccess(res, result);

      } catch (error) {
        console.error('[ReferralController] Ошибка при применении реферального кода:', error);
        
        // Fallback режим для применения реферального кода
        try {
          const fallbackResult = {
            success: true,
            user_id: userId,
            referral_code: referral_code,
            connection_created: false,
            is_fallback: true,
            message: 'Реферальный код принят в режиме fallback'
          };
          
          console.log(`[ReferralController] Fallback: Реферальный код ${referral_code} принят для пользователя ${userId}`);
          return sendSuccess(res, fallbackResult);
        } catch (fallbackError) {
          console.error('[ReferralController] Fallback: Ошибка при применении реферального кода:', fallbackError);
          return sendError(res, 'Ошибка при применении реферального кода', 500);
        }
      }

    } catch (error) {
      console.error('[ReferralController] Критическая ошибка в applyReferralCode:', error);
      
      if (next) {
        next(error);
      } else {
        return sendError(res, 'Внутренняя ошибка сервера', 500);
      }
    }
  }
}