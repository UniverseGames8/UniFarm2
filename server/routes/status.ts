/**
 * Модуль маршрутов для отображения статуса системы
 * 
 * Предоставляет страницу с информацией о состоянии приложения,
 * используется для мониторинга работоспособности.
 */

import express from 'express';
import { statusPageHandler } from '../utils/status-page';
import logger from '../utils/logger';

// Создаем отдельный маршрутизатор для страницы статуса
const statusRouter = express.Router();

// Маршрут для отображения страницы статуса
statusRouter.get('/', (req, res) => {
  try {
    statusPageHandler(req, res);
  } catch (error) {
    logger.error('[Status Page] Error:', error);
    res.status(500).send('Internal Server Error');
  }
});

export default statusRouter;