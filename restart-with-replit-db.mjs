/**
 * Скрипт для перезапуска приложения с настройками PostgreSQL на Replit
 * 
 * Этот скрипт выполняет следующие действия:
 * 1. Обновляет переменные окружения для использования локального PostgreSQL
 * 2. Останавливает ранее запущенные процессы (Node.js, PostgreSQL)
 * 3. Запускает PostgreSQL на Replit
 * 4. Перезапускает приложение с новыми настройками
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

// Функция для выполнения команды с выводом в консоль
async function executeCommand(command, message) {
  console.log(message);
  try {
    const { stdout, stderr } = await execAsync(command);
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
    return true;
  } catch (error) {
    console.error(`Ошибка выполнения команды: ${error.message}`);
    if (error.stdout) console.log(error.stdout);
    if (error.stderr) console.error(error.stderr);
    return false;
  }
}

// Функция для остановки всех запущенных процессов Node.js
async function stopNodeProcesses() {
  return executeCommand(
    "pkill -f 'node|tsx' || true",
    "🛑 Останавливаем запущенные Node.js процессы..."
  );
}

// Функция для остановки PostgreSQL
async function stopPostgres() {
  return executeCommand(
    "pg_ctl -D $HOME/.pg/data stop || true",
    "🛑 Останавливаем PostgreSQL..."
  );
}

// Функция для обновления переменных окружения
async function updateEnvironmentVariables() {
  return executeCommand(
    "node setup-replit-db-env.mjs",
    "🔄 Обновляем переменные окружения..."
  );
}

// Функция для запуска приложения с новыми настройками
async function startAppWithReplitDb() {
  return executeCommand(
    "node start-with-replit-db.mjs",
    "🚀 Запускаем приложение с PostgreSQL на Replit..."
  );
}

// Основная функция
async function main() {
  console.log("🔄 Перезапуск приложения с PostgreSQL на Replit...");
  
  // Останавливаем запущенные процессы
  await stopNodeProcesses();
  await stopPostgres();
  
  // Обновляем переменные окружения
  await updateEnvironmentVariables();
  
  // Запускаем приложение с новыми настройками
  await startAppWithReplitDb();
}

// Запускаем скрипт
main().catch(error => {
  console.error("❌ Критическая ошибка:", error);
  process.exit(1);
});