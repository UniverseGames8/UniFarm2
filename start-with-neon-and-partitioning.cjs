/**
 * Скрипт для запуска приложения с Neon DB и проверкой/настройкой партиционирования
 */

const dotenv = require('dotenv');
const { spawn } = require('child_process');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// Загружаем переменные окружения
dotenv.config();

// Устанавливаем переменные окружения для подключения к Neon DB
process.env.DATABASE_PROVIDER = 'neon';
process.env.FORCE_NEON_DB = 'true';
process.env.DISABLE_REPLIT_DB = 'true';
process.env.OVERRIDE_DB_PROVIDER = 'neon';

// Проверяем наличие строки подключения
if (!process.env.DATABASE_URL) {
  console.error('❌ Переменная окружения DATABASE_URL не установлена');
  process.exit(1);
}

console.log('🔍 Проверка подключения к Neon DB...');

// Создаем пул соединений
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Функция для выполнения SQL запросов
async function executeQuery(query, params = []) {
  try {
    const result = await pool.query(query, params);
    return result;
  } catch (error) {
    console.error(`SQL ошибка: ${error.message}`);
    console.error(`Запрос: ${query}`);
    throw error;
  }
}

// Проверяет существование таблицы
async function checkTableExists(tableName) {
  const query = `
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = $1
    );
  `;
  
  const result = await executeQuery(query, [tableName]);
  return result.rows[0].exists;
}

// Проверяет, является ли таблица партиционированной
async function isTablePartitioned(tableName) {
  try {
    const query = `
      SELECT pt.relname as parent_table, 
             c.relname as child_table,
             pg_get_expr(c.relpartbound, c.oid) as partition_expression
      FROM pg_inherits i
      JOIN pg_class pt ON pt.oid = i.inhparent
      JOIN pg_class c ON c.oid = i.inhrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE pt.relname = $1 
      AND n.nspname = 'public'
      LIMIT 1;
    `;
    
    const result = await executeQuery(query, [tableName]);
    return (result.rowCount || 0) > 0;
  } catch (error) {
    console.error('Ошибка при проверке партиционирования:', error);
    return false;
  }
}

// Функция для запуска дочернего процесса и возврата результатов
function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`Выполнение команды: ${command} ${args.join(' ')}`);
    
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: false,
      ...options
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Процесс завершился с кодом ${code}`));
      }
    });
    
    child.on('error', (error) => {
      reject(error);
    });
  });
}

// Основная функция
async function main() {
  try {
    // Проверяем соединение с базой данных
    const connectionTest = await executeQuery('SELECT NOW() as time');
    console.log(`✅ Соединение с базой данных установлено: ${connectionTest.rows[0].time}`);
    
    // Проверяем существование таблицы transactions
    const transactionsExist = await checkTableExists('transactions');
    
    if (!transactionsExist) {
      console.error('❌ Таблица transactions не существует в базе данных');
      console.log('Продолжаем запуск приложения...');
    } else {
      console.log('✅ Таблица transactions существует в базе данных');
      
      // Проверяем партиционирование
      const isPartitioned = await isTablePartitioned('transactions');
      
      if (isPartitioned) {
        console.log('✅ Таблица transactions партиционирована');
      } else {
        console.log('⚠️ Таблица transactions НЕ партиционирована');
        console.log('Запускаем скрипт партиционирования...');
        
        // Запускаем скрипт партиционирования
        try {
          await runProcess('node', ['implement-partitioning.cjs']);
          console.log('✅ Партиционирование таблицы transactions успешно настроено');
        } catch (error) {
          console.error('❌ Ошибка при настройке партиционирования:', error.message);
          console.log('Продолжаем запуск приложения...');
        }
      }
    }
    
    // Закрываем пул соединений
    await pool.end();
    
    // Запускаем приложение
    console.log('🚀 Запуск приложения с настройками Neon DB...');
    
    // Определяем команду запуска на основе package.json
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    let startCommand = 'node server/index.js';
    
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (packageJson.scripts && packageJson.scripts.start) {
          startCommand = 'npm run start';
        } else if (packageJson.scripts && packageJson.scripts.dev) {
          startCommand = 'npm run dev';
        }
      } catch (error) {
        console.error('Ошибка при чтении package.json:', error.message);
      }
    }
    
    console.log(`Команда запуска: ${startCommand}`);
    
    // Запускаем приложение
    const [command, ...args] = startCommand.split(' ');
    await runProcess(command, args, {
      env: {
        ...process.env,
        DATABASE_PROVIDER: 'neon',
        FORCE_NEON_DB: 'true',
        DISABLE_REPLIT_DB: 'true',
        OVERRIDE_DB_PROVIDER: 'neon'
      }
    });
  } catch (error) {
    console.error('❌ Произошла ошибка:', error.message);
    process.exit(1);
  }
}

// Запускаем основную функцию
main();