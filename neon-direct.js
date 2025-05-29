/**
 * Прямой запуск с использованием Neon DB, минуя db-selector
 */

// Устанавливаем переменные окружения
process.env.DATABASE_PROVIDER = 'neon';
process.env.FORCE_NEON_DB = 'true';
process.env.DISABLE_REPLIT_DB = 'true'; 
process.env.OVERRIDE_DB_PROVIDER = 'neon';
process.env.NODE_ENV = 'production';

import('./server/db')
  .then(module => {
    console.log('✅ Модуль Neon DB успешно импортирован');
    
    // Проверка соединения с Neon DB перед запуском приложения
    module.testDatabaseConnection()
      .then(result => {
        if (result) {
          console.log('✅ Соединение с Neon DB успешно установлено');
          
          // Импортируем и запускаем основной модуль
          import('./server/index.js')
            .then(() => {
              console.log('✅ Приложение успешно запущено с Neon DB');
            })
            .catch(err => {
              console.error('❌ Ошибка при запуске приложения:', err);
              process.exit(1);
            });
        } else {
          console.error('❌ Не удалось подключиться к Neon DB');
          process.exit(1);
        }
      })
      .catch(err => {
        console.error('❌ Ошибка при проверке соединения с Neon DB:', err);
        process.exit(1);
      });
  })
  .catch(err => {
    console.error('❌ Ошибка при импорте модуля Neon DB:', err);
    process.exit(1);
  });