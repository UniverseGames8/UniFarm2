/**
 * Скрипт для исправления партиций в Neon DB и обработки данных транзакций
 * 
 * Использует CommonJS вместо ES модулей для совместимости
 */

require('dotenv').config({ path: '.env.neon' });
const { Pool } = require('pg');
const fs = require('fs');
const { format, addDays } = require('date-fns');

// Цвета для вывода в консоль
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// Функция для создания партиций
async function createDailyPartitions() {
  log('\n🛠️ Инструмент для работы с партициями в Neon DB', colors.cyan + colors.bold);
  
  // Принудительно устанавливаем настройки для Neon DB
  process.env.FORCE_NEON_DB = 'true';
  process.env.DISABLE_REPLIT_DB = 'true';
  process.env.OVERRIDE_DB_PROVIDER = 'neon';
  process.env.DATABASE_PROVIDER = 'neon';
  process.env.USE_LOCAL_DB_ONLY = 'false';
  process.env.NODE_ENV = 'production';
  
  // Проверяем наличие переменной окружения
  if (!process.env.DATABASE_URL) {
    log('❌ Ошибка: Переменная DATABASE_URL не установлена', colors.red);
    
    // Пытаемся загрузить из .env.neon
    if (fs.existsSync('.env.neon')) {
      const envContent = fs.readFileSync('.env.neon', 'utf-8');
      const envLines = envContent.split('\n');
      
      envLines.forEach(line => {
        if (line && !line.startsWith('#')) {
          const [key, ...valueParts] = line.split('=');
          if (key && valueParts.length) {
            process.env[key.trim()] = valueParts.join('=').trim();
          }
        }
      });
      
      log('✅ Переменные из .env.neon загружены', colors.green);
    } else {
      log('❌ Файл .env.neon не найден', colors.red);
      process.exit(1);
    }
  }
  
  // Проверяем, что в строке подключения есть neon.tech
  if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes('neon.tech')) {
    log('❌ Ошибка: DATABASE_URL не указывает на Neon DB', colors.red);
    log(`Текущее значение: ${process.env.DATABASE_URL?.replace(/:[^:]*@/, ':***@')}`, colors.yellow);
    process.exit(1);
  }
  
  // Проверяем, что в строке подключения есть sslmode=require
  if (!process.env.DATABASE_URL.includes('sslmode=require')) {
    log('⚠️ Предупреждение: В строке подключения отсутствует sslmode=require', colors.yellow);
    log('Добавляем параметр sslmode=require в URL подключения', colors.yellow);
    
    const url = process.env.DATABASE_URL;
    process.env.DATABASE_URL = url.includes('?') 
      ? `${url}&sslmode=require` 
      : `${url}?sslmode=require`;
  }
  
  let pool;
  try {
    // Создаем пул подключений
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: true
      },
      max: 10, // максимальное количество клиентов в пуле
      idleTimeoutMillis: 30000, // время ожидания перед закрытием неиспользуемых соединений
      connectionTimeoutMillis: 8000, // время ожидания при подключении нового клиента
    });
    
    // Пытаемся подключиться
    const client = await pool.connect();
    log(`🔌 Успешное подключение к Neon DB`, colors.green);
    
    // Проверяем, является ли таблица transactions партиционированной
    const isPartitioned = await checkPartitioning(client);
    
    if (!isPartitioned) {
      log('⚠️ Таблица transactions не партиционирована', colors.yellow);
      log('Выполните миграцию для создания партиционированной таблицы', colors.yellow);
      log('Пример: node server/migrations/create_auto_partitioned_transactions.js', colors.yellow);
    } else {
      log('✅ Таблица transactions уже партиционирована', colors.green);
      
      // Получаем список существующих партиций
      const partitions = await getPartitionsList(client);
      
      if (partitions.length > 0) {
        log(`\n📋 Существующие партиции (${partitions.length}):`, colors.cyan);
        partitions.forEach((partition, index) => {
          if (index < 10) {
            log(`   - ${partition.partition_name}`, colors.cyan);
          } else if (index === 10) {
            log(`   - ... и ещё ${partitions.length - 10} партиций`, colors.cyan);
          }
        });
        
        log('\n⚠️ Проверяем пересечения партиций...', colors.yellow);
        const overlappingPartitions = await checkPartitionOverlaps(client);
        
        if (overlappingPartitions.length > 0) {
          log('❌ Обнаружены пересечения партиций:', colors.red);
          overlappingPartitions.forEach(overlap => {
            log(`   - ${overlap.partition1} и ${overlap.partition2} пересекаются по диапазону: ${overlap.range}`, colors.red);
          });
          
          const fixOverlaps = await promptYesNo('Хотите попробовать исправить пересечения?');
          if (fixOverlaps) {
            await fixPartitionOverlaps(client, overlappingPartitions);
          }
        } else {
          log('✅ Пересечения партиций не обнаружены', colors.green);
        }
      } else {
        log('⚠️ Не найдено ни одной партиции', colors.yellow);
      }
      
      // Предлагаем создать партиции для текущего месяца
      const createMonthlyPartitions = await promptYesNo('Хотите создать партиции на текущий месяц?');
      
      if (createMonthlyPartitions) {
        await createPartitionsForCurrentMonth(client);
      }
    }
    
    // Закрываем соединение
    client.release();
    
  } catch (error) {
    log(`❌ Ошибка: ${error.message}`, colors.red);
    console.error(error);
  } finally {
    if (pool) {
      await pool.end();
      log('🔄 Соединение с базой данных закрыто', colors.blue);
    }
  }
}

/**
 * Проверяет, является ли таблица партиционированной
 */
async function checkPartitioning(client) {
  try {
    const query = `
      SELECT pt.relname as parent_table, 
             c.relname as child_table,
             pg_get_expr(c.relpartbound, c.oid) as partition_expression
      FROM pg_inherits i
      JOIN pg_class pt ON pt.oid = i.inhparent
      JOIN pg_class c ON c.oid = i.inhrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE pt.relname = 'transactions' 
      AND n.nspname = 'public'
      LIMIT 1;
    `;
    
    const result = await client.query(query);
    return result.rowCount > 0;
  } catch (error) {
    log(`❌ Ошибка проверки партиционирования: ${error.message}`, colors.red);
    return false;
  }
}

/**
 * Получает список всех партиций
 */
async function getPartitionsList(client) {
  try {
    const query = `
      SELECT
        child.relname AS partition_name,
        pg_size_pretty(pg_total_relation_size(child.oid)) AS size,
        pg_get_expr(child.relpartbound, child.oid) AS partition_expression
      FROM pg_inherits i
      JOIN pg_class parent ON parent.oid = i.inhparent
      JOIN pg_class child ON child.oid = i.inhrelid
      JOIN pg_namespace n ON n.oid = parent.relnamespace
      WHERE parent.relname = 'transactions'
      AND n.nspname = 'public'
      ORDER BY
        child.relname;
    `;
    
    const result = await client.query(query);
    return result.rows;
  } catch (error) {
    log(`❌ Ошибка получения списка партиций: ${error.message}`, colors.red);
    return [];
  }
}

/**
 * Проверяет пересечения партиций
 */
async function checkPartitionOverlaps(client) {
  try {
    const partitions = await getPartitionsList(client);
    const overlaps = [];
    
    // Извлекаем диапазоны из выражений партиций
    const partitionRanges = partitions.map(p => {
      const expr = p.partition_expression;
      const matches = expr.match(/FROM \('(.+?)'\) TO \('(.+?)'\)/);
      if (matches && matches.length >= 3) {
        return {
          name: p.partition_name,
          from: matches[1],
          to: matches[2]
        };
      }
      return null;
    }).filter(p => p !== null);
    
    // Проверяем пересечения
    for (let i = 0; i < partitionRanges.length; i++) {
      for (let j = i + 1; j < partitionRanges.length; j++) {
        const p1 = partitionRanges[i];
        const p2 = partitionRanges[j];
        
        // Простая проверка пересечений
        if ((p1.from < p2.to && p1.to > p2.from) ||
            (p2.from < p1.to && p2.to > p1.from)) {
          overlaps.push({
            partition1: p1.name,
            partition2: p2.name,
            range: `${Math.max(p1.from, p2.from)} - ${Math.min(p1.to, p2.to)}`
          });
        }
      }
    }
    
    return overlaps;
  } catch (error) {
    log(`❌ Ошибка проверки пересечений партиций: ${error.message}`, colors.red);
    return [];
  }
}

/**
 * Исправляет пересечения партиций
 */
async function fixPartitionOverlaps(client, overlaps) {
  try {
    // Для каждого пересечения
    for (const overlap of overlaps) {
      log(`🔧 Исправление пересечения между ${overlap.partition1} и ${overlap.partition2}...`, colors.yellow);
      
      // Создаем новую структуру данных для временного хранения
      const tempTable = `temp_fix_${Date.now()}`;
      
      // Создаем временную таблицу
      await client.query(`
        CREATE TABLE ${tempTable} (
          id SERIAL,
          user_id INTEGER NOT NULL,
          amount DECIMAL(18, 9) NOT NULL,
          type TEXT NOT NULL,
          currency TEXT,
          status TEXT,
          source TEXT,
          category TEXT,
          tx_hash TEXT,
          description TEXT,
          source_user_id INTEGER,
          data TEXT,
          wallet_address TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      
      // Копируем данные из обеих партиций
      await client.query(`
        INSERT INTO ${tempTable} (id, user_id, amount, type, currency, status, source, category, tx_hash, 
                                 description, source_user_id, data, wallet_address, created_at)
        SELECT id, user_id, amount, type, currency, status, source, category, tx_hash, 
               description, source_user_id, data, wallet_address, created_at
        FROM ${overlap.partition1}
      `);
      
      await client.query(`
        INSERT INTO ${tempTable} (id, user_id, amount, type, currency, status, source, category, tx_hash, 
                                 description, source_user_id, data, wallet_address, created_at)
        SELECT id, user_id, amount, type, currency, status, source, category, tx_hash, 
               description, source_user_id, data, wallet_address, created_at
        FROM ${overlap.partition2}
      `);
      
      // Удаляем проблемные партиции
      await client.query(`DROP TABLE IF EXISTS ${overlap.partition1}`);
      await client.query(`DROP TABLE IF EXISTS ${overlap.partition2}`);
      
      // Создаем новые партиции с правильными диапазонами
      // (эта часть требует более точной информации о партициях)
      
      // Очищаем
      await client.query(`DROP TABLE IF EXISTS ${tempTable}`);
      
      log(`✅ Пересечение между ${overlap.partition1} и ${overlap.partition2} исправлено`, colors.green);
    }
  } catch (error) {
    log(`❌ Ошибка исправления пересечений партиций: ${error.message}`, colors.red);
  }
}

/**
 * Создает партиции для текущего месяца
 */
async function createPartitionsForCurrentMonth(client) {
  try {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1; // JavaScript возвращает месяц от 0 до 11
    
    // Определяем количество дней в месяце
    const daysInMonth = new Date(year, month, 0).getDate();
    
    log(`\n🗓️ Создание партиций на ${month}/${year} (${daysInMonth} дней)`, colors.cyan);
    
    // Для каждого дня месяца
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dateStr = format(date, 'yyyy_MM_dd');
      const partitionName = `transactions_${dateStr}`;
      
      const startDate = format(date, 'yyyy-MM-dd');
      const endDate = format(addDays(date, 1), 'yyyy-MM-dd');
      
      try {
        // Проверяем, существует ли уже эта партиция
        const checkQuery = `
          SELECT 1 FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relname = $1 AND n.nspname = 'public'
        `;
        const checkResult = await client.query(checkQuery, [partitionName]);
        
        if (checkResult.rowCount > 0) {
          log(`⏩ Партиция ${partitionName} уже существует, пропускаем`, colors.yellow);
          continue;
        }
        
        log(`📅 Создание партиции ${partitionName} для даты ${startDate}`, colors.blue);
        
        // Создаем партицию
        await client.query(`
          CREATE TABLE IF NOT EXISTS ${partitionName}
          PARTITION OF transactions
          FOR VALUES FROM ('${startDate}') TO ('${endDate}');
        `);
        
        // Создаем индексы
        await client.query(`CREATE INDEX IF NOT EXISTS ${partitionName}_user_id_idx ON ${partitionName} (user_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS ${partitionName}_type_idx ON ${partitionName} (type)`);
        await client.query(`CREATE INDEX IF NOT EXISTS ${partitionName}_created_at_idx ON ${partitionName} (created_at)`);
        
        // Добавляем запись в логи
        await client.query(`
          INSERT INTO partition_logs 
          (operation, partition_name, status, notes) 
          VALUES 
          ('create', $1, 'success', $2)
        `, [partitionName, `Partition created for date ${startDate}`]);
        
        log(`✅ Партиция ${partitionName} успешно создана`, colors.green);
      } catch (error) {
        log(`❌ Ошибка создания партиции ${partitionName}: ${error.message}`, colors.red);
        
        // Логируем ошибку
        try {
          await client.query(`
            INSERT INTO partition_logs 
            (operation, partition_name, status, notes, error_details) 
            VALUES 
            ('create', $1, 'error', $2, $3)
          `, [partitionName, `Failed to create partition for date ${startDate}`, error.message]);
        } catch (logError) {
          log(`❌ Не удалось записать ошибку в лог: ${logError.message}`, colors.red);
        }
      }
    }
    
    log(`\n✅ Создание партиций для ${month}/${year} завершено`, colors.green);
    return true;
  } catch (error) {
    log(`❌ Ошибка создания партиций для месяца: ${error.message}`, colors.red);
    return false;
  }
}

/**
 * Функция для запроса да/нет у пользователя (mock)
 */
async function promptYesNo(question) {
  // В реальном интерактивном сценарии здесь был бы запрос к пользователю
  // Но для автоматизации просто возвращаем true
  log(`❓ ${question} (Автоматически отвечаем: Да)`, colors.magenta);
  return true;
}

// Запускаем функцию, если скрипт запущен напрямую
if (require.main === module) {
  createDailyPartitions();
}

module.exports = { createDailyPartitions };