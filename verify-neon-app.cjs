/**
 * Скрипт для проверки готовности UniFarm к Neon DB
 * 
 * Проверяет:
 * 1. Наличие и корректность файла .env.neon
 * 2. Подключение к Neon DB
 * 3. Наличие необходимых таблиц и их партиционирование
 * 4. Доступность API приложения (если запущено)
 */

const dotenv = require('dotenv');
const { Pool } = require('pg');
const http = require('http');
const fs = require('fs');

// Загружаем переменные окружения из .env.neon
dotenv.config({ path: '.env.neon' });

// Цвета для вывода
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

// Заголовок
console.log(`${colors.blue}===================================`);
console.log(`= ПРОВЕРКА NEON DB И ПРИЛОЖЕНИЯ =`);
console.log(`===================================${colors.reset}`);

// Проверка .env.neon
const envFile = '.env.neon';
if (!fs.existsSync(envFile)) {
  console.log(`${colors.red}❌ Файл ${envFile} не найден!${colors.reset}`);
  console.log(`${colors.yellow}Создайте файл ${envFile} с помощью скрипта create-neon-env.cjs${colors.reset}`);
  process.exit(1);
}

try {
  console.log(`${colors.green}✅ Загружены переменные из ${envFile}${colors.reset}`);
  
  // Проверка подключения к базе данных
  console.log(`${colors.cyan}🔍 Проверка подключения к Neon DB...${colors.reset}`);
  
  if (!process.env.DATABASE_URL) {
    console.log(`${colors.red}❌ Переменная DATABASE_URL не найдена в ${envFile}!${colors.reset}`);
    process.exit(1);
  }
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
  
  // Выполняем проверки базы данных
  async function checkDatabase() {
    try {
      // Проверка соединения
      const timeResult = await pool.query('SELECT NOW() as time');
      console.log(`${colors.green}✅ Подключение к Neon DB успешно:${colors.reset}`);
      console.log(`   Время сервера: ${timeResult.rows[0].time}`);
      
      // Проверка наличия таблиц
      console.log(`${colors.cyan}📊 Проверка таблиц в базе данных...${colors.reset}`);
      const tablesResult = await pool.query(`
        SELECT table_name, 
               (SELECT COUNT(*) FROM information_schema.columns 
                WHERE table_name = t.table_name AND table_schema = 'public') as column_count
        FROM information_schema.tables t
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);
      
      if (tablesResult.rows.length === 0) {
        console.log(`${colors.red}❌ Таблицы не найдены в базе данных!${colors.reset}`);
      } else {
        tablesResult.rows.forEach(table => {
          console.log(`   ${table.table_name}: ${table.column_count} колонок`);
        });
      }
      
      // Проверка партиционирования
      console.log(`${colors.cyan}🔎 Проверка партиционирования transactions...${colors.reset}`);
      const partitionResult = await pool.query(`
        SELECT c.relname as partition_name
        FROM pg_inherits i
        JOIN pg_class p ON i.inhparent = p.oid
        JOIN pg_class c ON i.inhrelid = c.oid
        WHERE p.relname = 'transactions'
      `);
      
      if (partitionResult.rows.length === 0) {
        console.log(`${colors.yellow}⚠️ Таблица transactions не партиционирована${colors.reset}`);
      } else {
        console.log(`${colors.green}✅ Таблица transactions партиционирована на ${partitionResult.rows.length} частей${colors.reset}`);
        partitionResult.rows.slice(0, 5).forEach(part => {
          console.log(`   - ${part.partition_name}`);
        });
        if (partitionResult.rows.length > 5) {
          console.log(`   - ...и еще ${partitionResult.rows.length - 5} партиций`);
        }
      }
      
      // Проверка API приложения
      console.log(`${colors.cyan}🔌 Проверка API приложения на порту 3000...${colors.reset}`);
      
      try {
        await new Promise((resolve, reject) => {
          const req = http.get('http://localhost:3000', res => {
            if (res.statusCode === 200) {
              console.log(`${colors.green}✅ API доступно на порту 3000 (Статус: ${res.statusCode})${colors.reset}`);
              resolve();
            } else {
              console.log(`${colors.yellow}⚠️ API возвращает код состояния ${res.statusCode}${colors.reset}`);
              resolve();
            }
          });
          
          req.on('error', err => {
            console.log(`${colors.yellow}⚠️ Приложение не запущено или не доступно на порту 3000${colors.reset}`);
            resolve();
          });
          
          req.setTimeout(2000, () => {
            console.log(`${colors.yellow}⚠️ Тайм-аут при подключении к API${colors.reset}`);
            resolve();
          });
        });
      } catch (error) {
        console.log(`${colors.yellow}⚠️ Ошибка при проверке API: ${error.message}${colors.reset}`);
      }
      
      // Итоговый результат
      console.log(`${colors.blue}===================================`);
      console.log(`= РЕЗУЛЬТАТЫ ПРОВЕРКИ =`);
      console.log(`===================================${colors.reset}`);
      
      const dbStatus = timeResult ? '✅ OK' : '❌ ERROR';
      const apiStatus = '⚠️ NOT AVAILABLE';
      
      console.log(`Neon DB: ${dbStatus}`);
      console.log(`API: ${apiStatus}`);
      
      if (dbStatus.includes('OK') && apiStatus.includes('NOT')) {
        console.log(`\n${colors.yellow}⚠️ Neon DB работает нормально, но API недоступно.${colors.reset}`);
        console.log(`${colors.yellow}Возможно, приложение не запущено или использует другую базу данных.${colors.reset}`);
        console.log(`${colors.yellow}Проверьте логи приложения.${colors.reset}`);
      } else if (dbStatus.includes('OK') && apiStatus.includes('OK')) {
        console.log(`\n${colors.green}🎉 Система полностью работоспособна с Neon DB!${colors.reset}`);
      }
      
    } catch (error) {
      console.log(`${colors.red}❌ Ошибка при проверке базы данных: ${error.message}${colors.reset}`);
    } finally {
      await pool.end();
    }
  }
  
  checkDatabase();
  
} catch (error) {
  console.log(`${colors.red}❌ Ошибка: ${error.message}${colors.reset}`);
}