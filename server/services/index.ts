/**
 * Центральный модуль для экспорта сервисов
 * 
 * Этот файл создает и экспортирует экземпляры всех сервисов приложения,
 * настраивая их с правильными зависимостями.
 * 
 * Используется для централизованного управления доступом к сервисам и
 * упрощения процесса внедрения зависимостей.
 */

import { extendedStorage } from '../storage-adapter-extended';
import { createUserService, type IUserService } from './userService';
import { userServiceInstance } from './userServiceInstance.js';
import { referralServiceInstance, createReferralService, type IReferralService } from './referralServiceInstance';
import { referralBonusServiceInstance, createReferralBonusService, type IReferralBonusService } from './referralBonusServiceInstance';
import { transactionServiceInstance, createTransactionService, type ITransactionService } from './transactionServiceInstance';
import { tonBoostServiceInstance, createTonBoostService, type ITonBoostService } from './tonBoostServiceInstance';
import { farmingServiceInstance, createFarmingService, type IFarmingService } from './farmingServiceInstance';
import { uniFarmingServiceInstance, createUniFarmingService, type IUniFarmingService } from './uniFarmingServiceInstance';
import { createNewUniFarmingService, type INewUniFarmingService } from './newUniFarmingServiceInstance';
import { createLaunchLogService, type ILaunchLogService } from './launchLogServiceInstance';
import { createDailyBonusService, type IDailyBonusService, type DailyBonusStatusResponse, type DailyBonusClaimResponse } from './dailyBonusServiceInstance';
import { createPartitionService, type IPartitionService } from './partitionServiceInstance';
import { createAuthService, type IAuthService } from './authServiceInstance';
import { createSecurityService, type ISecurityService } from './securityServiceInstance';
import { createAdminService, type IAdminService } from './adminServiceInstance';
import { databaseServiceInstance, type IDatabaseService } from './databaseServiceInstance';
import { telegramServiceInstance, createTelegramService, type ITelegramService } from './telegramServiceInstance';
import { missionServiceInstance, createMissionService, type IMissionService } from './missionServiceInstance';
import { boostServiceInstance, createBoostService, type IBoostService } from './boostServiceInstance';
import { walletServiceInstance, createWalletService, type IWalletService } from './walletServiceInstance';
import { validationServiceInstance, createValidationService, type IValidationService } from './validationService';

// Создаем экземпляры сервисов с подключением расширенного хранилища
// Сервисы с instance-паттерном используют реализацию из соответствующих файлов
// Используем существующий экземпляр referralServiceInstance
// Используем существующий экземпляр referralBonusServiceInstance
const referralBonusService = createReferralBonusService();
// Используем существующий экземпляр transactionServiceInstance вместо создания нового
const transactionService = createTransactionService();
// Используем существующий экземпляр tonBoostServiceInstance
const tonBoostService = createTonBoostService();
// Используем существующий экземпляр farmingServiceInstance
const farmingService = farmingServiceInstance;
const uniFarmingService = uniFarmingServiceInstance;
const newUniFarmingService = createNewUniFarmingService();
const launchLogService = createLaunchLogService();
const dailyBonusService = createDailyBonusService();
const partitionService = createPartitionService();
const authService = createAuthService();
const securityService = createSecurityService();
const adminService = createAdminService();
// Используем существующий экземпляр validationServiceInstance
const validationService = validationServiceInstance;

// Экспортируем экземпляры сервисов для использования в контроллерах
export {
  userServiceInstance as userService,
  referralServiceInstance as referralService,
  referralBonusService,
  transactionService,
  tonBoostService,
  farmingService,
  uniFarmingService,
  newUniFarmingService,
  launchLogService,
  dailyBonusService,
  partitionService,
  authService,
  securityService,
  adminService,
  databaseServiceInstance as databaseService,
  telegramServiceInstance as telegramService,
  missionServiceInstance as missionService,
  boostServiceInstance as boostService,
  walletServiceInstance as walletService,
  validationService
};

// Типы и интерфейсы из missionServiceInstance доступны через реэкспорт из missionService

// Экспортируем типы для использования в пользовательском коде
export type {
  IUserService as UserService,
  IReferralService as ReferralService,
  IReferralBonusService as ReferralBonusService,
  ITransactionService as TransactionService,
  ITonBoostService as TonBoostService,
  IFarmingService as FarmingService,
  IUniFarmingService as UniFarmingService,
  INewUniFarmingService as NewUniFarmingService,
  ILaunchLogService as LaunchLogService,
  IDailyBonusService as DailyBonusService,
  IPartitionService as PartitionService,
  IAuthService as AuthService,
  ISecurityService as SecurityService,
  IAdminService as AdminService,
  ITelegramService as TelegramService,
  IMissionService as MissionService,
  IBoostService as BoostService,
  IWalletService as WalletService,
  IValidationService as ValidationService,
  // Экспортируем дополнительные типы для использования в контроллерах
  DailyBonusStatusResponse,
  DailyBonusClaimResponse
};

// Реэкспортируем типы интерфейсов для использования в тестах и моках
export type { IUserService } from './userService';
export type { IReferralService } from './referralServiceInstance.js';
export type { IReferralBonusService } from './referralBonusServiceInstance.js';
export type { ITransactionService } from './transactionServiceInstance.js';
export type { ITonBoostService } from './tonBoostServiceInstance.js';
export type { IFarmingService } from './farmingServiceInstance.js';
export type { IUniFarmingService } from './uniFarmingServiceInstance.js';
export type { INewUniFarmingService } from './newUniFarmingServiceInstance.js';
export type { ILaunchLogService } from './launchLogServiceInstance.js';
export type { IDailyBonusService } from './dailyBonusServiceInstance.js';
export type { IPartitionService } from './partitionServiceInstance.js';
export type { IAuthService } from './authServiceInstance.js';
export type { ISecurityService } from './securityServiceInstance.js';
export type { IAdminService } from './adminServiceInstance.js';
export type { ITelegramService } from './telegramServiceInstance.js';
export type { IMissionService } from './missionServiceInstance.js';
export type { IBoostService } from './boostServiceInstance.js';
export type { IWalletService } from './walletServiceInstance.js';
export type { IValidationService } from './validationService';

/**
 * Повторно экспортируем фабричные функции для создания сервисов
 * Это позволяет создавать новые экземпляры сервисов с альтернативными реализациями хранилища,
 * например, для тестирования или для использования с разными экземплярами хранилища.
 */
export {
  createUserService,
  createReferralService,
  createReferralBonusService,
  createTransactionService,
  createTonBoostService,
  createFarmingService,
  createUniFarmingService,
  createNewUniFarmingService,
  createLaunchLogService,
  createDailyBonusService,
  createPartitionService,
  createAuthService,
  createSecurityService,
  createAdminService,
  createTelegramService,
  createMissionService,
  createBoostService,
  createWalletService,
  createValidationService
};