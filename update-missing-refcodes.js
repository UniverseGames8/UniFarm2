/**
 * Миграционный скрипт для обновления всех пользователей без реферальных кодов
 * 
 * Этот скрипт находит всех пользователей без ref_code и генерирует для них
 * уникальные реферальные коды. Рекомендуется запускать после обновления кода
 * для устранения возможных проблем с существующими пользователями.
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import crypto from 'crypto';
import * as dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

// Настройка WebSocket для Neon DB
neonConfig.webSocketConstructor = ws;

// Проверяем наличие URL базы данных
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL не указан в переменных окружения');
  process.exit(1);
}

// Создаем клиент Postgres
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Функция для генерации реферального кода
function generateRefCode() {
  // Набор символов, из которых будет формироваться реферальный код
  // Исключаем символы, которые могут быть неоднозначно восприняты: 0, O, 1, I, l
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  
  // Генерируем 8 символов - компромисс между длиной и надежностью
  const length = 8;
  
  // Используем crypto.randomBytes для криптографически стойкой генерации
  const randomBytes = crypto.randomBytes(length);
  
  // Преобразуем байты в символы из нашего набора
  let refCode = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = randomBytes[i] % chars.length;
    refCode += chars[randomIndex];
  }
  
  return refCode;
}

// Функция для проверки уникальности реферального кода
async function isRefCodeUnique(refCode) {
  const result = await pool.query(
    'SELECT id FROM users WHERE ref_code = $1 LIMIT 1',
    [refCode]
  );
  
  return result.rows.length === 0;
}

// Функция для генерации уникального реферального кода
async function generateUniqueRefCode() {
  // Максимальное количество попыток для предотвращения бесконечного цикла
  const maxAttempts = 10;
  let attempts = 0;
  let refCode;
  let isUnique = false;
  
  while (!isUnique && attempts < maxAttempts) {
    refCode = generateRefCode();
    isUnique = await isRefCodeUnique(refCode);
    attempts++;
    
    if (!isUnique) {
      console.log(`Сгенерированный код ${refCode} уже существует. Попытка ${attempts}/${maxAttempts}`);
    }
  }
  
  if (!isUnique) {
    throw new Error('Не удалось сгенерировать уникальный реферальный код после нескольких попыток');
  }
  
  return refCode;
}

// Функция для обновления пользователя с новым реферальным кодом
async function updateUserRefCode(userId, refCode) {
  try {
    const result = await pool.query(
      'UPDATE users SET ref_code = $1 WHERE id = $2 RETURNING *',
      [refCode, userId]
    );
    
    return result.rows[0];
  } catch (error) {
    console.error(`Ошибка при обновлении пользователя ${userId}:`, error);
    return null;
  }
}

// Основная функция для обновления пользователей без реферальных кодов
async function updateUsersWithMissingRefCodes() {
  console.log('Запуск миграции для обновления пользователей без реферальных кодов...');
  
  try {
    // Получаем всех пользователей без ref_code или с пустым ref_code
    const { rows: usersWithoutRefCode } = await pool.query(
      'SELECT id, username, guest_id, telegram_id FROM users WHERE ref_code IS NULL OR ref_code = \'\' ORDER BY id'
    );
    
    console.log(`Найдено ${usersWithoutRefCode.length} пользователей без реферальных кодов.`);
    
    if (usersWithoutRefCode.length === 0) {
      console.log('Нет пользователей для обновления. Все пользователи уже имеют реферальные коды.');
      return {
        success: true,
        updated: 0,
        total: 0,
        message: 'Нет пользователей для обновления'
      };
    }
    
    // Счетчики для статистики
    let successCount = 0;
    let errorCount = 0;
    
    // Обновляем каждого пользователя
    for (const user of usersWithoutRefCode) {
      try {
        // Генерируем уникальный реферальный код
        const refCode = await generateUniqueRefCode();
        console.log(`Сгенерирован код ${refCode} для пользователя ID=${user.id}, username=${user.username || 'не указан'}`);
        
        // Обновляем пользователя
        const updatedUser = await updateUserRefCode(user.id, refCode);
        
        if (updatedUser) {
          console.log(`✅ Успешно обновлен пользователь ID=${user.id} с новым кодом ${refCode}`);
          successCount++;
        } else {
          console.error(`❌ Не удалось обновить пользователя ID=${user.id}`);
          errorCount++;
        }
      } catch (err) {
        console.error(`Ошибка при обновлении пользователя ID=${user.id}:`, err);
        errorCount++;
      }
    }
    
    console.log('Миграция завершена.');
    console.log(`Итоги: успешно обновлено ${successCount} из ${usersWithoutRefCode.length} пользователей.`);
    
    if (errorCount > 0) {
      console.log(`⚠️ ${errorCount} пользователей не удалось обновить.`);
    }
    
    return {
      success: true,
      updated: successCount,
      failed: errorCount,
      total: usersWithoutRefCode.length,
      message: `Успешно обновлено ${successCount} из ${usersWithoutRefCode.length} пользователей.`
    };
  } catch (error) {
    console.error('Ошибка при выполнении миграции:', error);
    return {
      success: false,
      error: error.message,
      message: 'Не удалось выполнить миграцию'
    };
  } finally {
    // Закрываем соединение с базой данных
    await pool.end();
  }
}

// Запускаем миграцию
updateUsersWithMissingRefCodes()
  .then(result => {
    console.log('Результат миграции:', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('Критическая ошибка при выполнении миграции:', error);
    process.exit(1);
  });