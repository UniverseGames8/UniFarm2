/**
 * Налаштування middleware для роботи з Telegram Mini App
 * 
 * Цей модуль налаштовує обробку даних від Telegram Mini App
 * для коректної інтеграції з Express застосунком.
 */

import { Express } from 'express';
import telegramInitDataMiddleware from './telegram-init-handler';

/**
 * Налаштовує middleware для роботи з Telegram Mini App
 * @param app Express застосунок
 */
export function setupTelegramMiddleware(app: Express): void {
  // Налаштовуємо middleware для всіх запитів API
  const apiMiddleware = telegramInitDataMiddleware({
    skipValidation: process.env.SKIP_TELEGRAM_CHECK === 'true',
    allowBrowserAccess: process.env.ALLOW_BROWSER_ACCESS === 'true',
    requireAuth: false
  });
  app.use('/api', apiMiddleware);
  
  // Налаштовуємо middleware для захищених API ендпоінтів, які вимагають авторизації
  const authMiddleware = telegramInitDataMiddleware({
    skipValidation: process.env.SKIP_TELEGRAM_CHECK === 'true',
    allowBrowserAccess: process.env.ALLOW_BROWSER_ACCESS === 'true',
    requireAuth: true
  });
  app.use('/api/auth', authMiddleware);
  
  console.log('[TelegramMiddleware] Налаштовано обробку Telegram Mini App');
  
  // Додаємо діагностичний ендпоінт для перевірки роботи Telegram інтеграції
  app.get('/api/telegram/debug', (req, res) => {
    res.json({
      success: true,
      data: {
        telegramInfo: req.telegram,
        env: {
          skipValidation: process.env.SKIP_TELEGRAM_CHECK === 'true',
          allowBrowserAccess: process.env.ALLOW_BROWSER_ACCESS === 'true',
          miniAppUrl: process.env.MINI_APP_URL || process.env.APP_URL,
          webhookUrl: process.env.TELEGRAM_WEBHOOK_URL,
          hasBotToken: Boolean(process.env.TELEGRAM_BOT_TOKEN)
        }
      }
    });
  });
}

export default setupTelegramMiddleware;