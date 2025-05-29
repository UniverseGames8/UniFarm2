/**
 * Утилита для выполнения миграции guest_id
 * Запускает добавление поля guest_id в таблицу users и заполняет его для существующих пользователей
 * 
 * Запуск: node migrate-guest-id.js
 */

// Используем глобальный fetch (доступен в Node.js >=18)

// Функция для выполнения HTTP-запроса
async function makeRequest() {
  try {
    console.log('Запуск миграции guest_id...');
    
    // Определяем URL для запроса
    const baseUrl = process.env.API_URL || 'https://uni-farm-connect-x-lukyanenkolawfa.replit.appsisko.replit.dev';
    const url = `${baseUrl}/api/migrations/add-guest-id`;
    
    // Выполняем POST-запрос к API
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        confirmMigration: true
      })
    });
    
    // Получаем результат
    const result = await response.json();
    
    // Выводим результат
    if (result.success) {
      console.log('✅ Миграция успешно выполнена!');
      console.log('Сообщение:', result.message);
    } else {
      console.error('❌ Ошибка при выполнении миграции:');
      console.error(result.message || 'Неизвестная ошибка');
      if (result.error) {
        console.error('Детали ошибки:', result.error);
      }
    }
  } catch (error) {
    console.error('❌ Ошибка при выполнении запроса:', error.message);
    console.error('Убедитесь, что сервер запущен и доступен.');
  }
}

// Запускаем функцию
makeRequest().catch(error => {
  console.error('Критическая ошибка:', error);
  process.exit(1);
});