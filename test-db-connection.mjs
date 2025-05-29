/**
 * Скрипт для тестирования подключения к базе данных
 * Запускает проверку соединения с PostgreSQL
 */

// Импортируем Pool из pg
import { Pool } from 'pg';

// Функция для форматирования информации
const formatDatabaseConfig = (config) => {
  const { host, port, user, database, connectionString } = config;
  
  if (connectionString) {
    // Маскируем пароль для безопасности
    return connectionString.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
  }
  
  return `Host: ${host}, Port: ${port}, User: ${user}, Database: ${database}`;
};

// Объявляем функцию для тестирования соединения
const testDatabaseConnection = async (config, label = 'Unnamed') => {
  console.log(`\n🔍 Проверка соединения [${label}]...`);
  console.log(`📝 Настройки: ${formatDatabaseConfig(config)}`);
  
  const pool = new Pool(config);
  
  try {
    // Тестовое подключение
    console.log('🔄 Выполнение подключения...');
    const client = await pool.connect();
    console.log('✅ Подключение установлено успешно');
    
    // Тестовый запрос
    console.log('🔄 Выполнение тестового запроса...');
    const result = await client.query('SELECT current_timestamp as time, current_database() as db_name');
    console.log('✅ Запрос выполнен успешно');
    console.log('📊 Результат запроса:');
    console.log(`  Текущее время сервера: ${result.rows[0].time}`);
    console.log(`  Текущая база данных: ${result.rows[0].db_name}`);
    
    // Получение списка таблиц
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    if (tables.rows.length > 0) {
      console.log(`✅ Найдено ${tables.rows.length} таблиц в базе данных:`);
      tables.rows.forEach((row, index) => {
        console.log(`  ${index + 1}. ${row.table_name}`);
      });
    } else {
      console.log('ℹ️ Таблицы не найдены. База данных пуста или требуется миграция.');
    }
    
    // Освобождение соединения
    client.release();
    await pool.end();
    
    console.log(`✅ ИТОГ: Соединение [${label}] установлено успешно\n`);
    return true;
  } catch (error) {
    console.error(`❌ Ошибка при подключении [${label}]:`, error.message);
    if (error.code) {
      console.error(`📌 Код ошибки: ${error.code}`);
    }
    
    try {
      await pool.end();
    } catch (endError) {
      // Игнорируем ошибку закрытия пула
    }
    
    console.log(`❌ ИТОГ: Соединение [${label}] не удалось\n`);
    return false;
  }
};

// Основная функция для запуска всех тестов
const runAllTests = async () => {
  console.log('🚀 Запуск тестирования подключений к базе данных...\n');
  
  let results = [];
  
  // Тест 1: Локальная база данных Replit
  results.push({
    name: 'Локальная PostgreSQL на Replit',
    success: await testDatabaseConnection({
      host: 'localhost',
      port: 5432,
      user: 'runner',
      password: '',
      database: 'postgres',
    }, 'Локальная PostgreSQL')
  });
  
  // Тест 2: База данных из переменных окружения
  if (process.env.DATABASE_URL) {
    results.push({
      name: 'Внешняя БД (DATABASE_URL)',
      success: await testDatabaseConnection({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
      }, 'DATABASE_URL')
    });
  } else {
    console.log('ℹ️ Переменная DATABASE_URL не найдена, тест пропущен');
    results.push({
      name: 'Внешняя БД (DATABASE_URL)',
      success: false,
      reason: 'DATABASE_URL не найден'
    });
  }
  
  // Выводим итоговый отчет
  console.log('\n📋 ИТОГОВЫЙ ОТЧЕТ:');
  results.forEach((result, index) => {
    console.log(`  ${index + 1}. ${result.name}: ${result.success ? '✅ УСПЕХ' : '❌ НЕУДАЧА'} ${result.reason ? `(${result.reason})` : ''}`);
  });
  
  const successCount = results.filter(r => r.success).length;
  console.log(`\n📊 ИТОГО: Успешно ${successCount} из ${results.length} тестов`);
  
  if (successCount === 0) {
    console.log('\n💡 РЕКОМЕНДАЦИИ:');
    console.log('  1. Проверьте, запущен ли сервис PostgreSQL в вашем Replit');
    console.log('  2. Перезапустите Replit или создайте новую базу данных PostgreSQL в интерфейсе Replit');
    console.log('  3. Установите вручную переменные окружения для подключения к базе данных');
  }
};

// Запускаем тестирование
runAllTests();