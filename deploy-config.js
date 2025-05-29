/**
 * Конфигурация деплоя UniFarm на Replit
 * 
 * Этот файл позволяет автоматизировать настройку окружения для деплоя
 * Используется при развертывании приложения на Replit
 */

// Используем текущую конфигурацию базы данных Neon
const DATABASE_CONFIG = {
  url: process.env.DATABASE_URL || '',
  host: process.env.PGHOST || '',
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || '',
  database: process.env.PGDATABASE || '',
};

// Конфигурация для HTTP сервера
const SERVER_CONFIG = {
  port: 3000,
  host: "0.0.0.0",
};

// Конфигурация для файлов и путей
const PATH_CONFIG = {
  // Пути к файлам деплоя
  replit: {
    source: ".replit.production",
    target: ".replit",
  },
  // Файлы для запуска в production
  productionServer: "production-server.mjs",
  startScript: "start-unified.js",
};

// Переменные окружения для production
const ENV_VARIABLES = {
  NODE_ENV: "production",
  PORT: SERVER_CONFIG.port.toString(),
  DATABASE_PROVIDER: "replit",
  DATABASE_URL: DATABASE_CONFIG.url,
  PGHOST: DATABASE_CONFIG.host,
  PGPORT: DATABASE_CONFIG.port.toString(),
  PGUSER: DATABASE_CONFIG.user,
  PGDATABASE: DATABASE_CONFIG.database,
};

// Команды для запуска приложения
const COMMANDS = {
  build: "npm run build",
  migrate: "npm run db:push",
  start: `node ${PATH_CONFIG.startScript}`,
  checkDb: "node check-replit-db.mjs",
};

// Конфигурация для автоматического деплоя
const DEPLOY_CONFIG = {
  deployTarget: "cloudrun",
  deployBranch: "main",
  startCommand: COMMANDS.start,
};

export default {
  DATABASE_CONFIG,
  SERVER_CONFIG,
  PATH_CONFIG,
  ENV_VARIABLES,
  COMMANDS,
  DEPLOY_CONFIG,
};