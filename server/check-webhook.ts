/**
 * Модуль для перевірки та оновлення webhook Telegram бота
 * 
 * Цей модуль пропонує ендпоінт для перевірки стану webhook та його відновлення
 * в разі потреби. Особливо корисний для діагностики проблем з Mini App.
 */

import { Request, Response } from 'express';
import { setupWebhook, getWebhookInfo } from './telegram/setup-hook';
import logger from './utils/logger';

/**
 * Обробник запиту для перевірки та відновлення webhook
 */
export async function checkWebhookHandler(req: Request, res: Response): Promise<void> {
  try {
    // Отримуємо інформацію про поточний стан webhook
    const webhookInfo = await getWebhookInfo();
    
    let status = 'ok';
    let needUpdate = false;
    
    // Перевіряємо, чи правильно налаштований webhook
    if (!webhookInfo.success) {
      logger.warn('[Check Webhook] Не вдалося отримати інформацію про webhook:', webhookInfo.error);
      status = 'error';
      needUpdate = true;
    } else if (!webhookInfo.info || !webhookInfo.info.url) {
      logger.warn('[Check Webhook] Webhook URL не налаштований');
      status = 'not_set';
      needUpdate = true;
    } else {
      const expectedUrl = process.env.TELEGRAM_WEBHOOK_URL;
      
      if (expectedUrl && webhookInfo.info.url !== expectedUrl) {
        logger.warn(`[Check Webhook] Налаштований webhook URL (${webhookInfo.info.url}) не відповідає очікуваному (${expectedUrl})`);
        status = 'mismatch';
        needUpdate = true;
      }
    }
    
    let updateResult = null;
    
    // Оновлюємо webhook, якщо потрібно
    if (needUpdate && req.query.update === 'true') {
      logger.info('[Check Webhook] Спроба оновлення webhook...');
      
      const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
      
      if (!webhookUrl) {
        logger.error('[Check Webhook] Неможливо оновити webhook: TELEGRAM_WEBHOOK_URL не встановлено');
        res.status(400).json({
          success: false,
          error: 'TELEGRAM_WEBHOOK_URL не встановлено в змінних середовища'
        });
        return;
      }
      
      updateResult = await setupWebhook(webhookUrl);
      
      if (!updateResult.success) {
        logger.error('[Check Webhook] Не вдалося оновити webhook:', updateResult.error);
      } else {
        logger.info('[Check Webhook] Webhook успішно оновлено');
        status = 'updated';
        
        // Отримуємо оновлену інформацію
        const updatedInfo = await getWebhookInfo();
        if (updatedInfo.success) {
          webhookInfo.info = updatedInfo.info;
        }
      }
    }
    
    // Формуємо відповідь
    res.json({
      success: true,
      data: {
        status,
        needUpdate,
        webhookInfo: webhookInfo.info,
        expectedUrl: process.env.TELEGRAM_WEBHOOK_URL,
        miniAppUrl: process.env.MINI_APP_URL || process.env.APP_URL,
        updateResult: updateResult ? {
          success: updateResult.success,
          error: updateResult.error
        } : null,
        allowBrowserAccess: process.env.ALLOW_BROWSER_ACCESS === 'true',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('[Check Webhook] Помилка при перевірці webhook:', 
      error instanceof Error ? error.message : String(error));
    
    res.status(500).json({
      success: false,
      error: 'Помилка при перевірці webhook',
      message: error instanceof Error ? error.message : String(error)
    });
  }
}