import { Pool } from '@neondatabase/serverless';
import { format, subDays } from 'date-fns';
import fs from 'fs';
import path from 'path';

/**
 * Миграция для создания автоматически партиционируемой таблицы transactions по дате
 * Это значительно ускорит выборку по временным интервалам и позволит удалять старые данные
 * 
 * Внимание: данная миграция полностью перестроит систему хранения транзакций,
 * создав основную партиционированную таблицу и отдельные партиции для каждого дня
 */
async function runMigration() {
  console.log('# Запуск миграции: Автоматическое партиционирование таблицы transactions');
  
  // Проверяем наличие необходимых переменных окружения
  if (!process.env.DATABASE_URL) {
    throw new Error('Отсутствует обязательная переменная окружения DATABASE_URL');
  }
  
  // Создаем подключение к базе данных
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    // Создаем временную директорию для хранения бэкапов
    const backupDir = path.join(__dirname, '../backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    console.log('Шаг 1: Проверка наличия таблицы transactions...');
    
    const tableExistsResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'transactions'
      );
    `);
    
    const tableExists = tableExistsResult.rows[0].exists;
    
    if (!tableExists) {
      console.log('Таблица transactions не существует. Создаем новую партиционированную таблицу.');
      
      // Создаем таблицу transactions с партиционированием по дате
      await pool.query(`
        CREATE TABLE transactions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          amount NUMERIC(20, 9) NOT NULL,
          type VARCHAR(50) NOT NULL,
          details JSONB DEFAULT '{}',
          wallet_address VARCHAR(100),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        ) PARTITION BY RANGE (created_at);
      `);
      
      console.log('Таблица transactions успешно создана с партиционированием по дате.');
    } else {
      console.log('Таблица transactions уже существует. Проверяем, является ли она партиционированной...');
      
      // Проверяем, является ли таблица transactions партиционированной
      const isPartitionedResult = await pool.query(`
        SELECT partrelid::regclass AS parent_table
        FROM pg_partitioned_table pt
        JOIN pg_class pc ON pt.partrelid = pc.oid
        JOIN pg_namespace pn ON pc.relnamespace = pn.oid
        WHERE pn.nspname = 'public' AND pc.relname = 'transactions';
      `);
      
      const isPartitioned = isPartitionedResult.rows.length > 0;
      
      if (isPartitioned) {
        console.log('Таблица transactions уже является партиционированной. Пропускаем миграцию.');
        
        // Проверяем, есть ли партиции для последних дней
        await createPartitionsForDateRange();
        return;
      } else {
        console.log('Таблица transactions не является партиционированной. Создаем резервную копию...');
        
        // Создаем временную резервную копию существующей таблицы
        await pool.query(`CREATE TABLE transactions_backup AS SELECT * FROM transactions;`);
        
        console.log('Резервная копия создана. Подсчитываем количество транзакций...');
        
        const countResult = await pool.query('SELECT COUNT(*) FROM transactions_backup;');
        const transactionCount = parseInt(countResult.rows[0].count, 10);
        
        console.log(`Резервная копия содержит ${transactionCount} транзакций.`);
        
        // Сохраняем структуру исходной таблицы для восстановления в случае ошибки
        console.log('Сохраняем схему оригинальной таблицы...');
        
        const schemaResult = await pool.query(`
          SELECT column_name, data_type, character_maximum_length, is_nullable
          FROM information_schema.columns
          WHERE table_name = 'transactions' AND table_schema = 'public'
          ORDER BY ordinal_position;
        `);
        
        // Сохраняем схему в файл
        const schemaFilePath = path.join(backupDir, 'transactions_schema.json');
        fs.writeFileSync(schemaFilePath, JSON.stringify(schemaResult.rows, null, 2), 'utf8');
        
        console.log(`Схема оригинальной таблицы сохранена в ${schemaFilePath}.`);
        
        // Удаляем исходную таблицу
        await pool.query('DROP TABLE transactions;');
        
        console.log('Исходная таблица удалена. Создаем новую партиционированную таблицу...');
        
        // Создаем новую партиционированную таблицу
        await pool.query(`
          CREATE TABLE transactions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            amount NUMERIC(20, 9) NOT NULL,
            type VARCHAR(50) NOT NULL,
            details JSONB DEFAULT '{}',
            wallet_address VARCHAR(100),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          ) PARTITION BY RANGE (created_at);
        `);
        
        console.log('Партиционированная таблица transactions создана.');
      }
    }
    
    // Создаем партиции для дат
    await createPartitionsForDateRange();
    
    // Если у нас была бэкап-таблица, переносим данные
    const backupTableExists = await checkTableExists('transactions_backup');
    
    if (backupTableExists) {
      console.log('Переносим данные из резервной копии в новую партиционированную таблицу...');
      
      // Собираем уникальные даты из бэкапа
      const uniqueDatesResult = await pool.query(`
        SELECT DISTINCT DATE(created_at) as date
        FROM transactions_backup
        ORDER BY date;
      `);
      
      const uniqueDates = uniqueDatesResult.rows.map(row => row.date);
      console.log(`Найдено ${uniqueDates.length} уникальных дат в данных.`);
      
      // Создаем партиции для всех дат из бэкапа, если их еще нет
      for (const dateStr of uniqueDates) {
        const date = new Date(dateStr);
        const formattedDate = format(date, 'yyyy_MM_dd');
        const partitionName = `transactions_${formattedDate}`;
        
        // Проверяем, существует ли уже партиция
        const partitionExists = await checkTableExists(partitionName);
        
        if (!partitionExists) {
          // Получаем следующий день для ограничения диапазона
          const nextDate = new Date(date);
          nextDate.setDate(nextDate.getDate() + 1);
          
          console.log(`Создаем партицию ${partitionName} для даты ${dateStr}...`);
          
          await pool.query(`
            CREATE TABLE ${partitionName} PARTITION OF transactions
            FOR VALUES FROM ('${format(date, 'yyyy-MM-dd')}') TO ('${format(nextDate, 'yyyy-MM-dd')}');
          `);
          
          // Создаем индексы на партиции для повышения производительности
          await pool.query(`CREATE INDEX ${partitionName}_user_id_idx ON ${partitionName} (user_id);`);
          await pool.query(`CREATE INDEX ${partitionName}_type_idx ON ${partitionName} (type);`);
          await pool.query(`CREATE INDEX ${partitionName}_created_at_idx ON ${partitionName} (created_at);`);
          
          console.log(`Партиция ${partitionName} создана с индексами.`);
        } else {
          console.log(`Партиция ${partitionName} уже существует.`);
        }
      }
      
      // Вставляем данные из бэкапа в партиционированную таблицу
      console.log('Вставляем данные из резервной копии...');
      
      await pool.query(`
        INSERT INTO transactions (id, user_id, amount, type, details, wallet_address, created_at)
        SELECT id, user_id, amount, type, details, wallet_address, created_at
        FROM transactions_backup;
      `);
      
      console.log('Данные успешно перенесены в партиционированную таблицу.');
      
      // Проверка соответствия количества строк
      const newCountResult = await pool.query('SELECT COUNT(*) FROM transactions;');
      const newTransactionCount = parseInt(newCountResult.rows[0].count, 10);
      
      const backupCountResult = await pool.query('SELECT COUNT(*) FROM transactions_backup;');
      const backupTransactionCount = parseInt(backupCountResult.rows[0].count, 10);
      
      if (newTransactionCount === backupTransactionCount) {
        console.log(`Перенос данных успешно завершен. Перенесено ${newTransactionCount} записей.`);
        
        // Создаем временную копию backup таблицы в архивную
        console.log('Создаем архивную копию исходной таблицы...');
        await pool.query('CREATE TABLE transactions_archive AS SELECT * FROM transactions_backup;');
        
        // Удаляем временную бэкап-таблицу
        console.log('Удаляем временную резервную копию...');
        await pool.query('DROP TABLE transactions_backup;');
        
        console.log('Временная резервная копия удалена.');
      } else {
        console.error(`ОШИБКА: Количество записей не совпадает! В оригинале: ${backupTransactionCount}, перенесено: ${newTransactionCount}`);
        console.error('Оставляем резервную копию для ручного восстановления. Таблица: transactions_backup');
      }
    }
    
    console.log('# Миграция завершена успешно: Автоматическое партиционирование таблицы transactions.');
    
  } catch (error: any) {
    console.error('# ОШИБКА при выполнении миграции партиционирования транзакций:', error.message);
    
    // Пытаемся восстановить исходную таблицу, если что-то пошло не так
    try {
      // Проверяем наличие backup-таблицы
      const backupExists = await checkTableExists('transactions_backup');
      
      if (backupExists) {
        // Проверяем, существует ли основная таблица
        const mainTableExists = await checkTableExists('transactions');
        
        if (mainTableExists) {
          // Переименовываем текущую таблицу в проблемную
          await pool.query('ALTER TABLE transactions RENAME TO transactions_failed;');
          console.log('Текущая таблица переименована в transactions_failed.');
        }
        
        // Восстанавливаем из бэкапа
        await pool.query('ALTER TABLE transactions_backup RENAME TO transactions;');
        console.log('Данные восстановлены из резервной копии.');
      }
    } catch (restoreError: any) {
      console.error('КРИТИЧЕСКАЯ ОШИБКА при попытке восстановления:', restoreError.message);
      console.error('Возможно потребуется ручное восстановление из таблицы transactions_backup или transactions_archive!');
    }
    
    throw error;
  } finally {
    // Закрываем соединение с базой данных
    await pool.end();
  }
  
  // Вспомогательная функция для проверки существования таблицы
  async function checkTableExists(tableName: string): Promise<boolean> {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = $1
      );
    `, [tableName]);
    
    return result.rows[0].exists;
  }
  
  // Функция для создания партиций для последних и будущих дат
  async function createPartitionsForDateRange() {
    console.log('Создаем партиции для последних и будущих дат...');
    
    const today = new Date();
    const daysToCreate = 30; // Создаем партиции на 30 дней вперед и 7 дней назад
    
    // Создаем партиции для предыдущих дней
    for (let i = 7; i >= 0; i--) {
      const date = subDays(today, i);
      const formattedDate = format(date, 'yyyy_MM_dd');
      const partitionName = `transactions_${formattedDate}`;
      
      // Проверяем, существует ли уже партиция
      const partitionExists = await checkTableExists(partitionName);
      
      if (!partitionExists) {
        // Получаем следующий день для ограничения диапазона
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        
        console.log(`Создаем партицию ${partitionName} для даты ${format(date, 'yyyy-MM-dd')}...`);
        
        await pool.query(`
          CREATE TABLE ${partitionName} PARTITION OF transactions
          FOR VALUES FROM ('${format(date, 'yyyy-MM-dd')}') TO ('${format(nextDate, 'yyyy-MM-dd')}');
        `);
        
        // Создаем индексы на партиции для повышения производительности
        await pool.query(`CREATE INDEX ${partitionName}_user_id_idx ON ${partitionName} (user_id);`);
        await pool.query(`CREATE INDEX ${partitionName}_type_idx ON ${partitionName} (type);`);
        await pool.query(`CREATE INDEX ${partitionName}_created_at_idx ON ${partitionName} (created_at);`);
        
        console.log(`Партиция ${partitionName} создана с индексами.`);
      } else {
        console.log(`Партиция ${partitionName} уже существует.`);
      }
    }
    
    // Создаем партиции для будущих дней
    for (let i = 1; i <= daysToCreate; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      
      const formattedDate = format(date, 'yyyy_MM_dd');
      const partitionName = `transactions_${formattedDate}`;
      
      // Проверяем, существует ли уже партиция
      const partitionExists = await checkTableExists(partitionName);
      
      if (!partitionExists) {
        // Получаем следующий день для ограничения диапазона
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        
        console.log(`Создаем партицию ${partitionName} для даты ${format(date, 'yyyy-MM-dd')}...`);
        
        await pool.query(`
          CREATE TABLE ${partitionName} PARTITION OF transactions
          FOR VALUES FROM ('${format(date, 'yyyy-MM-dd')}') TO ('${format(nextDate, 'yyyy-MM-dd')}');
        `);
        
        // Создаем индексы на партиции для повышения производительности
        await pool.query(`CREATE INDEX ${partitionName}_user_id_idx ON ${partitionName} (user_id);`);
        await pool.query(`CREATE INDEX ${partitionName}_type_idx ON ${partitionName} (type);`);
        await pool.query(`CREATE INDEX ${partitionName}_created_at_idx ON ${partitionName} (created_at);`);
        
        console.log(`Партиция ${partitionName} создана с индексами.`);
      } else {
        console.log(`Партиция ${partitionName} уже существует.`);
      }
    }
    
    console.log(`Создано или проверено наличие партиций на ${daysToCreate + 8} дней.`);
  }
}

// Экспортируем функцию миграции по умолчанию
export default runMigration;

// Если скрипт запущен напрямую, выполняем миграцию
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('Миграция успешно выполнена');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Ошибка при выполнении миграции:', error);
      process.exit(1);
    });
}