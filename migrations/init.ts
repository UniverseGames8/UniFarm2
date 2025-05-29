import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL не указан. Убедитесь, что база данных настроена.');
  }

  console.log('🔌 Подключение к базе данных...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  console.log('✅ Соединение с базой данных установлено');
  console.log('🚀 Запуск миграций...');

  // Инициализируем Drizzle с соединением к базе данных
  const db = drizzle(pool);

  // Выполняем миграции
  await migrate(db, { migrationsFolder: 'migrations' });

  console.log('✅ Миграции выполнены успешно');
  await pool.end();
}

// Запускаем миграции и обрабатываем ошибки
main()
  .then(() => {
    console.log('✨ База данных успешно инициализирована');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка при инициализации базы данных:', error);
    process.exit(1);
  });