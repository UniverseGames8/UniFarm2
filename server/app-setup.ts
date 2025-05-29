/**
 * Налаштування додатку UniFarm з підтримкою Telegram Mini App
 * та обходом проблем з базою даних
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import path from 'path';
import { telegramMiddleware, requireTelegramAuth } from './telegram/middleware';

// Оголошуємо тип для CORS middleware
const cors = require('cors');

/**
 * Налаштовує Express додаток для UniFarm
 * @param app Express додаток
 */
export function setupApp(app: Express): void {
  // Налаштування базових middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Налаштування CORS для роботи з Telegram
  app.use(cors({
    origin: ['https://telegram.org', 'https://t.me', /\.telegram\.org$/, /\.t\.me$/],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Telegram-Init-Data', 'Telegram-Init-Data'],
    credentials: true
  }));
  
  // Налаштування обробки даних від Telegram Mini App
  app.use(telegramMiddleware);
  
  // Налаштування захищених маршрутів
  app.use('/api/auth', requireTelegramAuth);
  
  // Налаштування статичних файлів
  const distPath = path.join(process.cwd(), 'dist/public');
  const serverPublicPath = path.join(process.cwd(), 'server/public');
  
  // Спочатку перевіряємо шлях для production збірки
  if (require('fs').existsSync(distPath)) {
    app.use(express.static(distPath));
    console.log(`[App] Статичні файли доступні з: ${distPath}`);
  } else {
    console.log(`[App] Шлях до збірки не знайдено: ${distPath}`);
  }
  
  // Потім серверні статичні файли
  if (require('fs').existsSync(serverPublicPath)) {
    app.use('/static', express.static(serverPublicPath));
    console.log(`[App] Статичні файли доступні по URL /static з папки: ${serverPublicPath}`);
  }
  
  // Налаштування діагностичних маршрутів
  setupDiagnosticRoutes(app);
  
  // Налаштування вловлювання помилок
  setupErrorHandlers(app);
  
  console.log('[App] Express додаток налаштовано успішно');
}

/**
 * Налаштовує діагностичні маршрути
 */
function setupDiagnosticRoutes(app: Express): void {
  // Перевірка стану
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      time: new Date().toISOString(),
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    });
  });
  
  // Діагностика Telegram Mini App
  app.get('/api/telegram/debug', (req, res) => {
    res.json({
      success: true,
      data: {
        telegram: req.telegram,
        environment: {
          skipTelegramCheck: process.env.SKIP_TELEGRAM_CHECK === 'true',
          allowBrowserAccess: process.env.ALLOW_BROWSER_ACCESS === 'true',
          nodeEnv: process.env.NODE_ENV,
          miniAppUrl: process.env.MINI_APP_URL || process.env.APP_URL,
          hasBotToken: Boolean(process.env.TELEGRAM_BOT_TOKEN)
        }
      }
    });
  });
}

/**
 * Налаштовує обробку помилок
 */
function setupErrorHandlers(app: Express): void {
  // Middleware для обробки 404 помилок
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      res.status(404).json({
        success: false,
        error: 'Endpoint не знайдено',
        path: req.path
      });
    } else {
      // Для інших шляхів - віддаємо головну сторінку
      const indexPath = path.join(process.cwd(), 'dist/public/index.html');
      if (require('fs').existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Not Found');
      }
    }
  });
  
  // Middleware для обробки помилок
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('[App] Помилка:', err);
    
    res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Внутрішня помилка сервера'
    });
  });
}

export default setupApp;