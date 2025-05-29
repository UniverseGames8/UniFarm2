/**
 * Маршрут для обработки webhook от административного Telegram-бота
 * 
 * Получает обновления от Telegram API и передает их на обработку в telegramAdminBot.ts
 */

import express, { Router, Request, Response } from 'express';
import { processAdminBotUpdate } from '../../telegramAdminBot.v2';

const router = Router();

/**
 * POST /api/admin/bot-webhook
 * 
 * Получает обновления от Telegram API и передает их на обработку
 * Этот URL должен быть зарегистрирован как webhook в Telegram API
 */
// Обробляємо HTTP POST запити від Telegram API
router.post('/', async (req: Request, res: Response) => {
  try {
    // Проверяем, что в теле запроса есть данные обновления
    if (!req.body) {
      console.error('[AdminBot Webhook] Получен пустой запрос');
      return res.status(400).send('Bad Request: No Body');
    }

    // Логируем полученное обновление (для отладки)
    console.log('[AdminBot Webhook] Получено обновление:', JSON.stringify(req.body).slice(0, 200) + '...');

    // Обрабатываем обновление
    await processAdminBotUpdate(req.body);

    // Отправляем ответ как можно быстрее, чтобы Telegram не ждал
    res.status(200).send('OK');
  } catch (error) {
    console.error('[AdminBot Webhook] Ошибка при обработке webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

export default router;