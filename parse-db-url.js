/**
 * Скрипт для анализа строки подключения DATABASE_URL
 */

// Получаем строку подключения
const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('❌ Переменная DATABASE_URL не установлена');
  process.exit(1);
}

// Маскируем пароль для безопасного вывода
const maskedUrl = dbUrl.replace(/:[^:]*@/, ':****@');

console.log('📊 Анализ строки подключения DATABASE_URL:');
console.log(`Полный URL (с маскированным паролем): ${maskedUrl}`);

// Парсинг URL
try {
  // Создаем URL объект для разбора компонентов
  // Нужно заменить postgresql:// на https:// для корректного парсинга
  const parsedUrl = new URL(dbUrl.replace(/^postgresql:\/\//, 'https://'));
  
  console.log('\n🔍 Компоненты URL:');
  console.log(`Протокол: postgresql://`);
  console.log(`Хост: ${parsedUrl.hostname}`);
  console.log(`Порт: ${parsedUrl.port || '5432 (по умолчанию)'}`);
  console.log(`Путь (база данных): ${parsedUrl.pathname.substring(1)}`);
  console.log(`Пользователь: ${parsedUrl.username}`);
  console.log(`Пароль: [СКРЫТ]`);
  
  // Параметры запроса
  console.log('\n🔧 Параметры запроса:');
  for (const [key, value] of parsedUrl.searchParams) {
    console.log(`${key}: ${value}`);
  }
  
  // Проверка на наличие необходимых параметров SSL
  console.log('\n🔒 Проверка SSL параметров:');
  const sslmode = parsedUrl.searchParams.get('sslmode');
  if (sslmode) {
    console.log(`sslmode: ${sslmode}`);
  } else {
    console.log('⚠️ Параметр sslmode отсутствует в URL');
  }
  
  // Рекомендации
  console.log('\n💡 Рекомендации:');
  if (!sslmode || sslmode !== 'require') {
    console.log('- Добавьте параметр sslmode=require в URL для безопасного подключения');
  }
  
  // Проверка формата хоста для Neon
  if (!parsedUrl.hostname.includes('neon.tech')) {
    console.log('⚠️ Хост не содержит домен neon.tech. Проверьте правильность URL.');
  } else {
    console.log('✓ Формат хоста соответствует Neon.');
  }
  
} catch (error) {
  console.error('❌ Ошибка при парсинге URL:', error.message);
}