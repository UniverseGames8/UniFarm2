/**
 * 🎯 Webhook endpoint для административного бота UniFarm
 * 
 * Обрабатывает все входящие сообщения и callback-запросы от админ-бота
 */

import { Request, Response } from 'express';
import { handleUpdate } from '../../telegramAdminBotNew';

/**
 * Обработчик webhook для админ-бота
 */
export default async function adminWebhookHandler(req: Request, res: Response): Promise<void> {
  try {
    console.log('[AdminBot Webhook] Получено обновление:', JSON.stringify(req.body, null, 2));
    
    // Обрабатываем обновление
    await handleUpdate(req.body);
    
    // Возвращаем успешный ответ
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[AdminBot Webhook] Ошибка обработки:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}