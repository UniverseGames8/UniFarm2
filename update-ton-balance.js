/**
 * Скрипт для добавления тестовых средств TON на баланс пользователя
 * 
 * Использование: node update-ton-balance.js <user_id> <amount>
 * Пример: node update-ton-balance.js 1 100
 */

import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;
dotenv.config();

// Пользователь и сумма из аргументов командной строки или значения по умолчанию
const userId = 1;
const amountToAdd = 100;

/**
 * Добавляет тестовые TON на баланс пользователя
 */
async function addTestTonBalance() {
  // Создаем подключение к базе данных
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log(`Добавление ${amountToAdd} TON пользователю ID: ${userId}...`);
    
    // Получаем текущий баланс пользователя
    const userResult = await pool.query(
      'SELECT id, username, balance_ton FROM users WHERE id = $1',
      [userId]
    );
      
    if (userResult.rows.length === 0) {
      console.error(`Пользователь с ID ${userId} не найден!`);
      return;
    }
    
    const user = userResult.rows[0];
    console.log(`Текущий TON баланс пользователя ${user.username || userId}: ${user.balance_ton} TON`);
    
    // Преобразуем текущий баланс в число
    const currentBalance = parseFloat(user.balance_ton || 0);
    // Вычисляем новый баланс
    const newBalance = currentBalance + amountToAdd;
    
    // Обновляем баланс пользователя
    await pool.query(
      'UPDATE users SET balance_ton = $1 WHERE id = $2',
      [newBalance.toFixed(6), userId]
    );
      
    console.log(`Баланс успешно обновлен на ${newBalance.toFixed(6)} TON`);
    
    // Добавляем транзакцию о пополнении баланса для тестирования
    await pool.query(
      `INSERT INTO transactions
       (user_id, type, amount, currency, status, source, category, description, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        userId,
        'deposit',
        amountToAdd.toFixed(6),
        'TON',
        'confirmed',
        'test',
        'test',
        'Тестовое пополнение TON баланса'
      ]
    );
    
    console.log('Создана транзакция о пополнении баланса');
    
    // Проверяем обновленный баланс
    const updatedUserResult = await pool.query(
      'SELECT balance_ton FROM users WHERE id = $1',
      [userId]
    );
    
    const updatedUser = updatedUserResult.rows[0];
    console.log(`Проверка: новый баланс пользователя: ${updatedUser.balance_ton} TON`);
    
  } catch (error) {
    console.error('Ошибка при добавлении тестового баланса:', error);
  } finally {
    await pool.end();
  }
}

// Запускаем функцию
addTestTonBalance().catch(console.error);

// Необходимо для ES модулей
export {};