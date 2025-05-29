/**
 * Скрипт для создания .env.neon с настройками для Neon DB
 * 
 * Создает файл .env.neon с настройками для подключения к Neon DB
 */

const fs = require('fs');

// Проверка существования файла .env.neon
if (fs.existsSync('.env.neon')) {
  console.log('\x1b[33m⚠️ Файл .env.neon уже существует. Создать новый? (y/n)\x1b[0m');
  // В интерактивном режиме здесь был бы запрос на подтверждение
  // В скрипте просто выводим сообщение и продолжаем
  console.log('\x1b[33m👉 Продолжаем без подтверждения (не интерактивный режим)\x1b[0m');
}

// Получаем строку подключения к Neon DB из аргументов или запрашиваем ввод
const args = process.argv.slice(2);
let dbUrl = '';

if (args.length > 0 && args[0].includes('neon.tech')) {
  dbUrl = args[0];
  console.log(`\x1b[32m✅ Использую предоставленную строку подключения: ${dbUrl.replace(/:[^:]*@/, ':***@')}\x1b[0m`);
} else {
  console.log('\x1b[33m⚠️ Строка подключения к Neon DB не предоставлена через аргументы\x1b[0m');
  console.log('\x1b[33m👉 Для подключения к Neon DB необходима строка вида:\x1b[0m');
  console.log('\x1b[33m   postgresql://username:password@ep-example-id.region.aws.neon.tech/dbname?sslmode=require\x1b[0m');
  
  // В интерактивном режиме здесь был бы запрос на ввод строки подключения
  // В скрипте используем шаблон для примера
  dbUrl = 'postgresql://neondb_owner:your_password@ep-example-id.region.aws.neon.tech/neondb?sslmode=require';
  console.log('\x1b[33m👉 Использую шаблонную строку подключения (замените на реальную в файле .env.neon)\x1b[0m');
}

// Создаем содержимое файла .env.neon
const envContent = `# Настройки подключения к Neon DB
# Создано скриптом create-neon-env.cjs ${new Date().toISOString()}

# Строка подключения к Neon DB
DATABASE_URL=${dbUrl}

# Принудительное использование Neon DB
FORCE_NEON_DB=true
DISABLE_REPLIT_DB=true
OVERRIDE_DB_PROVIDER=neon
DATABASE_PROVIDER=neon
USE_LOCAL_DB_ONLY=false

# Другие переменные окружения
NODE_ENV=production
PORT=3000

# Токен для Telegram Bot (если используется)
# TELEGRAM_BOT_TOKEN=your_bot_token_here
`;

// Записываем файл
fs.writeFileSync('.env.neon', envContent);
console.log('\x1b[32m✅ Файл .env.neon успешно создан!\x1b[0m');

// Инструкции по запуску
console.log('\n\x1b[34m📋 Инструкции по использованию:\x1b[0m');
console.log('\x1b[34m1. Отредактируйте файл .env.neon и замените строку подключения на реальную\x1b[0m');
console.log('\x1b[34m2. Для переключения на Neon DB выполните: ./switch-db-config.sh neon\x1b[0m');
console.log('\x1b[34m3. Для запуска приложения с Neon DB выполните: ./start-with-neon.sh\x1b[0m');