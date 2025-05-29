import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

/**
 * Валидирует входные данные запроса с помощью Zod-схемы
 * 
 * @param schema Zod-схема для валидации
 * @param source Источник данных ('body', 'query', 'params')
 */
export function validateRequest(schema: z.ZodType<any>, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req[source]);
      
      if (!result.success) {
        console.error(`[Validation] Ошибка валидации ${source}:`, result.error.format());
        return res.status(400).json({
          success: false,
          message: "Некорректные параметры запроса",
          errors: result.error.format()
        });
      }
      
      // Обновляем объект req данными после валидации и преобразования
      req[source] = result.data;
      next();
    } catch (error) {
      console.error(`[Validation] Неожиданная ошибка валидации:`, error);
      return res.status(500).json({
        success: false,
        message: "Внутренняя ошибка валидации"
      });
    }
  };
}

/**
 * Валидатор для числовых значений user_id
 */
export const userIdValidator = z.object({
  user_id: z.number().int().positive("ID пользователя должен быть положительным числом")
});

/**
 * Валидатор для ID пользователя, переданного в строке запроса
 */
export const userIdQueryValidator = z.object({
  user_id: z.string()
    .refine(val => !isNaN(parseInt(val)), {
      message: "user_id должен быть числом"
    })
    .transform(val => parseInt(val))
    .refine(val => val > 0, {
      message: "user_id должен быть положительным числом"
    })
});

/**
 * Валидатор guest_id
 */
export const guestIdValidator = z.object({
  guest_id: z.string().min(1, "guest_id не может быть пустым")
});

/**
 * Валидатор ref_code
 */
export const refCodeValidator = z.object({
  ref_code: z.string().min(4, "Реферальный код должен содержать минимум 4 символа")
});

/**
 * Валидатор для денежных операций (проверка положительных сумм)
 */
export const amountValidator = z.object({
  amount: z.union([
    z.string().refine(val => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    }, { message: "Сумма должна быть положительным числом" })
      .transform(val => parseFloat(val)),
    z.number().positive("Сумма должна быть положительным числом")
  ])
});

/**
 * Валидатор для адреса TON-кошелька
 */
export const tonAddressValidator = z.object({
  wallet_address: z.string()
    .min(1, "Адрес кошелька не может быть пустым")
    .refine(val => /^(?:UQ|EQ)[A-Za-z0-9_-]{46,48}$/.test(val), {
      message: "Некорректный формат TON-адреса"
    })
});

/**
 * Валидатор для параметров пагинации
 */
export const paginationValidator = z.object({
  limit: z.string()
    .optional()
    .transform(val => (val === undefined ? 20 : parseInt(val)))
    .refine(val => !isNaN(val) && val > 0 && val <= 100, {
      message: "limit должен быть числом от 1 до 100"
    }),
  offset: z.string()
    .optional()
    .transform(val => (val === undefined ? 0 : parseInt(val)))
    .refine(val => !isNaN(val) && val >= 0, {
      message: "offset должен быть неотрицательным числом"
    })
});

/**
 * Валидатор параметров транзакции
 */
export const transactionValidator = z.object({
  user_id: z.number().int().positive("ID пользователя должен быть положительным числом"),
  amount: z.union([
    z.string().refine(val => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    }, { message: "Сумма должна быть положительным числом" })
      .transform(val => parseFloat(val)),
    z.number().positive("Сумма должна быть положительным числом")
  ]),
  currency: z.string()
    .min(1, "Валюта должна быть указана")
    .refine(val => ['UNI', 'TON'].includes(val.toUpperCase()), { 
      message: "Валюта должна быть UNI или TON" 
    })
    .transform(val => val.toUpperCase()),
  address: z.string()
    .min(1, "Адрес кошелька должен быть указан")
    .refine(val => /^(?:UQ|EQ)[A-Za-z0-9_-]{46,48}$/.test(val), {
      message: "Некорректный формат TON-адреса"
    })
});

/**
 * Валидатор для депозита в UNI-фарминг
 */
export const uniFarmingDepositValidator = z.object({
  user_id: z.number().int().positive("ID пользователя должен быть положительным числом"),
  amount: z.union([
    z.string().refine(val => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    }, { message: "Сумма депозита должна быть положительным числом" })
      .transform(val => parseFloat(val)),
    z.number().positive("Сумма депозита должна быть положительным числом")
  ])
});