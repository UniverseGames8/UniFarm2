/**
 * Скрипт для запуска приложения с подключением к Neon DB
 * и проверки работоспособности всех компонентов
 */

import 'dotenv/config';
import { spawn } from 'child_process';
import { createInterface } from 'readline';

// Цвета для консоли
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// Настраиваем окружение для принудительного использования Neon DB
process.env.DATABASE_PROVIDER = 'neon';
process.env.USE_LOCAL_DB_ONLY = 'false';
process.env.FORCE_NEON_DB = 'true';

let appProcess = null;

// Функция для тестирования API endpoints
async function testEndpoints(baseUrl = 'https://uni-farm-connect-x-lukyanenkolawfa.replit.app') {
  log('🔍 Тестируем API endpoints...', colors.blue);
  
  const endpoints = [
    { path: '/api/system/status', description: 'Статус системы' },
    { path: '/api/auth/check', description: 'Проверка аутентификации' },
    { path: '/api/users/count', description: 'Количество пользователей' },
    { path: '/api/farming/status', description: 'Статус фарминга' },
  ];
  
  for (const endpoint of endpoints) {
    try {
      log(`Тестируем: ${endpoint.description} (${endpoint.path})`, colors.cyan);
      const response = await fetch(`${baseUrl}${endpoint.path}`);
      const data = await response.json();
      
      log(`✅ Статус: ${response.status} ${response.statusText}`, colors.green);
      log(`Ответ: ${JSON.stringify(data, null, 2)}`, colors.reset);
    } catch (err) {
      log(`❌ Ошибка при обращении к ${endpoint.path}: ${err.message}`, colors.red);
    }
  }
}

// Функция для запуска приложения
function startApp() {
  return new Promise((resolve, reject) => {
    log('🚀 Запуск приложения с подключением к Neon DB...', colors.magenta);
    
    const env = { ...process.env };
    appProcess = spawn('node', ['dist/index.js'], { env, stdio: 'pipe' });
    
    // Обработка вывода
    appProcess.stdout.on('data', (data) => {
      const output = data.toString();
      process.stdout.write(output);
      
      // Проверяем запуск сервера
      if (output.includes('Server is listening') || output.includes('Server running on port')) {
        log('\n✅ Приложение успешно запущено', colors.green);
        resolve(true);
      }
    });
    
    // Обработка ошибок
    appProcess.stderr.on('data', (data) => {
      const output = data.toString();
      process.stderr.write(`${colors.red}${output}${colors.reset}`);
      
      // Проверяем критические ошибки
      if (output.includes('FATAL ERROR') || output.includes('connection error')) {
        log('\n❌ Критическая ошибка при запуске приложения', colors.red);
        reject(new Error('Failed to start server'));
      }
    });
    
    // Обработка завершения процесса
    appProcess.on('close', (code) => {
      if (code !== 0 && code !== null) {
        log(`\n❌ Приложение завершилось с кодом ${code}`, colors.red);
        reject(new Error(`Process exited with code ${code}`));
      } else {
        log('\nПриложение завершило работу', colors.yellow);
        resolve(false);
      }
    });
    
    // Таймаут на случай, если приложение не запустится
    setTimeout(() => {
      resolve(true); // Предполагаем, что всё OK, если нет явных ошибок
    }, 10000);
  });
}

// Функция для чистой остановки и выхода
function cleanupAndExit() {
  log('\nОстановка приложения...', colors.yellow);
  
  if (appProcess && !appProcess.killed) {
    appProcess.kill();
    appProcess = null;
  }
  
  log('Выход из скрипта', colors.yellow);
  process.exit(0);
}

// Обработка сигналов завершения
process.on('SIGINT', cleanupAndExit);
process.on('SIGTERM', cleanupAndExit);

// Главная функция
async function main() {
  // Проверяем настройки Neon DB
  if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes('neon')) {
    log('❌ Ошибка: DATABASE_URL не настроен для Neon DB', colors.red);
    log('Убедитесь, что в файле .env указан правильный URL для Neon DB', colors.yellow);
    process.exit(1);
  }
  
  log('🔌 Используем подключение к Neon DB:', colors.blue);
  log(`URL: ${process.env.DATABASE_URL.replace(/:[^:]*@/, ':***@')}`, colors.reset);
  
  try {
    // Запускаем приложение
    const serverStarted = await startApp();
    
    if (serverStarted) {
      // Даем приложению немного времени на инициализацию
      log('⏳ Ожидаем полной инициализации приложения...', colors.yellow);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Тестируем API endpoints
      await testEndpoints();
      
      // Создаем интерфейс readline для обработки команд пользователя
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: 'UniFarm> '
      });
      
      log('\n📋 Доступные команды:', colors.magenta);
      log('  test - протестировать API endpoints', colors.reset);
      log('  exit - завершить работу', colors.reset);
      
      rl.prompt();
      
      rl.on('line', async (line) => {
        const command = line.trim();
        
        if (command === 'test') {
          await testEndpoints();
        } else if (command === 'exit') {
          rl.close();
          cleanupAndExit();
        } else {
          log(`Неизвестная команда: ${command}`, colors.yellow);
          log('Доступные команды: test, exit', colors.yellow);
        }
        
        rl.prompt();
      });
      
      rl.on('close', () => {
        cleanupAndExit();
      });
    } else {
      log('❌ Не удалось запустить приложение', colors.red);
      process.exit(1);
    }
  } catch (err) {
    log(`❌ Критическая ошибка: ${err.message}`, colors.red);
    process.exit(1);
  }
}

// Запускаем главную функцию
main().catch(err => {
  log(`Непредвиденная ошибка: ${err.message}`, colors.red);
  process.exit(1);
});