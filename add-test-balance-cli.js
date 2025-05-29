/**
 * Скрипт для добавления тестовых средств пользователю
 */
const { Pool } = require('@neondatabase/serverless');
require('dotenv').config();

// ID пользователя для тестирования и сумма для добавления
const userId = 34;
const amountToAdd = 100; // 100 UNI

/**
 * Добавляет тестовые средства пользователю
 */
async function addTestBalance() {
  // Создаем подключение к базе данных
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log(`Добавление ${amountToAdd} UNI пользователю ID: ${userId}...`);
    
    // Получаем текущий баланс пользователя
    const userResult = await pool.query(
      'SELECT id, username, balance_uni FROM users WHERE id = $1',
      [userId]
    );
      
    if (userResult.rows.length === 0) {
      console.error(`Пользователь с ID ${userId} не найден!`);
      return;
    }
    
    const user = userResult.rows[0];
    console.log(`Текущий баланс пользователя ${user.username}: ${user.balance_uni} UNI`);
    
    // Преобразуем текущий баланс в число
    const currentBalance = parseFloat(user.balance_uni);
    // Вычисляем новый баланс
    const newBalance = currentBalance + amountToAdd;
    
    // Обновляем баланс пользователя
    await pool.query(
      'UPDATE users SET balance_uni = $1 WHERE id = $2',
      [newBalance.toFixed(6), userId]
    );
      
    console.log(`Баланс успешно обновлен на ${newBalance.toFixed(6)} UNI`);
    
    // Проверяем обновленный баланс
    const updatedUserResult = await pool.query(
      'SELECT id, username, balance_uni FROM users WHERE id = $1',
      [userId]
    );
    
    const updatedUser = updatedUserResult.rows[0];
    console.log(`Проверка: новый баланс пользователя ${updatedUser.username}: ${updatedUser.balance_uni} UNI`);
    
  } catch (error) {
    console.error('Ошибка при добавлении тестовых средств:', error);
  } finally {
    // Закрываем соединение с базой данных
    await pool.end();
    process.exit(0);
  }
}

// Запускаем функцию
addTestBalance();