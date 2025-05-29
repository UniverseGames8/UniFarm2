import { z } from 'zod';
import { 
  insertUserSchema, 
  insertTransactionSchema, 
  insertFarmingDepositSchema 
} from '@shared/schema';

/**
 * Схемы валидации запросов API
 */

// Схема для получения пользователя по ID с поддержкой как числовых, так и строковых значений
export const userIdSchema = z.object({
  user_id: z.union([
    z.string().refine(val => !isNaN(parseInt(val)) && parseInt(val) > 0, {
      message: 'ID пользователя должен быть положительным числом'
    }),
    z.number().int().positive({
      message: 'ID пользователя должен быть положительным числом'
    })
  ]).transform(val => typeof val === 'string' ? parseInt(val) : val)
});

// Схема для получения пользователя по guest_id
export const guestIdSchema = z.object({
  guest_id: z.string().min(1, {
    message: 'guest_id должен быть непустой строкой'
  })
});

// Схема для валидации данных баланса
export const userBalanceSchema = z.object({
  balance_uni: z.string().optional(),
  balance_ton: z.string().optional()
});

// Схема для валидации данных при обновлении пользователя
export const updateUserSchema = z.object({
  user_id: z.number().int().positive({
    message: 'ID пользователя должен быть положительным числом'
  }),
  data: z.object({
    username: z.string().min(3).optional(),
    ref_code: z.string().min(6).optional(),
    wallet_address: z.string().optional(),
    telegram_id: z.number().int().nullable().optional(),
    balance_uni: z.string().optional(),
    balance_ton: z.string().optional(),
    guest_id: z.string().optional(),
    parent_id: z.number().int().nullable().optional(),
    parent_ref_code: z.string().nullable().optional()
  })
});

// Схема для валидации запроса на получение пользователя по ID
export const getUserParamsSchema = z.object({
  id: z.string().refine(val => !isNaN(parseInt(val)) && parseInt(val) > 0, {
    message: 'ID должен быть положительным числом'
  })
});

// Схема для валидации запроса на получение транзакций
export const getTransactionsQuerySchema = z.object({
  user_id: z.string().refine(val => !isNaN(parseInt(val)) && parseInt(val) > 0, {
    message: 'user_id должен быть положительным числом'
  })
});

// Схема для валидации запроса на завершение миссии
export const completeMissionSchema = z.object({
  user_id: z.number().int().positive({
    message: 'ID пользователя должен быть положительным числом'
  }),
  mission_id: z.number().int().positive({
    message: 'ID миссии должен быть положительным числом'
  })
});

// Схема для валидации запроса на получение выполненных миссий
export const userMissionsQuerySchema = z.object({
  user_id: z.union([
    z.string().refine(val => !isNaN(parseInt(val)) && parseInt(val) > 0, {
      message: 'ID пользователя должен быть положительным числом'
    }),
    z.number().int().positive({
      message: 'ID пользователя должен быть положительным числом'
    })
  ]).transform(val => typeof val === 'string' ? parseInt(val) : val)
});

// Схема для валидации запроса на получение миссий со статусом выполнения
export const userMissionsWithCompletionSchema = z.object({
  user_id: z.union([
    z.string().refine(val => !isNaN(parseInt(val)) && parseInt(val) > 0, {
      message: 'ID пользователя должен быть положительным числом'
    }),
    z.number().int().positive({
      message: 'ID пользователя должен быть положительным числом'
    })
  ]).transform(val => typeof val === 'string' ? parseInt(val) : val)
});

// Схема для валидации запроса на депозит
export const depositSchema = z.object({
  user_id: z.number().int().positive(),
  amount: z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: 'Сумма должна быть положительным числом'
  }),
  package_id: z.number().int().nonnegative().optional(),
});

// Схема для валидации запроса на депозит фарминга
export const depositFarmingRequestSchema = z.object({
  user_id: z.number().int().positive({
    message: 'ID пользователя должен быть положительным числом'
  }),
  amount: z.union([
    z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
      message: 'Сумма должна быть положительным числом'
    }),
    z.number().positive({
      message: 'Сумма должна быть положительным числом'
    })
  ])
});

// Валидация TON-адреса с помощью регулярного выражения
const tonAddressPattern = /^(?:UQ|EQ)[A-Za-z0-9_-]{46,48}$/;

// Схема для валидации запроса на вывод средств
export const withdrawSchema = z.object({
  user_id: z.number().int().positive({
    message: 'ID пользователя должен быть положительным числом'
  }),
  amount: z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: 'Сумма должна быть положительным числом'
  }),
  currency: z.enum(['UNI', 'TON'], {
    errorMap: () => ({ message: 'Валюта должна быть UNI или TON' })
  }),
  wallet_address: z.string().regex(tonAddressPattern, {
    message: 'Адрес TON-кошелька должен начинаться с UQ или EQ и содержать 48-50 символов'
  }).optional(),
});

// Схема для валидации привязки кошелька
export const walletBindSchema = z.object({
  user_id: z.number().int().positive({
    message: 'ID пользователя должен быть положительным числом'
  }),
  wallet_address: z.string().regex(tonAddressPattern, {
    message: 'Адрес TON-кошелька должен начинаться с UQ или EQ и содержать 48-50 символов'
  }),
});

// Схема для валидации запроса на получение истории кошелька
export const walletHistorySchema = z.object({
  user_id: z.number().int().positive({
    message: 'ID пользователя должен быть положительным числом'
  }),
  limit: z.number().int().min(1).max(100).optional(),
});

// Расширяем схемы из shared/schema.ts для конкретных запросов API
export const createUserSchema = insertUserSchema.extend({
  // Можно добавить дополнительные поля или валидацию
});

export const createTransactionSchema = insertTransactionSchema.extend({
  // Можно добавить дополнительные поля или валидацию
});

export const createFarmingDepositSchema = insertFarmingDepositSchema.extend({
  // Можно добавить дополнительные поля или валидацию
});

// Схема для регистрации гостевого пользователя
export const guestRegistrationSchema = z.object({
  guest_id: z.string().min(1, {
    message: 'guest_id должен быть непустой строкой'
  }),
  referrer_code: z.string().nullable().optional(),
  airdrop_mode: z.boolean().optional()
});

// Схемы для валидации запросов к API буст-пакетов
export const boostIdParamSchema = z.object({
  boost_id: z.number().int().positive({
    message: 'ID буст-пакета должен быть положительным числом'
  })
});

export const boostRequestSchema = z.object({
  user_id: z.number().int().positive({
    message: 'ID пользователя должен быть положительным числом'
  }),
  boost_id: z.number().int().positive({
    message: 'ID буст-пакета должен быть положительным числом'
  })
});

export const boostUserQuerySchema = z.object({
  user_id: z.union([
    z.string().refine(val => !isNaN(parseInt(val)) && parseInt(val) > 0, {
      message: 'ID пользователя должен быть положительным числом'
    }),
    z.number().int().positive({
      message: 'ID пользователя должен быть положительным числом'
    })
  ]).transform(val => typeof val === 'string' ? parseInt(val) : val)
});

// Схема для валидации запроса на получение статуса миссии
export const missionStatusSchema = z.object({
  userId: z.coerce.string().refine((val) => !isNaN(parseInt(val)) && parseInt(val) > 0, {
    message: 'ID пользователя должен быть положительным числом'
  }),
  missionId: z.coerce.string().refine((val) => !isNaN(parseInt(val)) && parseInt(val) > 0, {
    message: 'ID миссии должен быть положительным числом'
  })
});

// Схема для валидации запроса на отправку миссии на проверку
export const submitMissionSchema = z.object({
  user_id: z.number().int().positive({
    message: 'ID пользователя должен быть положительным числом'
  }),
  mission_id: z.number().int().positive({
    message: 'ID миссии должен быть положительным числом'
  })
});