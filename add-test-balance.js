/**
 * Скрипт для добавления тестовых средств пользователю
 */
import { db } from './server/db.js';
import { eq } from 'drizzle-orm';
import { users } from './shared/schema.js';

// ID пользователя для тестирования и сумма для добавления
const userId = 34;
const amountToAdd = 100; // 100 UNI

/**
 * Добавляет тестовые средства пользователю
 */
async function addTestBalance() {
  try {
    console.log(`Добавление ${amountToAdd} UNI пользователю ID: ${userId}...`);
    
    // Получаем текущий баланс пользователя
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, userId));
      
    if (!user) {
      console.error(`Пользователь с ID ${userId} не найден!`);
      return;
    }
    
    console.log(`Текущий баланс пользователя: ${user.balance_uni} UNI`);
    
    // Преобразуем текущий баланс в число
    const currentBalance = parseFloat(user.balance_uni);
    // Вычисляем новый баланс
    const newBalance = currentBalance + amountToAdd;
    
    // Обновляем баланс пользователя
    await db.update(users)
      .set({ balance_uni: newBalance.toFixed(6) })
      .where(eq(users.id, userId));
      
    console.log(`Баланс успешно обновлен на ${newBalance.toFixed(6)} UNI`);
    
    // Проверяем обновленный баланс
    const [updatedUser] = await db.select()
      .from(users)
      .where(eq(users.id, userId));
      
    console.log(`Проверка: новый баланс пользователя: ${updatedUser.balance_uni} UNI`);
    
  } catch (error) {
    console.error('Ошибка при добавлении тестовых средств:', error);
  } finally {
    // Закрываем соединение с базой данных
    await db.end?.();
    process.exit(0);
  }
}

// Запускаем функцию
addTestBalance();