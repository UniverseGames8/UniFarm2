/**
 * Скрипт для настройки переменных окружения для PostgreSQL на Replit
 * 
 * Этот скрипт перезаписывает файл .env с правильными настройками для
 * локальной PostgreSQL базы данных на Replit, удаляя все зависимости от Neon DB.
 */

import fs from 'fs';
import path from 'path';

// Путь к файлу .env
const envPath = path.resolve('.env');

// Новые переменные окружения для PostgreSQL на Replit
const newEnvVars = {
  // Строка подключения к базе данных
  'DATABASE_URL': 'postgresql://runner@localhost:5432/postgres',
  
  // Отдельные переменные для PostgreSQL
  'PGHOST': 'localhost',
  'PGPORT': '5432',
  'PGUSER': 'runner',
  'PGPASSWORD': '',
  'PGDATABASE': 'postgres',
  
  // Принудительно используем локальную базу данных
  'USE_LOCAL_DB_ONLY': 'true'
};

// Функция для чтения файла .env (если он существует)
function readEnvFile() {
  try {
    if (fs.existsSync(envPath)) {
      return fs.readFileSync(envPath, 'utf8');
    }
    return '';
  } catch (error) {
    console.error('❌ Ошибка чтения файла .env:', error);
    return '';
  }
}

// Функция для парсинга файла .env в объект
function parseEnvFile(content) {
  const envVars = {};
  
  if (!content) {
    return envVars;
  }
  
  const lines = content.split('\n');
  
  for (const line of lines) {
    // Пропускаем пустые строки и комментарии
    if (!line || line.startsWith('#')) {
      continue;
    }
    
    // Разбиваем строку на ключ и значение
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      
      // Сохраняем только если ключ не пустой
      if (key) {
        envVars[key] = value;
      }
    }
  }
  
  return envVars;
}

// Функция для обновления и записи файла .env
function updateEnvFile(currentEnvVars) {
  // Объединяем текущие переменные с новыми (новые имеют приоритет)
  const updatedEnvVars = {
    ...currentEnvVars,
    ...newEnvVars
  };
  
  // Фильтруем переменные, чтобы удалить связанные с Neon DB
  const filteredEnvVars = { ...updatedEnvVars };
  Object.keys(filteredEnvVars).forEach(key => {
    // Удаляем любые переменные, связанные с Neon DB
    if (key.includes('NEON') || 
        (filteredEnvVars[key] && typeof filteredEnvVars[key] === 'string' && 
         filteredEnvVars[key].includes('neon'))) {
      delete filteredEnvVars[key];
    }
  });
  
  // Формируем содержимое файла .env
  let envContent = '# Переменные окружения для PostgreSQL на Replit\n';
  envContent += '# Автоматически сгенерированы скриптом setup-replit-db-env.mjs\n';
  envContent += '# Последнее обновление: ' + new Date().toISOString() + '\n\n';
  
  // Добавляем переменные
  Object.entries(filteredEnvVars).forEach(([key, value]) => {
    envContent += `${key}=${value}\n`;
  });
  
  // Записываем файл
  try {
    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log('✅ Файл .env успешно обновлен');
    return true;
  } catch (error) {
    console.error('❌ Ошибка записи файла .env:', error);
    return false;
  }
}

// Функция для экспорта переменных окружения в текущей сессии
function exportEnvironmentVariables() {
  Object.entries(newEnvVars).forEach(([key, value]) => {
    process.env[key] = value;
  });
  
  console.log('✅ Переменные окружения экспортированы в текущую сессию');
}

// Главная функция
function main() {
  console.log('🔧 Настройка переменных окружения для PostgreSQL на Replit...');
  
  // Читаем текущий файл .env
  const currentContent = readEnvFile();
  const currentEnvVars = parseEnvFile(currentContent);
  
  // Обновляем файл .env
  const success = updateEnvFile(currentEnvVars);
  
  if (success) {
    // Экспортируем переменные в текущую сессию
    exportEnvironmentVariables();
    
    console.log('\n🏁 Настройка переменных окружения успешно завершена!');
    console.log('📊 Теперь приложение будет использовать только PostgreSQL на Replit');
    
    // Информация о настроенных переменных
    console.log('\n📋 Настроенные переменные окружения:');
    Object.entries(newEnvVars).forEach(([key, value]) => {
      console.log(`   ${key}=${value}`);
    });
    
    console.log('\n❗ Важно: Перезапустите приложение, чтобы изменения вступили в силу!');
  } else {
    console.error('\n❌ Не удалось обновить переменные окружения');
  }
}

// Запускаем основную функцию
main();