/**
 * Миграционный скрипт для стандартизации реферальных кодов
 * 
 * Этот скрипт находит все реферальные коды не стандартной длины (не 8 символов)
 * и заменяет их на новые стандартные коды
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

// Стандартная длина реферального кода
const STANDARD_LENGTH = 8;

// Создаем клиент Postgres
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Функция для генерации реферального кода
function generateRefCode() {
  // Набор символов, из которых будет формироваться реферальный код
  // Исключаем символы, которые могут быть неоднозначно восприняты: 0, O, 1, I, l
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  
  // Генерируем 8 символов - компромисс между длиной и надежностью
  const length = STANDARD_LENGTH;
  
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

// Основная функция для стандартизации реферальных кодов
async function standardizeRefCodes() {
  console.log('Запуск миграции для стандартизации реферальных кодов...');
  console.log(`Стандартная длина кода: ${STANDARD_LENGTH} символов`);
  
  try {
    // Получаем всех пользователей с нестандартными реферальными кодами
    const { rows: usersWithNonStandardCodes } = await pool.query(
      `SELECT id, username, guest_id, telegram_id, ref_code, LENGTH(ref_code) as code_length 
       FROM users 
       WHERE ref_code IS NOT NULL AND LENGTH(ref_code) != $1
       ORDER BY id`,
      [STANDARD_LENGTH]
    );
    
    console.log(`Найдено ${usersWithNonStandardCodes.length} пользователей с нестандартными реферальными кодами.`);
    
    if (usersWithNonStandardCodes.length === 0) {
      console.log('Нет пользователей для обновления. Все пользователи уже имеют стандартные реферальные коды.');
      return {
        success: true,
        updated: 0,
        total: 0,
        message: 'Нет пользователей для обновления'
      };
    }
    
    // Выводим пользователей с нестандартными кодами
    console.log('\nПользователи с нестандартными кодами:');
    usersWithNonStandardCodes.forEach(user => {
      console.log(`  ID: ${user.id}, Username: ${user.username}, Код: ${user.ref_code} (${user.code_length} символов)`);
    });
    
    // Запрос на подтверждение обновления
    console.log('\nВнимание! Этот скрипт обновит все нестандартные реферальные коды.');
    console.log('Старые ссылки перестанут работать. Продолжить? (y/n)');
    
    // Автоматически продолжаем для нашей задачи
    console.log('Автоматически выбрано: y');
    
    // Счетчики для статистики
    let successCount = 0;
    let errorCount = 0;
    
    // Обновляем каждого пользователя
    console.log('\nНачинаем обновление кодов...');
    
    for (const user of usersWithNonStandardCodes) {
      try {
        // Генерируем уникальный реферальный код
        const newRefCode = await generateUniqueRefCode();
        console.log(`Сгенерирован новый код ${newRefCode} для пользователя ID=${user.id}, старый код: ${user.ref_code}`);
        
        // Обновляем пользователя
        const updatedUser = await updateUserRefCode(user.id, newRefCode);
        
        if (updatedUser) {
          console.log(`✅ Успешно обновлен пользователь ID=${user.id} с новым кодом ${newRefCode}`);
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
    
    console.log('\nМиграция завершена.');
    console.log(`Итоги: успешно обновлено ${successCount} из ${usersWithNonStandardCodes.length} пользователей.`);
    
    if (errorCount > 0) {
      console.log(`⚠️ ${errorCount} пользователей не удалось обновить.`);
    }
    
    return {
      success: true,
      updated: successCount,
      failed: errorCount,
      total: usersWithNonStandardCodes.length,
      message: `Успешно стандартизировано ${successCount} из ${usersWithNonStandardCodes.length} реферальных кодов.`
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
standardizeRefCodes()
  .then(result => {
    console.log('Результат миграции:', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('Критическая ошибка при выполнении миграции:', error);
    process.exit(1);
  });