#!/usr/bin/env node
/**
 * CLI-утилита для управления Neon DB в проекте UniFarm
 * 
 * Предоставляет интерфейс для выполнения всех основных операций с Neon DB:
 * - Инициализация базы данных
 * - Тестирование подключения
 * - Запуск приложения с Neon DB
 * - Партиционирование таблиц
 * - Комплексное тестирование интеграции
 */

import { spawn } from 'child_process';
import fs from 'fs';
import { createInterface } from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';

// Получаем путь к текущему скрипту
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

// Вывод в консоль с цветами
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// Запуск скрипта с выводом логов в консоль
function runScript(scriptPath, args = []) {
  return new Promise((resolve, reject) => {
    const process = spawn('node', [scriptPath, ...args], {
      stdio: 'inherit'
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Скрипт завершился с кодом ${code}`));
      }
    });
    
    process.on('error', (error) => {
      reject(error);
    });
  });
}

// Создание интерфейса readline
function createReadline() {
  return createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

// Задать вопрос пользователю
function askQuestion(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Проверка наличия файла .env.neon
async function checkEnvFile() {
  if (!fs.existsSync('.env.neon')) {
    log('⚠️ Файл .env.neon не найден!', colors.yellow);
    
    const rl = createReadline();
    
    const answer = await askQuestion(rl, 'Создать файл .env.neon с настройками по умолчанию? (y/n): ');
    
    if (answer.toLowerCase() === 'y') {
      const defaultContent = `# Настройки принудительного использования Neon DB
DATABASE_PROVIDER=neon
USE_LOCAL_DB_ONLY=false
FORCE_NEON_DB=true
DISABLE_REPLIT_DB=true
OVERRIDE_DB_PROVIDER=neon
DISABLE_AUTO_PARTITIONING=true

# URL подключения к Neon DB (замените на ваш)
DATABASE_URL=postgresql://your_username:your_password@your-endpoint.neon.tech/neondb?sslmode=require
`;
      
      fs.writeFileSync('.env.neon', defaultContent);
      log('✅ Файл .env.neon создан. Отредактируйте его, указав правильный DATABASE_URL', colors.green);
      
      const editAnswer = await askQuestion(rl, 'Отредактировать файл сейчас? (y/n): ');
      
      if (editAnswer.toLowerCase() === 'y') {
        const editor = process.env.EDITOR || 'nano';
        spawn(editor, ['.env.neon'], {
          stdio: 'inherit',
          shell: true
        }).on('close', () => {
          log('✅ Файл .env.neon отредактирован', colors.green);
          rl.close();
        });
      } else {
        rl.close();
      }
    } else {
      log('❌ Без файла .env.neon работа с Neon DB невозможна', colors.red);
      rl.close();
      return false;
    }
  }
  
  return true;
}

// Основное меню
async function showMainMenu() {
  const rl = createReadline();
  
  while (true) {
    log('\n🌟 UniFarm Neon DB CLI 🌟', colors.magenta);
    log('----------------------------', colors.magenta);
    log('1. Проверить подключение к Neon DB', colors.reset);
    log('2. Инициализировать базу данных', colors.reset);
    log('3. Создать партиционирование для таблицы transactions', colors.reset);
    log('4. Запустить тесты интеграции', colors.reset);
    log('5. Запустить приложение с Neon DB', colors.reset);
    log('6. Настройки Neon DB (.env.neon)', colors.reset);
    log('7. Справка по Neon DB', colors.reset);
    log('8. Выход', colors.reset);
    log('----------------------------', colors.magenta);
    
    const answer = await askQuestion(rl, 'Выберите действие (1-8): ');
    
    switch (answer) {
      case '1':
        // Проверка подключения
        try {
          await runScript('check-neon-db.js');
        } catch (error) {
          log(`❌ Ошибка при проверке подключения: ${error.message}`, colors.red);
        }
        break;
        
      case '2':
        // Инициализация БД
        try {
          await runScript('init-neon-db.js');
        } catch (error) {
          log(`❌ Ошибка при инициализации базы данных: ${error.message}`, colors.red);
        }
        break;
        
      case '3':
        // Партиционирование
        try {
          log('⚠️ ВНИМАНИЕ! Этот процесс удалит и пересоздаст таблицу transactions!', colors.yellow);
          const confirm = await askQuestion(rl, 'Вы уверены, что хотите продолжить? (y/n): ');
          
          if (confirm.toLowerCase() === 'y') {
            await runScript('create-neon-partitions.js');
          } else {
            log('Операция отменена', colors.yellow);
          }
        } catch (error) {
          log(`❌ Ошибка при создании партиционирования: ${error.message}`, colors.red);
        }
        break;
        
      case '4':
        // Тесты интеграции
        try {
          await runScript('test-neon-integration.js');
        } catch (error) {
          log(`❌ Ошибка при запуске тестов: ${error.message}`, colors.red);
        }
        break;
        
      case '5':
        // Запуск приложения
        try {
          log('🚀 Запуск приложения с Neon DB...', colors.blue);
          log('Для остановки нажмите Ctrl+C', colors.yellow);
          
          if (fs.existsSync('./start-with-neon.sh')) {
            spawn('./start-with-neon.sh', [], {
              stdio: 'inherit',
              shell: true
            });
          } else {
            await runScript('neon-start.js');
          }
        } catch (error) {
          log(`❌ Ошибка при запуске приложения: ${error.message}`, colors.red);
        }
        break;
        
      case '6':
        // Настройки
        const editor = process.env.EDITOR || 'nano';
        spawn(editor, ['.env.neon'], {
          stdio: 'inherit',
          shell: true
        });
        break;
        
      case '7':
        // Справка
        if (fs.existsSync('NEON_DB_USAGE.md')) {
          log('\n📚 Содержимое NEON_DB_USAGE.md:', colors.blue);
          const content = fs.readFileSync('NEON_DB_USAGE.md', 'utf8');
          console.log(content);
        } else {
          log('❌ Файл NEON_DB_USAGE.md не найден', colors.red);
        }
        
        await askQuestion(rl, 'Нажмите Enter для продолжения...');
        break;
        
      case '8':
        // Выход
        log('👋 До свидания!', colors.green);
        rl.close();
        return;
        
      default:
        log('⚠️ Некорректный ввод, выберите опцию от 1 до 8', colors.yellow);
    }
  }
}

// Запуск программы
async function main() {
  try {
    // Проверяем наличие .env.neon
    const envExists = await checkEnvFile();
    
    if (!envExists) {
      return;
    }
    
    // Показываем главное меню
    await showMainMenu();
  } catch (error) {
    log(`💥 Непредвиденная ошибка: ${error.message}`, colors.red);
    console.error(error);
    process.exit(1);
  }
}

// Глобально определяем dirname для ES modules
function dirname(path) {
  return new URL('.', path).pathname;
}

// Запускаем программу
main();