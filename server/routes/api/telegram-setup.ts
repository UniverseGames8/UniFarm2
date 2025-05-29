/**
 * Маршрут для налаштування webhook Telegram бота
 */

import { Router } from 'express';
import { setupWebhook, getWebhookInfo } from '../../telegram/setup-hook';

const router = Router();

/**
 * GET /api/telegram/setup
 * Налаштовує webhook для Telegram бота
 */
router.get('/setup', async (req, res) => {
  try {
    const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL || process.env.APP_URL + '/api/telegram/webhook';
    
    // Якщо передали параметр force=true, примусово оновлюємо webhook
    const forceUpdate = req.query.force === 'true';
    
    // Отримуємо поточну інформацію про webhook
    const currentInfo = await getWebhookInfo();
    
    // Якщо webhook вже налаштований правильно і не вимагається примусове оновлення, не змінюємо його
    if (!forceUpdate && currentInfo.success && currentInfo.info?.url === webhookUrl) {
      return res.json({
        success: true,
        message: 'Webhook вже налаштований правильно',
        webhookInfo: currentInfo.info
      });
    }
    
    // Налаштовуємо webhook
    const result = await setupWebhook(webhookUrl);
    
    if (result.success) {
      return res.json({
        success: true,
        message: 'Webhook успішно налаштований',
        webhookInfo: result.info
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.error || 'Помилка при налаштуванні webhook'
      });
    }
  } catch (error) {
    console.error('[Telegram Setup] Помилка:', error);
    return res.status(500).json({
      success: false,
      error: 'Внутрішня помилка сервера'
    });
  }
});

/**
 * GET /api/telegram/info
 * Отримує інформацію про поточний webhook
 */
router.get('/info', async (req, res) => {
  try {
    const info = await getWebhookInfo();
    
    return res.json({
      success: info.success,
      webhookInfo: info.info,
      error: info.error
    });
  } catch (error) {
    console.error('[Telegram Info] Помилка:', error);
    return res.status(500).json({
      success: false,
      error: 'Внутрішня помилка сервера'
    });
  }
});

export default router;