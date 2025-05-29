/**
 * Скрипт для тестирования соединения к базе данных
 * 
 * Этот скрипт выполняет непрерывную проверку соединения с базой данных
 * и записывает результаты в лог. Он позволяет мониторить стабильность
 * соединения на протяжении длительного времени.
 * 
 * Запуск: node db-health-check.js
 * 
 * Для завершения: Ctrl+C
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

// Настраиваем конфигурацию подключения к базе данных
const poolConfig = process.env.DATABASE_URL
  ? { 
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      },
      max: 5,
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 10000
    }
  : {
      host: process.env.PGHOST || 'localhost',
      port: parseInt(process.env.PGPORT || '5432'),
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || '',
      database: process.env.PGDATABASE || 'postgres',
      max: 5,
      idleTimeoutMillis: 60000, 
      connectionTimeoutMillis: 10000
    };

// Файл для записи результатов мониторинга
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logFile = path.join(__dirname, 'db-health-check.log');

// Создаем пул подключений
let pool = new pg.Pool(poolConfig);

// Настраиваем обработчик ошибок соединения
pool.on('error', (err) => {
  console.error(`[${new Date().toISOString()}] ❌ Ошибка пула подключений:`, err.message);
  logToFile(`ERROR: ${err.message}`);
});

// Функция для записи в лог-файл
function logToFile(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp}: ${message}\n`;
  
  fs.appendFile(logFile, logMessage, (err) => {
    if (err) {
      console.error('Ошибка при записи в лог-файл:', err);
    }
  });
}

// Функция проверки соединения
async function checkConnection() {
  let client = null;
  const startTime = Date.now();
  
  try {
    // Получаем клиент из пула
    client = await pool.connect();
    
    // Выполняем простой запрос
    const result = await client.query('SELECT NOW() as current_time');
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    console.log(`[${new Date().toISOString()}] ✅ Соединение работает, время ответа: ${responseTime}ms, время сервера: ${result.rows[0].current_time}`);
    logToFile(`SUCCESS: Response time ${responseTime}ms, server time: ${result.rows[0].current_time}`);
    
    return true;
  } catch (error) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    console.error(`[${new Date().toISOString()}] ❌ Ошибка соединения: ${error.message}, время: ${responseTime}ms`);
    logToFile(`FAIL: ${error.message}, time: ${responseTime}ms`);
    
    return false;
  } finally {
    // Освобождаем клиент
    if (client) {
      try {
        client.release();
      } catch (releaseError) {
        console.error(`[${new Date().toISOString()}] Ошибка при освобождении клиента:`, releaseError.message);
      }
    }
  }
}

// Запускаем непрерывный мониторинг
async function runContinuousMonitoring() {
  console.log(`[${new Date().toISOString()}] 🔄 Запуск непрерывного мониторинга соединения с базой данных`);
  console.log(`[${new Date().toISOString()}] 📝 Результаты будут записаны в файл: ${logFile}`);
  logToFile('START: Начало мониторинга соединения с базой данных');
  
  let consecutiveFailures = 0;
  let totalChecks = 0;
  let successfulChecks = 0;
  
  // Функция для вывода статистики
  function printStats() {
    const successRate = totalChecks > 0 ? (successfulChecks / totalChecks * 100).toFixed(2) : 0;
    console.log(`[${new Date().toISOString()}] 📊 Статистика: ${successfulChecks}/${totalChecks} успешных проверок (${successRate}%)`);
  }
  
  try {
    while (true) {
      totalChecks++;
      const isConnected = await checkConnection();
      
      if (isConnected) {
        successfulChecks++;
        consecutiveFailures = 0;
      } else {
        consecutiveFailures++;
        
        // При нескольких последовательных ошибках пытаемся пересоздать пул
        if (consecutiveFailures >= 3) {
          console.log(`[${new Date().toISOString()}] 🔄 Обнаружено ${consecutiveFailures} последовательных ошибок, пересоздаем пул соединений...`);
          logToFile(`RECONNECT: Creating new connection pool after ${consecutiveFailures} consecutive failures`);
          
          try {
            // Закрываем старый пул
            await pool.end();
          } catch (endError) {
            console.error(`[${new Date().toISOString()}] Ошибка при закрытии пула:`, endError.message);
          }
          
          // Создаем новый пул
          pool = new pg.Pool(poolConfig);
          
          // Сбрасываем счетчик
          consecutiveFailures = 0;
        }
      }
      
      // Выводим статистику каждые 10 проверок
      if (totalChecks % 10 === 0) {
        printStats();
      }
      
      // Пауза между проверками (10 секунд)
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Непредвиденная ошибка:`, error);
    logToFile(`ERROR: Unexpected error: ${error.message}`);
  } finally {
    printStats();
    logToFile('END: Завершение мониторинга соединения с базой данных');
    
    // Закрываем пул при завершении
    try {
      await pool.end();
      console.log(`[${new Date().toISOString()}] 👋 Пул соединений закрыт`);
    } catch (endError) {
      console.error(`[${new Date().toISOString()}] Ошибка при закрытии пула:`, endError.message);
    }
  }
}

// Обработчик для корректного завершения при Ctrl+C
process.on('SIGINT', async () => {
  console.log('\n' + `[${new Date().toISOString()}] 🛑 Получен сигнал SIGINT, завершаем мониторинг...`);
  logToFile('END: Мониторинг прерван пользователем (SIGINT)');
  
  try {
    await pool.end();
    console.log(`[${new Date().toISOString()}] 👋 Пул соединений закрыт`);
  } catch (endError) {
    console.error(`[${new Date().toISOString()}] Ошибка при закрытии пула:`, endError.message);
  }
  
  process.exit(0);
});

// Запускаем мониторинг
runContinuousMonitoring();