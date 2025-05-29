// @ts-check

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Получаем текущую директорию
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Конфигурация правил именования файлов
const filenamingRules = {
  // React компоненты в PascalCase
  'client/components/**/*.{jsx,tsx}': /^[A-Z][a-zA-Z0-9]*\.(jsx|tsx)$/,
  'client/src/components/**/*.{jsx,tsx}': /^[A-Z][a-zA-Z0-9]*\.(jsx|tsx)$/,
  
  // Сервисы, контроллеры и утилиты в camelCase
  'server/services/**/*.ts': /^[a-z][a-zA-Z0-9]*Service\.ts$/,
  'server/services/instances/**/*.ts': /^[a-z][a-zA-Z0-9]*ServiceInstance\.ts$/,
  'server/controllers/**/*.ts': /^[a-z][a-zA-Z0-9]*Controller\.ts$/,
  'server/utils/**/*.ts': /^[a-z][a-zA-Z0-9]*\.ts$/,
  'shared/**/*.{ts,tsx}': /^[a-z][a-zA-Z0-9]*\.ts$/,
  
  // TypeScript типы и интерфейсы в PascalCase
  'shared/types/**/*.ts': /^[A-Z][a-zA-Z0-9]*\.ts$/,
};

// Экспортируем правила, чтобы их можно было использовать в lint.js
export { filenamingRules };