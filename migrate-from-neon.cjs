/**
 * Скрипт для миграции данных с Neon DB на Replit PostgreSQL
 * 
 * Этот скрипт выполняет перенос данных из внешней базы данных Neon DB
 * в локальную базу данных PostgreSQL на Replit.
 * 
 * Процесс миграции:
 * 1. Подключается к обеим базам данных
 * 2. Получает список всех таблиц из Neon DB
 * 3. Создает все необходимые таблицы в Replit PostgreSQL
 * 4. Копирует данные из каждой таблицы
 * 5. Проверяет целостность перенесенных данных
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

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

// Настройки для Neon DB (исходная база)
const sourceConfig = {
  connectionString: process.env.NEON_DATABASE_URL, // URL для подключения к Neon DB
};

// Настройки для Replit PostgreSQL (целевая база)
const targetConfig = {
  host: process.env.PGHOST || `${process.env.HOME}/.postgresql/sockets`,
  database: process.env.PGDATABASE || 'postgres',
  user: process.env.PGUSER || 'runner',
  port: parseInt(process.env.PGPORT || '5432'),
  // Устанавливаем разумные таймауты
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 10000,
};

// Функция логирования с цветом
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// Функция для проверки подключения к базе данных
async function testConnection(pool, name) {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT NOW() as time');
      log(`✅ Соединение с ${name} успешно установлено (${result.rows[0].time})`, colors.green);
      return true;
    } finally {
      client.release();
    }
  } catch (error) {
    log(`❌ Ошибка подключения к ${name}: ${error.message}`, colors.red);
    return false;
  }
}

// Функция для получения списка таблиц из базы данных
async function getTables(pool) {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    return result.rows.map(row => row.table_name);
  } finally {
    client.release();
  }
}

// Функция для получения структуры таблицы
async function getTableStructure(pool, tableName) {
  const client = await pool.connect();
  try {
    // Получаем информацию о колонках
    const columnsResult = await client.query(`
      SELECT 
        column_name, 
        data_type, 
        character_maximum_length,
        column_default, 
        is_nullable
      FROM 
        information_schema.columns 
      WHERE 
        table_schema = 'public' 
        AND table_name = $1
      ORDER BY 
        ordinal_position
    `, [tableName]);
    
    // Получаем информацию о первичном ключе
    const pkResult = await client.query(`
      SELECT 
        c.column_name
      FROM 
        information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage AS ccu USING (constraint_schema, constraint_name)
        JOIN information_schema.columns AS c ON c.table_schema = tc.constraint_schema
          AND tc.table_name = c.table_name AND ccu.column_name = c.column_name
      WHERE 
        tc.constraint_type = 'PRIMARY KEY' 
        AND tc.table_schema = 'public' 
        AND tc.table_name = $1
    `, [tableName]);
    
    // Получаем информацию об индексах
    const indexesResult = await client.query(`
      SELECT 
        i.relname as index_name,
        a.attname as column_name,
        ix.indisunique as is_unique,
        ix.indisprimary as is_primary
      FROM 
        pg_class t,
        pg_class i,
        pg_index ix,
        pg_attribute a,
        pg_namespace n
      WHERE 
        t.oid = ix.indrelid
        AND i.oid = ix.indexrelid
        AND a.attrelid = t.oid
        AND a.attnum = ANY(ix.indkey)
        AND t.relnamespace = n.oid
        AND n.nspname = 'public'
        AND t.relname = $1
      ORDER BY
        i.relname, a.attnum
    `, [tableName]);
    
    return {
      columns: columnsResult.rows,
      primaryKey: pkResult.rows.length > 0 ? pkResult.rows[0].column_name : null,
      indexes: indexesResult.rows,
    };
  } finally {
    client.release();
  }
}

// Функция для создания таблицы в целевой базе данных
async function createTable(targetPool, tableName, structure) {
  const client = await targetPool.connect();
  try {
    // Проверяем, существует ли таблица
    const tableExistsResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1
      )
    `, [tableName]);
    
    const tableExists = tableExistsResult.rows[0].exists;
    
    if (tableExists) {
      log(`Таблица ${tableName} уже существует в целевой базе данных, пропускаем создание`, colors.yellow);
      return true;
    }
    
    // Формируем SQL для создания таблицы
    let createSQL = `CREATE TABLE ${tableName} (\n`;
    
    // Добавляем колонки
    structure.columns.forEach((column, index) => {
      let columnDef = `  ${column.column_name} ${column.data_type}`;
      
      // Добавляем длину для строк
      if (column.character_maximum_length) {
        columnDef += `(${column.character_maximum_length})`;
      }
      
      // Добавляем значение по умолчанию
      if (column.column_default) {
        columnDef += ` DEFAULT ${column.column_default}`;
      }
      
      // Добавляем NOT NULL если нужно
      if (column.is_nullable === 'NO') {
        columnDef += ' NOT NULL';
      }
      
      // Добавляем запятую, если это не последняя колонка
      if (index < structure.columns.length - 1) {
        columnDef += ',';
      }
      
      createSQL += columnDef + '\n';
    });
    
    // Закрываем определение таблицы
    createSQL += ');';
    
    // Создаем таблицу
    await client.query(createSQL);
    
    // Создаем индексы
    const processedIndexes = new Set(); // Для избежания дублирования
    
    for (const index of structure.indexes) {
      // Пропускаем первичный ключ, он будет создан отдельно
      if (index.is_primary) continue;
      
      // Формируем имя индекса
      const indexName = index.index_name;
      
      // Пропускаем, если индекс уже обработан
      if (processedIndexes.has(indexName)) continue;
      processedIndexes.add(indexName);
      
      // Получаем все колонки для этого индекса
      const indexColumns = structure.indexes
        .filter(i => i.index_name === indexName)
        .map(i => i.column_name);
      
      // Формируем SQL для создания индекса
      let indexSQL = `CREATE`;
      
      // Добавляем UNIQUE, если нужно
      if (index.is_unique) {
        indexSQL += ' UNIQUE';
      }
      
      indexSQL += ` INDEX IF NOT EXISTS ${indexName} ON ${tableName} (${indexColumns.join(', ')});`;
      
      // Создаем индекс
      await client.query(indexSQL);
    }
    
    // Создаем первичный ключ, если он есть
    if (structure.primaryKey) {
      await client.query(`
        ALTER TABLE ${tableName}
        ADD PRIMARY KEY (${structure.primaryKey});
      `);
    }
    
    log(`Таблица ${tableName} успешно создана в целевой базе данных`, colors.green);
    return true;
  } catch (error) {
    log(`Ошибка при создании таблицы ${tableName}: ${error.message}`, colors.red);
    return false;
  } finally {
    client.release();
  }
}

// Функция для копирования данных из исходной таблицы в целевую
async function copyData(sourcePool, targetPool, tableName) {
  // Получаем клиентов для обеих баз
  const sourceClient = await sourcePool.connect();
  const targetClient = await targetPool.connect();
  
  try {
    // Получаем количество записей в исходной таблице
    const countResult = await sourceClient.query(`SELECT COUNT(*) FROM ${tableName}`);
    const totalRows = parseInt(countResult.rows[0].count);
    
    log(`Копирование ${totalRows} записей из таблицы ${tableName}...`, colors.blue);
    
    if (totalRows === 0) {
      log(`Таблица ${tableName} пуста, пропускаем`, colors.yellow);
      return true;
    }
    
    // Получаем список колонок
    const columnsResult = await sourceClient.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);
    
    const columns = columnsResult.rows.map(row => row.column_name);
    
    // Очищаем целевую таблицу перед копированием
    await targetClient.query(`TRUNCATE TABLE ${tableName} RESTART IDENTITY CASCADE`);
    
    // Получаем данные из исходной таблицы и вставляем в целевую
    // Используем постраничную загрузку для больших таблиц
    const pageSize = 1000;
    let offset = 0;
    let copiedRows = 0;
    
    while (offset < totalRows) {
      // Получаем порцию данных
      const dataResult = await sourceClient.query(`
        SELECT ${columns.join(', ')}
        FROM ${tableName}
        ORDER BY ${columns[0]} 
        LIMIT ${pageSize} OFFSET ${offset}
      `);
      
      if (dataResult.rows.length === 0) break;
      
      // Начинаем транзакцию для вставки
      await targetClient.query('BEGIN');
      
      try {
        for (const row of dataResult.rows) {
          // Формируем запрос для вставки
          const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
          const values = columns.map(col => row[col]);
          
          await targetClient.query(`
            INSERT INTO ${tableName} (${columns.join(', ')})
            VALUES (${placeholders})
          `, values);
          
          copiedRows++;
        }
        
        // Коммитим транзакцию
        await targetClient.query('COMMIT');
        
        offset += dataResult.rows.length;
        log(`Скопировано ${copiedRows}/${totalRows} записей в таблице ${tableName}...`, colors.cyan);
      } catch (error) {
        // Откатываем транзакцию в случае ошибки
        await targetClient.query('ROLLBACK');
        throw error;
      }
    }
    
    // Проверяем, все ли записи скопированы
    const targetCountResult = await targetClient.query(`SELECT COUNT(*) FROM ${tableName}`);
    const targetRows = parseInt(targetCountResult.rows[0].count);
    
    if (targetRows === totalRows) {
      log(`✅ Успешно скопировано ${targetRows} записей в таблицу ${tableName}`, colors.green);
      return true;
    } else {
      log(`⚠️ Скопировано только ${targetRows}/${totalRows} записей в таблицу ${tableName}`, colors.yellow);
      return false;
    }
  } catch (error) {
    log(`❌ Ошибка при копировании данных для таблицы ${tableName}: ${error.message}`, colors.red);
    return false;
  } finally {
    sourceClient.release();
    targetClient.release();
  }
}

// Функция для миграции всех таблиц
async function migrateAllTables(sourcePool, targetPool) {
  try {
    // Получаем список таблиц из исходной базы данных
    const tables = await getTables(sourcePool);
    
    log(`Найдено ${tables.length} таблиц в исходной базе данных: ${tables.join(', ')}`, colors.blue);
    
    // Создаем все таблицы и копируем данные
    for (const tableName of tables) {
      log(`\nМиграция таблицы ${tableName}...`, colors.magenta);
      
      // Получаем структуру таблицы
      const structure = await getTableStructure(sourcePool, tableName);
      
      // Создаем таблицу в целевой базе
      const tableCreated = await createTable(targetPool, tableName, structure);
      
      if (!tableCreated) {
        log(`⚠️ Таблица ${tableName} не создана, пропускаем копирование данных`, colors.yellow);
        continue;
      }
      
      // Копируем данные
      await copyData(sourcePool, targetPool, tableName);
    }
    
    return true;
  } catch (error) {
    log(`❌ Критическая ошибка при миграции: ${error.message}`, colors.red);
    return false;
  }
}

// Главная функция
async function main() {
  log('=== Миграция данных с Neon DB на Replit PostgreSQL ===', colors.magenta);
  
  // Проверяем наличие URL для Neon DB
  if (!process.env.NEON_DATABASE_URL) {
    log(`❌ Отсутствует URL для подключения к Neon DB (NEON_DATABASE_URL)`, colors.red);
    log(`Укажите URL в переменной окружения NEON_DATABASE_URL и запустите скрипт снова`, colors.yellow);
    process.exit(1);
  }
  
  // Создаем пулы соединений
  const sourcePool = new Pool(sourceConfig);
  const targetPool = new Pool(targetConfig);
  
  try {
    // Проверяем соединения
    const sourceConnected = await testConnection(sourcePool, 'Neon DB (исходная база)');
    const targetConnected = await testConnection(targetPool, 'Replit PostgreSQL (целевая база)');
    
    if (!sourceConnected || !targetConnected) {
      log(`❌ Невозможно подключиться к одной или обеим базам данных`, colors.red);
      process.exit(1);
    }
    
    // Выполняем миграцию всех таблиц
    const success = await migrateAllTables(sourcePool, targetPool);
    
    if (success) {
      log(`\n🎉 Миграция успешно завершена!`, colors.green);
    } else {
      log(`\n⚠️ Миграция завершена с ошибками. Проверьте логи выше.`, colors.yellow);
    }
  } catch (error) {
    log(`\n❌ Произошла непредвиденная ошибка: ${error.message}`, colors.red);
    process.exit(1);
  } finally {
    // Закрываем соединения с обеими базами данных
    await sourcePool.end();
    await targetPool.end();
  }
}

// Запускаем скрипт
main();