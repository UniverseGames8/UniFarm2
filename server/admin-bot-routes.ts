/**
 * Маршрути для адміністративної панелі UniFarm через Telegram бота
 */

import express from 'express';
import adminBotWebhook from './api/admin/bot-webhook';
import { setAdminBotWebhook } from './telegramAdminBot.v2';

/**
 * Налаштовує маршрути для адмін-бота
 * @param app - Express додаток
 * @param baseUrl - Базовий URL сервера (для налаштування вебхука)
 */
export function setupAdminBotRoutes(app: express.Application, baseUrl?: string): void {
  // Підключаємо маршрут для вебхука
  app.use('/api/admin/bot-webhook', adminBotWebhook);

  // Якщо вказаний baseUrl, налаштовуємо вебхук для адмін-бота
  if (baseUrl) {
    console.log(`[AdminBot] Встановлюємо вебхук на ${baseUrl}`);
    setAdminBotWebhook(baseUrl)
      .then(success => {
        if (success) {
          console.log('[AdminBot] ✅ Вебхук успішно налаштований');
        } else {
          console.error('[AdminBot] ❌ Помилка при налаштуванні вебхука');
        }
      })
      .catch(error => {
        console.error('[AdminBot] ❌ Помилка при налаштуванні вебхука:', error);
      });
  } else {
    console.warn('[AdminBot] ⚠️ Не вказаний baseUrl, вебхук не буде налаштований автоматично');
  }
}