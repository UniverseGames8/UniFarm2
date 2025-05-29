#!/usr/bin/env node

/**
 * Простой и надежный запуск UniFarm приложения
 */

import { spawn } from 'child_process';
import path from 'path';

console.log('🚀 Запуск UniFarm приложения...');

// Устанавливаем переменные окружения
process.env.NODE_ENV = 'development';
process.env.PORT = '3000';

// Запускаем сервер
const serverProcess = spawn('npx', ['tsx', 'server/index.ts'], {
  stdio: 'inherit',
  cwd: process.cwd(),
  env: process.env
});

// Обработка ошибок
serverProcess.on('error', (error) => {
  console.error('❌ Ошибка запуска сервера:', error);
  process.exit(1);
});

serverProcess.on('exit', (code) => {
  console.log(`🔄 Сервер завершил работу с кодом: ${code}`);
  if (code !== 0) {
    process.exit(code);
  }
});

// Грациозное завершение
process.on('SIGINT', () => {
  console.log('\n⏹️ Получен сигнал завершения, останавливаем сервер...');
  serverProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n⏹️ Получен сигнал завершения, останавливаем сервер...');
  serverProcess.kill('SIGTERM');
});