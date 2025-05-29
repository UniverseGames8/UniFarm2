import { db } from './db-connect-unified';
import { users, uniFarmingDeposits, tonBoostDeposits } from '@shared/schema';
import { UniFarmingService } from './services/uniFarmingService';
import { NewUniFarmingService } from './services/newUniFarmingService';
import { TonBoostService } from './services/tonBoostService';
import { ReferralBonusService } from './services/referralBonusService';
import { Currency } from './services/transactionService';
import { and, ne, isNotNull, eq } from 'drizzle-orm';
import { referralBonusProcessor } from './services/referralBonusProcessor';
import { referralSystem } from './services/referralSystemIntegrator';

/**
 * Запускает фоновые задачи, которые выполняются периодически
 */
export function startBackgroundTasks(): void {
  try {
    console.log('[Background Tasks] ✅ Starting background tasks');
    
    // Запуск задачи обновления фарминга (каждый час)
    const ONE_HOUR_MS = 60 * 60 * 1000;
    setInterval(async () => {
      try {
        console.log('[Background Tasks] 🔄 Starting farming update cycle');
        await updateAllUsersFarming();
        console.log('[Background Tasks] ✅ Farming update cycle completed successfully');
      } catch (error) {
        console.error('[Background Tasks] ❌ Error in farming update cycle:', error);
      }
    }, ONE_HOUR_MS);
    
    // Запускаем первое начисление через 5 секунд после старта сервера,
    // но только для инициализации системы, без реальных начислений
    setTimeout(() => {
      try {
        console.log('[Background Tasks] ✅ Initial system check after server start');
        systemInitialized = true;
      } catch (error) {
        console.error('[Background Tasks] ❌ Error in system initialization:', error);
      }
    }, 5000);
    
    // Инициализация обработчика реферальных начислений
    initializeReferralProcessor();
    console.log('[Background Tasks] ✅ Background tasks initialization completed');
  } catch (error) {
    console.error('[Background Tasks] ❌ Critical error starting background tasks:', error);
  }
}

/**
 * Инициализирует процессор реферальных бонусов
 * - Создает необходимые индексы
 * - Восстанавливает незавершенные операции после перезапуска
 */
async function initializeReferralProcessor(): Promise<void> {
  try {
    console.log('[Background Tasks] Initializing referral bonus processor');
    
    // Создаем необходимые индексы для оптимизации работы
    await referralBonusProcessor.ensureIndexes();
    
    // Восстанавливаем незавершенные операции после перезапуска
    const recoveredCount = await referralBonusProcessor.recoverFailedProcessing();
    
    if (recoveredCount > 0) {
      console.log(`[Background Tasks] Recovered ${recoveredCount} referral reward operations`);
    } else {
      console.log('[Background Tasks] No failed referral operations to recover');
    }
    
    // Инициализируем оптимизированный процессор реферальной системы
    await referralSystem.initialize();
    
    // В режиме разработки можно включить оптимизированный процессор
    if (process.env.USE_OPTIMIZED_REFERRALS === 'true') {
      referralSystem.enableOptimizedMode();
      console.log('[Background Tasks] Optimized referral system ENABLED');
    } else {
      console.log('[Background Tasks] Using standard referral system (optimized system available but disabled)');
    }
    
    console.log('[Background Tasks] Referral bonus processor initialized successfully');
  } catch (error) {
    console.error('[Background Tasks] Error initializing referral processor:', error);
  }
}

// Переменная для отслеживания времени последнего вывода сообщения в лог
let lastLogTime = 0;

// Время запуска сервера (для защиты от перерасчета фарминга при перезапуске)
const SERVER_START_TIME = new Date();

// Флаг, указывающий, что система прошла инициализацию
let systemInitialized = false;

// Минимальное значение для начисления реферального бонуса от дохода фарминга
const MIN_REFERRAL_THRESHOLD = 0.000001;

// Максимальное допустимое смещение времени при перезапуске (в секундах)
const MAX_RESTART_OFFSET = 10;

/**
 * Обновляет фарминг для всех активных пользователей
 * Этот метод вызывается каждый час и начисляет доход
 * прямо на основной баланс пользователя
 */
async function updateAllUsersFarming(): Promise<void> {
  try {
    // Защита от слишком больших начислений при первом запуске сервера
    const startTime = new Date();
    const secondsSinceServerStart = Math.floor((startTime.getTime() - SERVER_START_TIME.getTime()) / 1000);
    
    // При первом запуске пропускаем обновление
    if (!systemInitialized) {
      console.log(`[Background Tasks] Initializing farming system. Skipping first update to prevent excessive rewards.`);
      systemInitialized = true;
      return;
    }
    
    // Если после запуска сервера прошло слишком мало времени, пропускаем обновление
    if (secondsSinceServerStart < 2) {
      console.log(`[Background Tasks] Server just started (${secondsSinceServerStart}s ago). Waiting for system stabilization.`);
      return;
    }
    
    console.log(`[Background Tasks] Starting hourly farming update - ${new Date().toISOString()}`);
    
    // Получаем всех пользователей с активными депозитами через сервисы
    try {
      const uniFarmingService = new NewUniFarmingService();
      const tonBoostService = new TonBoostService();
      
      const usersWithUniDeposits = await uniFarmingService.getUsersWithActiveDeposits();
      const usersWithTonBoosts = await tonBoostService.getUsersWithActiveDeposits();
      
      console.log(`[Background Tasks] Found ${usersWithUniDeposits.length} users with UNI deposits, ${usersWithTonBoosts.length} users with TON boosts`);
    } catch (error) {
      console.error('[Background Tasks] Error fetching users with deposits:', error);
      return; // Пропускаем обновление при ошибке
    }

    // Объединяем пользователей из обоих источников
    let activeUsers = [...usersWithUniDeposits.map(record => ({ id: record.user_id }))];
    
    // Добавляем пользователей с TON Boost-депозитами (если их еще нет в списке)
    for (const record of usersWithTonBoosts) {
      if (!activeUsers.some(user => user.id === record.user_id)) {
        activeUsers.push({ id: record.user_id });
      }
    }

    // Если у нас не нашлось новых депозитов UNI или TON, проверяем старую систему
    if (activeUsers.length === 0) {
      // Получаем всех пользователей с активным фармингом по старой схеме
      const legacyUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(
          /* WHERE uni_deposit_amount > 0 AND uni_farming_start_timestamp IS NOT NULL */
          and(
            ne(users.uni_deposit_amount, '0'),
            isNotNull(users.uni_farming_start_timestamp)
          )
        );
      
      activeUsers = legacyUsers;
    }
    
    if (activeUsers.length === 0) {
      console.log(`[Background Tasks] No active farming users found. Skipping update.`);
      return;
    }
    
    console.log(`[Background Tasks] Processing hourly farming update for ${activeUsers.length} users`);
    
    let updatedCount = 0;
    
    // Обновляем фарминг для каждого пользователя
    for (const user of activeUsers) {
      try {
        // Проверяем UNI-фарминг
        // Сначала проверяем, есть ли у пользователя новые депозиты
        const uniDeposits = await db
          .select()
          .from(uniFarmingDeposits)
          .where(and(
            eq(uniFarmingDeposits.user_id, user.id),
            eq(uniFarmingDeposits.is_active, true)
          ));
        
        if (uniDeposits.length > 0) {
          // Если есть новые депозиты, используем новый сервис
          await NewUniFarmingService.calculateAndUpdateUserFarming(user.id);
        } else {
          // Если нет новых депозитов, используем старый сервис для обратной совместимости
          await UniFarmingService.calculateAndUpdateUserFarming(user.id);
        }

        // Проверяем TON-фарминг
        const tonBoosts = await db
          .select()
          .from(tonBoostDeposits)
          .where(and(
            eq(tonBoostDeposits.user_id, user.id),
            eq(tonBoostDeposits.is_active, true)
          ));
        
        if (tonBoosts.length > 0) {
          // Обновляем TON-фарминг
          const result = await TonBoostService.calculateAndUpdateUserTonFarming(user.id);
          if (result && result.success) {
            console.log(`[Background Tasks] User ${user.id} TON farming updated: +${result.earnedTon} TON`);
          }
        }
        
        updatedCount++;
      } catch (userError) {
        console.error(`[Background Tasks] Error updating farming for user ${user.id}:`, userError);
        // Продолжаем с другими пользователями даже при ошибке
      }
    }
    
    console.log(`[Background Tasks] Hourly farming update completed. Successfully updated ${updatedCount}/${activeUsers.length} users.`);
  } catch (error) {
    console.error('[Background Tasks] Error in hourly farming update:', error);
  }
}