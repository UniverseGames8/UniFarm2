/**
 * Скрипт для автоматического создания партиций на будущие даты
 * 
 * Этот скрипт предназначен для регулярного запуска через cron-задание
 * или другой планировщик задач для поддержания актуальности партиций.
 */

import { partitionServiceInstance } from '../services/partitionServiceInstance';
import { db, wrappedPool } from '../db';
import { format, addDays, parseISO } from 'date-fns';

// Функция-обертка для запросов к базе данных
async function dbQuery(text: string, params: any[] = []) {
  return await wrappedPool.query(text, params);
}

/**
 * Логирует сообщение
 */
function log(message: string) {
  console.log(`[${new Date().toISOString()}] [PartitionScheduler] ${message}`);
}

/**
 * Проверяет наличие и обновляет партицию transactions_future
 */
async function checkAndFixFuturePartition() {
  try {
    // Получаем список существующих партиций
    log('Проверка партиции transactions_future...');
    const partitions = await partitionServiceInstance.getPartitionsList();
    const futurePartition = partitions.find(p => p.partition_name === 'transactions_future');
    
    if (!futurePartition) {
      log('Партиция transactions_future не найдена. Будет создана.');
      
      // Создаем новую future партицию с датой через 10 дней
      const futureDate = addDays(new Date(), 10);
      const futureDateStr = format(futureDate, 'yyyy-MM-dd');
      
      log(`Создание партиции transactions_future с датой начала ${futureDateStr}...`);
      
      await dbQuery(`
        CREATE TABLE transactions_future
        PARTITION OF transactions
        FOR VALUES FROM ('${futureDateStr}') TO (MAXVALUE)
      `, []);
      
      await dbQuery(`CREATE INDEX transactions_future_user_id_idx ON transactions_future (user_id)`, []);
      await dbQuery(`CREATE INDEX transactions_future_type_idx ON transactions_future (type)`, []);
      await dbQuery(`CREATE INDEX transactions_future_created_at_idx ON transactions_future (created_at)`, []);
      
      log('Партиция transactions_future успешно создана.');
      return true;
    }
    
    // Проверяем выражение партиции
    const expression = futurePartition.partition_expression || '';
    const datePattern = /FROM\s+\('([^']+)'\)/i;
    const matches = expression.match(datePattern);
    
    if (!matches || !matches[1]) {
      log('Невозможно определить дату начала партиции transactions_future.');
      return false;
    }
    
    const startDateStr = matches[1];
    log(`Текущая партиция transactions_future начинается с даты ${startDateStr}`);
    
    // Проверяем, нужно ли обновить партицию
    const startDate = parseISO(startDateStr);
    const today = new Date();
    const daysUntilStart = Math.floor((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    log(`Дней до начала партиции transactions_future: ${daysUntilStart}`);
    
    if (daysUntilStart > 10) {
      log('Партиция transactions_future корректна, обновление не требуется.');
      return true;
    }
    
    if (daysUntilStart < 3) {
      log(`Срочно! До начала партиции transactions_future осталось ${daysUntilStart} дней.`);
    }
    
    // Обновляем партицию
    const newFutureDate = addDays(today, 10);
    const newFutureDateStr = format(newFutureDate, 'yyyy-MM-dd');
    
    log(`Обновление партиции transactions_future с новой датой начала ${newFutureDateStr}...`);
    
    await dbQuery(`ALTER TABLE transactions DETACH PARTITION transactions_future`, []);
    await dbQuery(`DROP TABLE IF EXISTS transactions_future`, []);
    
    await dbQuery(`
      CREATE TABLE transactions_future
      PARTITION OF transactions
      FOR VALUES FROM ('${newFutureDateStr}') TO (MAXVALUE)
    `, []);
    
    await dbQuery(`CREATE INDEX transactions_future_user_id_idx ON transactions_future (user_id)`, []);
    await dbQuery(`CREATE INDEX transactions_future_type_idx ON transactions_future (type)`, []);
    await dbQuery(`CREATE INDEX transactions_future_created_at_idx ON transactions_future (created_at)`, []);
    
    log('Партиция transactions_future успешно обновлена.');
    return true;
  } catch (error) {
    log(`Ошибка при проверке/обновлении партиции transactions_future: ${error}`);
    return false;
  }
}

/**
 * Создает недостающие партиции до начала transactions_future
 */
async function createMissingPartitions() {
  try {
    log('Создание недостающих партиций...');
    
    // Находим дату начала transactions_future
    const partitions = await partitionServiceInstance.getPartitionsList();
    const futurePartition = partitions.find(p => p.partition_name === 'transactions_future');
    
    if (!futurePartition || !futurePartition.partition_expression) {
      log('Невозможно определить дату начала transactions_future. Создаем партиции на 7 дней.');
      const result = await partitionServiceInstance.createFuturePartitions(7);
      log(`Создано ${result.createdCount} новых партиций.`);
      return true;
    }
    
    // Извлекаем дату начала
    const expression = futurePartition.partition_expression;
    const datePattern = /FROM\s+\('([^']+)'\)/i;
    const matches = expression.match(datePattern);
    
    if (!matches || !matches[1]) {
      log('Невозможно извлечь дату начала transactions_future. Создаем партиции на 7 дней.');
      const result = await partitionServiceInstance.createFuturePartitions(7);
      log(`Создано ${result.createdCount} новых партиций.`);
      return true;
    }
    
    const startDateStr = matches[1];
    const startDate = parseISO(startDateStr);
    const today = new Date();
    
    // Определяем количество дней, на которые нужно создать партиции
    const daysNeeded = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    log(`Необходимо создать партиции на ${daysNeeded} дней до начала transactions_future (${startDateStr}).`);
    
    if (daysNeeded <= 0) {
      log('Все необходимые партиции уже созданы.');
      return true;
    }
    
    // Создаем партиции
    let createdCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < daysNeeded; i++) {
      const date = addDays(today, i);
      const result = await partitionServiceInstance.createPartitionForDate(date);
      
      if (result.success) {
        createdCount++;
      } else {
        errorCount++;
        log(`Ошибка создания партиции для даты ${format(date, 'yyyy-MM-dd')}: ${result.error}`);
      }
    }
    
    log(`Создано ${createdCount} новых партиций, ошибок: ${errorCount}.`);
    return true;
  } catch (error) {
    log(`Ошибка при создании недостающих партиций: ${error}`);
    return false;
  }
}

/**
 * Основная функция для автоматического создания партиций
 */
async function runScheduledPartitioning() {
  try {
    log('Запуск автоматического создания партиций...');
    
    // 1. Проверяем и обновляем transactions_future при необходимости
    const futureFixed = await checkAndFixFuturePartition();
    
    if (!futureFixed) {
      log('Не удалось проверить/обновить партицию transactions_future.');
    }
    
    // 2. Создаем недостающие партиции
    const partitionsCreated = await createMissingPartitions();
    
    if (!partitionsCreated) {
      log('Не удалось создать недостающие партиции.');
    }
    
    // 3. Проверяем актуальное состояние партиций
    const partitions = await partitionServiceInstance.getPartitionsList();
    log(`В системе сейчас ${partitions.length} партиций.`);
    
    const partitionsStr = partitions.map(p => `- ${p.partition_name}`).join('\n');
    log(`Список партиций:\n${partitionsStr}`);
    
    log('Автоматическое создание партиций завершено.');
  } catch (error) {
    log(`Ошибка при выполнении автоматического создания партиций: ${error}`);
  }
}

// Запуск скрипта
runScheduledPartitioning()
  .then(() => {
    console.log('Задание планировщика партиций успешно завершено');
    process.exit(0);
  })
  .catch(error => {
    console.error('Ошибка выполнения планировщика партиций:', error);
    process.exit(1);
  });