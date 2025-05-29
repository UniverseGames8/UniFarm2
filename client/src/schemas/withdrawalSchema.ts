import { z } from "zod";

/**
 * Схема валидации для формы вывода средств
 * Включает проверки для суммы, типа токена и адреса кошелька
 */
export const withdrawalSchema = z.object({
  // ID пользователя - будет добавлен автоматически из контекста
  // user_id: z.number().int().positive(),
  
  // Сумма для вывода - может быть строкой или числом, но должна быть положительным числом
  amount: z.union([
    z.string().min(1, "Сумма должна быть указана").refine(
      (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
      { message: "Сумма должна быть положительным числом" }
    ),
    z.number().positive("Сумма должна быть положительным числом")
  ]),
  
  // Тип токена - только UNI или TON
  currency: z.enum(["UNI", "TON"], {
    errorMap: () => ({ message: "Валюта должна быть UNI или TON" })
  }),
  
  // Адрес кошелька - требуется только для TON, проверка на формат
  wallet_address: z.string().min(1, "Адрес кошелька должен быть указан").refine(
    (val) => {
      // Для TON-адреса проверяем формат (EQ... или UQ...)
      // В упрощенном виде - начинается с EQ или UQ и содержит 46-48 символов
      const tonAddressRegex = /^(?:UQ|EQ)[A-Za-z0-9_-]{46,48}$/;
      return tonAddressRegex.test(val);
    },
    { message: "Некорректный формат TON-адреса" }
  ),
});

/**
 * Расширенная схема с проверкой баланса
 * @param balance Текущий баланс пользователя для проверки
 * @param currency Валюта для проверки
 * @returns Схема валидации с дополнительными проверками
 */
export const createWithdrawalSchema = (balance: number, currency: "UNI" | "TON") => {
  return withdrawalSchema.refine(
    (data) => {
      const amount = typeof data.amount === "string" 
        ? parseFloat(data.amount) 
        : data.amount;
      
      // Проверяем, что сумма не превышает доступный баланс
      return data.currency === currency && amount <= balance;
    },
    {
      message: `Недостаточно средств на балансе. Доступно: ${balance} ${currency}`,
      path: ["amount"],
    }
  );
};

/**
 * Тип данных формы вывода, выведенный из схемы
 */
export type WithdrawalFormData = z.infer<typeof withdrawalSchema>;