/**
 * Центральный модуль для экспорта контроллеров
 * 
 * Этот файл импортирует и повторно экспортирует все контроллеры приложения,
 * обеспечивая единую точку доступа к ним для маршрутов API.
 */

// Импорт контроллеров
import { UserController } from './userController';
// import { TransactionController } from './transactionController';
// import { SessionController } from './sessionController';
// import { FarmingController } from './farmingController';
// import { ReferralController } from './referralController';
// import { AnalyticsController } from './analyticsController';

// Экспорт всех контроллеров
export {
  UserController,
  // TransactionController,
  // SessionController,
  // FarmingController, 
  // ReferralController,
  // AnalyticsController
};