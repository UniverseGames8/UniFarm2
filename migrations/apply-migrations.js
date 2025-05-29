import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Загрузка переменных окружения
dotenv.config();

// Получение текущей директории
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL не указан. Убедитесь, что база данных настроена.');
  }

  console.log('🔌 Подключение к базе данных...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('✅ Соединение с базой данных установлено');
    console.log('🚀 Запуск миграций...');

    // Чтение SQL-файла
    const sqlFilePath = path.join(__dirname, '0000_create_tables.sql');
    console.log(`📂 Чтение файла миграции: ${sqlFilePath}`);
    
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    console.log('📝 SQL миграция успешно прочитана');

    // Выполнение SQL-запросов
    await pool.query(sqlContent);
    console.log('✅ SQL миграция успешно выполнена');

    // Обновление журнала миграций (если нужно в будущем)
    console.log('📝 Обновление журнала миграций...');
    const journalPath = path.join(__dirname, 'meta', '_journal.json');
    const journalData = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
    
    // Проверка, есть ли уже запись о миграции
    const migrationExists = journalData.entries.some(entry => entry.version === '0000');
    
    if (!migrationExists) {
      journalData.entries.push({
        idx: journalData.entries.length,
        version: '0000',
        when: Date.now().toString(),
        tag: 'create_tables',
        breakpoints: false
      });
      
      fs.writeFileSync(journalPath, JSON.stringify(journalData, null, 2));
      console.log('✅ Журнал миграций обновлен');
    } else {
      console.log('✅ Запись о миграции уже существует в журнале');
    }

    console.log('✨ Миграции успешно выполнены');
  } catch (error) {
    console.error('❌ Ошибка при выполнении миграций:', error);
    throw error;
  } finally {
    await pool.end();
    console.log('🔌 Соединение с базой данных закрыто');
  }
}

// Запуск миграций
main()
  .then(() => {
    console.log('✨ База данных успешно инициализирована');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка при инициализации базы данных:', error);
    process.exit(1);
  });