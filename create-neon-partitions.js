#!/usr/bin/env node
/**
 * Скрипт для создания партиционирования таблицы transactions в Neon DB
 * 
 * ВАЖНО: Этот скрипт создаст партиционирование с нуля!
 * Если у вас есть данные в таблице transactions, они будут потеряны.
 * Используйте этот скрипт только при начальном развертывании базы данных.
 */

import fs from 'fs';
import { Pool } from 'pg';
import 'dotenv/config';

// Цвета для консоли
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Вывод в консоль с цветами
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// Загружаем переменные окружения из .env.neon
function loadEnvFromFile() {
  try {
    const envFile = fs.readFileSync('.env.neon', 'utf8');
    const envVars = {};
    
    envFile.split('\n').forEach(line => {
      if (line.trim() && !line.startsWith('#')) {
        const parts = line.split('=');
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const value = parts.slice(1).join('=').trim();
          
          if (key && value) {
            envVars[key] = value;
            process.env[key] = value;
          }
        }
      }
    });
    
    return envVars;
  } catch (error) {
    log(`Ошибка при загрузке .env.neon: ${error.message}`, colors.red);
    return {};
  }
}

// Функция для создания партиционирования
async function createPartitioning() {
  log('🚀 Запуск скрипта создания партиционирования для Neon DB...', colors.blue);
  
  // Загружаем переменные окружения
  const envVars = loadEnvFromFile();
  
  if (!process.env.DATABASE_URL && !envVars.DATABASE_URL) {
    log('❌ Переменная DATABASE_URL не найдена. Пожалуйста, укажите её в .env.neon', colors.red);
    return false;
  }
  
  const connectionString = process.env.DATABASE_URL;
  const maskedUrl = connectionString.replace(/:[^:]*@/, ':***@');
  
  log(`📝 Используемая строка подключения: ${maskedUrl}`, colors.yellow);
  
  try {
    // Создаем пул подключений
    const pool = new Pool({ 
      connectionString,
      ssl: {
        rejectUnauthorized: false
      },
      max: 2
    });
    
    // Проверяем соединение
    log('🔄 Проверка соединения с Neon DB...', colors.cyan);
    await pool.query('SELECT 1');
    log('✅ Соединение с Neon DB успешно установлено', colors.green);
    
    // Предупреждение пользователю
    log('\n⚠️ ВНИМАНИЕ! Скрипт создаст новую партиционированную таблицу transactions.', colors.yellow);
    log('⚠️ Все существующие данные в таблице transactions будут ПОТЕРЯНЫ!', colors.yellow);
    log('⚠️ Нажмите Ctrl+C, если хотите отменить операцию.', colors.yellow);
    
    // Уменьшаем время ожидания
    log('\nПродолжение через 1 секунду...', colors.magenta);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Проверяем существование таблицы transactions
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions'
      ) as exists;
    `);
    
    const tableExists = tableCheck.rows[0].exists;
    
    // Шаг 1: Резервное копирование данных (если таблица существует)
    if (tableExists) {
      log('\n🔄 Создание резервной копии данных...', colors.cyan);
      
      await pool.query(`
        CREATE TABLE IF NOT EXISTS transactions_backup AS 
        SELECT * FROM transactions;
      `);
      
      const backupCount = await pool.query('SELECT COUNT(*) FROM transactions_backup');
      log(`✅ Создана резервная копия с ${backupCount.rows[0].count} записями`, colors.green);
      
      // Удаляем существующую таблицу
      log('\n🔄 Удаление существующей таблицы transactions...', colors.cyan);
      await pool.query('DROP TABLE IF EXISTS transactions CASCADE');
      log('✅ Таблица удалена', colors.green);
    }
    
    // Шаг 2: Создание партиционированной таблицы
    log('\n🔄 Создание партиционированной таблицы transactions...', colors.cyan);
    
    await pool.query(`
      CREATE TABLE transactions (
        id SERIAL,
        user_id INTEGER REFERENCES users(id),
        type TEXT,
        currency TEXT,
        amount NUMERIC(18, 6),
        status TEXT DEFAULT 'confirmed',
        source TEXT,
        category TEXT,
        tx_hash TEXT,
        description TEXT,
        source_user_id INTEGER,
        wallet_address TEXT,
        data TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      ) PARTITION BY RANGE (created_at);
      
      -- В партиционированной таблице Primary Key должен включать все колонки из ключа партиционирования
      CREATE UNIQUE INDEX transactions_pkey ON transactions (id, created_at);
      
      -- Создаем индексы для ускорения запросов
      CREATE INDEX idx_transactions_user_id ON transactions (user_id);
      CREATE INDEX idx_transactions_source_user_id ON transactions (source_user_id);
      CREATE INDEX idx_transactions_type_status ON transactions (type, status);
      CREATE INDEX idx_transactions_created_at ON transactions (created_at);
    `);
    
    log('✅ Партиционированная таблица transactions создана', colors.green);
    
    // Шаг 3: Создание партиций
    log('\n🔄 Создание партиций...', colors.cyan);
    
    // Создаем партиции для последних 3 месяцев и следующих 3 месяцев
    const now = new Date();
    
    // Партиции для прошлых месяцев
    for (let i = 3; i >= 0; i--) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);
      
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      
      const partitionName = `transactions_${year}_${month.toString().padStart(2, '0')}`;
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      
      let endDate;
      if (month === 12) {
        endDate = `${year + 1}-01-01`;
      } else {
        endDate = `${year}-${(month + 1).toString().padStart(2, '0')}-01`;
      }
      
      try {
        await pool.query(`
          CREATE TABLE ${partitionName} PARTITION OF transactions
          FOR VALUES FROM ('${startDate}') TO ('${endDate}');
        `);
        
        log(`✅ Создана партиция ${partitionName} для периода ${startDate} - ${endDate}`, colors.green);
      } catch (error) {
        log(`❌ Ошибка при создании партиции ${partitionName}: ${error.message}`, colors.red);
      }
    }
    
    // Партиции для будущих месяцев
    for (let i = 1; i <= 3; i++) {
      const date = new Date(now);
      date.setMonth(date.getMonth() + i);
      
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      
      const partitionName = `transactions_${year}_${month.toString().padStart(2, '0')}`;
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      
      let endDate;
      if (month === 12) {
        endDate = `${year + 1}-01-01`;
      } else {
        endDate = `${year}-${(month + 1).toString().padStart(2, '0')}-01`;
      }
      
      try {
        await pool.query(`
          CREATE TABLE ${partitionName} PARTITION OF transactions
          FOR VALUES FROM ('${startDate}') TO ('${endDate}');
        `);
        
        log(`✅ Создана партиция ${partitionName} для периода ${startDate} - ${endDate}`, colors.green);
      } catch (error) {
        log(`❌ Ошибка при создании партиции ${partitionName}: ${error.message}`, colors.red);
      }
    }
    
    // Создаем партицию по умолчанию для более старых записей
    try {
      await pool.query(`
        CREATE TABLE transactions_default PARTITION OF transactions DEFAULT;
      `);
      
      log(`✅ Создана партиция transactions_default для остальных дат`, colors.green);
    } catch (error) {
      log(`❌ Ошибка при создании партиции по умолчанию: ${error.message}`, colors.red);
    }
    
    // Шаг 4: Восстановление данных (если была резервная копия)
    if (tableExists) {
      log('\n🔄 Восстановление данных из резервной копии...', colors.cyan);
      
      await pool.query(`
        INSERT INTO transactions (
          id, user_id, type, currency, amount, status, source, 
          category, tx_hash, description, source_user_id, 
          wallet_address, data, created_at
        )
        SELECT 
          id, user_id, type, currency, amount, status, source, 
          category, tx_hash, description, source_user_id, 
          wallet_address, data, created_at
        FROM transactions_backup;
      `);
      
      const restoredCount = await pool.query('SELECT COUNT(*) FROM transactions');
      log(`✅ Восстановлено ${restoredCount.rows[0].count} записей`, colors.green);
    }
    
    // Шаг 5: Создаем функции для автоматического создания партиций
    log('\n🔄 Создание функций для автоматического управления партициями...', colors.cyan);
    
    await pool.query(`
      -- Функция для создания новой партиции
      CREATE OR REPLACE FUNCTION create_transaction_partition(
        partition_date DATE
      )
      RETURNS VOID AS $$
      DECLARE
        partition_name TEXT;
        start_date TEXT;
        end_date TEXT;
        year_val INT;
        month_val INT;
      BEGIN
        year_val := EXTRACT(YEAR FROM partition_date);
        month_val := EXTRACT(MONTH FROM partition_date);
        
        partition_name := 'transactions_' || year_val || '_' || LPAD(month_val::TEXT, 2, '0');
        start_date := year_val || '-' || LPAD(month_val::TEXT, 2, '0') || '-01';
        
        IF month_val = 12 THEN
          end_date := (year_val + 1) || '-01-01';
        ELSE
          end_date := year_val || '-' || LPAD((month_val + 1)::TEXT, 2, '0') || '-01';
        END IF;
        
        -- Проверяем, существует ли уже такая партиция
        IF NOT EXISTS (
          SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relname = partition_name AND n.nspname = 'public'
        ) THEN
          EXECUTE 'CREATE TABLE ' || partition_name || ' PARTITION OF transactions
                  FOR VALUES FROM (''' || start_date || ''') TO (''' || end_date || ''')';
          
          -- Логируем создание партиции
          INSERT INTO partition_logs (operation, partition_name, message, status)
          VALUES ('CREATE', partition_name, 'Created partition for period ' || start_date || ' to ' || end_date, 'success');
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- Логируем ошибку
        INSERT INTO partition_logs (operation, partition_name, message, status, error_details)
        VALUES ('ERROR', partition_name, 'Failed to create partition', 'error', SQLERRM);
        RAISE;
      END;
      $$ LANGUAGE plpgsql;
      
      -- Функция для создания партиций на N месяцев вперед
      CREATE OR REPLACE FUNCTION create_future_transaction_partitions(
        months_ahead INT DEFAULT 3
      )
      RETURNS VOID AS $$
      DECLARE
        current_date DATE := CURRENT_DATE;
        future_date DATE;
      BEGIN
        FOR i IN 0..months_ahead LOOP
          future_date := current_date + (i || ' month')::INTERVAL;
          PERFORM create_transaction_partition(future_date);
        END LOOP;
        
        -- Логируем успешное создание будущих партиций
        INSERT INTO partition_logs (operation, message, status)
        VALUES ('INFO', 'Created ' || months_ahead || ' future partitions', 'success');
      EXCEPTION WHEN OTHERS THEN
        -- Логируем ошибку
        INSERT INTO partition_logs (operation, message, status, error_details)
        VALUES ('ERROR', 'Failed to create future partitions', 'error', SQLERRM);
        RAISE;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    log('✅ Функции для управления партициями созданы', colors.green);
    
    // Закрываем пул
    await pool.end();
    
    log('\n🎉 Партиционирование успешно создано!', colors.green);
    log('ℹ️ Теперь вы можете использовать функцию create_future_transaction_partitions() для создания партиций на будущие месяцы', colors.cyan);
    
    return true;
  } catch (error) {
    log(`\n❌ Ошибка при создании партиционирования: ${error.message}`, colors.red);
    console.error(error);
    return false;
  }
}

// Запуск скрипта
createPartitioning()
  .then(success => {
    if (success) {
      log('\n✅ Скрипт успешно выполнен', colors.green);
    } else {
      log('\n❌ Скрипт завершился с ошибками', colors.red);
      process.exit(1);
    }
  })
  .catch(error => {
    log(`\n💥 Непредвиденная ошибка: ${error.message}`, colors.red);
    console.error(error);
    process.exit(1);
  });