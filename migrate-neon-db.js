#!/usr/bin/env node
/**
 * Скрипт для запуска миграции схемы в Neon DB
 * 
 * Этот скрипт загружает переменные окружения из .env.neon и
 * запускает drizzle-kit для применения миграции к Neon DB.
 */

import fs from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

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

// Загружаем переменные окружения из .env.neon
function loadEnvFromFile() {
  try {
    const envFile = fs.readFileSync('.env.neon', 'utf8');
    const envVars = {};
    
    envFile.split('\n').forEach(line => {
      if (line.trim() && !line.startsWith('#')) {
        const parts = line.split('=');
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const value = parts.slice(1).join('=').trim();
          
          if (key && value) {
            envVars[key] = value;
            process.env[key] = value;
          }
        }
      }
    });
    
    return envVars;
  } catch (error) {
    log(`Ошибка при загрузке .env.neon: ${error.message}`, colors.red);
    return {};
  }
}

// Функция для выполнения команды drizzle-kit
function runDrizzlePush() {
  return new Promise((resolve, reject) => {
    log('🔄 Запуск drizzle-kit push для Neon DB...', colors.cyan);
    
    // Проверяем DATABASE_URL
    if (!process.env.DATABASE_URL) {
      log('❌ Переменная DATABASE_URL не установлена!', colors.red);
      return reject(new Error('DATABASE_URL is not set'));
    }
    
    const maskedUrl = process.env.DATABASE_URL.replace(/:[^:]*@/, ':***@');
    log(`📝 Используется строка подключения: ${maskedUrl}`, colors.yellow);
    
    // Выполняем команду npm run db:push
    const drizzlePush = spawn('npm', ['run', 'db:push'], {
      stdio: 'pipe',
      env: process.env
    });
    
    drizzlePush.stdout.on('data', (data) => {
      process.stdout.write(data);
    });
    
    drizzlePush.stderr.on('data', (data) => {
      process.stderr.write(data);
    });
    
    drizzlePush.on('close', (code) => {
      if (code === 0) {
        log('\n✅ Миграция схемы успешно выполнена', colors.green);
        resolve();
      } else {
        log(`\n❌ Ошибка при выполнении миграции, код завершения: ${code}`, colors.red);
        reject(new Error(`Migration failed with code ${code}`));
      }
    });
  });
}

// Основная функция
async function main() {
  log('🌟 Запуск миграции схемы в Neon DB', colors.magenta);
  
  // Загружаем переменные окружения
  const envVars = loadEnvFromFile();
  
  if (!process.env.DATABASE_URL && !envVars.DATABASE_URL) {
    log('❌ Переменная DATABASE_URL не найдена. Укажите её в .env.neon', colors.red);
    process.exit(1);
  }
  
  // Устанавливаем переменные для Neon DB
  process.env.DATABASE_PROVIDER = 'neon';
  process.env.USE_LOCAL_DB_ONLY = 'false';
  process.env.FORCE_NEON_DB = 'true';
  process.env.DISABLE_REPLIT_DB = 'true';
  process.env.OVERRIDE_DB_PROVIDER = 'neon';
  
  try {
    // Выполняем миграцию
    await runDrizzlePush();
    
    log('\n🎉 Миграция в Neon DB успешно завершена!', colors.green);
    log('Схема базы данных успешно обновлена согласно текущей модели.', colors.reset);
  } catch (error) {
    log(`\n💥 Ошибка при выполнении миграции: ${error.message}`, colors.red);
    process.exit(1);
  }
}

// Запускаем основную функцию
main().catch(error => {
  log(`Непредвиденная ошибка: ${error.message}`, colors.red);
  process.exit(1);
});