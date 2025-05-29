import { apiRequest } from '@/lib/queryClient';
import { correctApiRequest } from '@/lib/correctApiRequest';

/**
 * Типы транзакций
 */
export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  BONUS = 'bonus',
  FARMING_DEPOSIT = 'farming_deposit',
  FARMING_REWARD = 'farming_reward',
  FARMING_HARVEST = 'farming_harvest',
  REFERRAL_REWARD = 'referral_reward',
  DAILY_BONUS = 'daily_bonus',
  SIGNUP_BONUS = 'signup_bonus',
  AIRDROP = 'airdrop',
  TON_BOOST = 'ton_boost',
  BOOST = 'boost',
  TON_FARMING_REWARD = 'ton_farming_reward',
  UNKNOWN = 'unknown'
}

/**
 * Статусы транзакций
 */
export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

/**
 * Интерфейс для транзакции
 */
export interface Transaction {
  id: string | number;
  type: string;
  amount: number;
  tokenType: string;
  timestamp: Date;
  status: string;
  source?: string;
  category?: string;
  title?: string;
  description?: string;
}

/**
 * Получает список всех транзакций пользователя
 * @param userId ID пользователя
 * @param limit Ограничение по количеству транзакций
 * @param offset Смещение для пагинации
 * @returns Промис со списком транзакций
 */
export async function fetchTransactions(
  userId: number,
  limit: number = 10,
  offset: number = 0
): Promise<Transaction[]> {
  try {
    console.log('[transactionService] Запрос транзакций для userId:', userId);
    
    if (!userId) {
      console.error('[transactionService] Ошибка: userId не предоставлен для запроса транзакций');
      throw new Error('userId is required to fetch transactions');
    }
    
    // Используем улучшенный метод correctApiRequest с обработкой ошибок
    console.log('[transactionService] Запрос транзакций через correctApiRequest');
    
    // Добавляем поддержку как старого, так и нового пути API
    const response = await correctApiRequest(`/api/transactions?user_id=${userId}&limit=${limit}&offset=${offset}`, 'GET', null, {
      additionalLogging: true,
      errorHandling: {
        report404: true,
        detailed: true,
        traceId: `transactions-${Date.now()}`
      }
    });
    
    // Для отладки: вывести полный ответ
    console.log('[transactionService] Полный ответ API:', JSON.stringify(response));
    
    // correctApiRequest сам обрабатывает основные ошибки запроса,
    // но мы все равно проверяем структуру данных для более надежной работы
    if (!response.success || !response.data) {
      console.error('[transactionService] Ошибка в структуре ответа:', response);
      throw new Error('Некорректная структура ответа при получении транзакций');
    }
    
    console.log('[transactionService] Получены транзакции:', response.data);
    
    // Проверяем структуру ответа
    if (!response.data || !response.data.transactions) {
      console.warn('[transactionService] Структура ответа от API отличается от ожидаемой:', response.data);
      return [];
    }
    
    // Преобразуем данные в нужный формат
    return response.data.transactions.map((tx: any) => formatTransaction(tx));
  } catch (error) {
    console.error('[transactionService] Ошибка в fetchTransactions:', error);
    throw error;
  }
}

/**
 * Получает список TON транзакций пользователя (с увеличенным лимитом)
 * @param userId ID пользователя
 * @param limit Ограничение по количеству транзакций (увеличенное по умолчанию для TON)
 * @param offset Смещение для пагинации
 * @returns Промис со списком TON транзакций
 */
export async function fetchTonTransactions(
  userId: number,
  limit: number = 50,  // Увеличенный лимит для TON транзакций
  offset: number = 0
): Promise<Transaction[]> {
  try {
    console.log('[transactionService] Запрос TON транзакций для userId:', userId);
    
    if (!userId) {
      console.error('[transactionService] Ошибка: userId не предоставлен для запроса TON транзакций');
      throw new Error('userId is required to fetch TON transactions');
    }
    
    // Делаем прямой запрос на API для получения всех транзакций
    const response = await correctApiRequest(`/api/transactions?user_id=${userId}&limit=${limit}&offset=${offset}`, 'GET', null, {
      additionalLogging: true,
      errorHandling: {
        report404: true,
        detailed: true,
        traceId: `ton-transactions-${Date.now()}`
      }
    });
    
    console.log('[transactionService] Получен ответ API для TON транзакций:', JSON.stringify(response));
    
    if (!response.success || !response.data || !response.data.transactions) {
      console.error('[transactionService] Ошибка в структуре ответа для TON транзакций:', response);
      return [];
    }
    
    // Логируем все типы транзакций для отладки
    const allTypes = response.data.transactions.map((tx: any) => 
      `${tx.type}:${tx.currency || tx.token_type || 'unknown'}`
    );
    console.log('[transactionService] Все типы транзакций:', allTypes);
    
    // Фильтруем TON транзакции, учитывая разные возможные имена полей
    const tonTransactions = response.data.transactions.filter((tx: any) => {
      const currency = (tx.currency || tx.token_type || '').toUpperCase();
      const type = (tx.type || '').toLowerCase();
      const source = (tx.source || '').toLowerCase();
      const category = (tx.category || '').toLowerCase();
      
      // Дополнительное логирование всех TON-связанных транзакций
      if (currency === 'TON' || type.includes('ton') || source.includes('ton') || 
          type === 'boost_purchase' || (category === 'boost' && currency === 'TON')) {
        console.log('[transactionService] Детали TON-связанной транзакции:', {
          id: tx.id,
          type,
          currency,
          source,
          category,
          amount: tx.amount,
          created_at: tx.created_at
        });
      }
      
      // Ищем начисления от TON Boost
      if (source.includes('ton boost') || source.match(/ton\s+boost/i)) {
        console.log('[transactionService] 🌟 Обнаружено начисление от TON Boost:', {
          id: tx.id,
          type,
          currency, 
          source,
          amount: tx.amount,
          created_at: tx.created_at
        });
      }
      
      // Проверяем по различным признакам TON-транзакций:
      // 1. Валюта TON
      // 2. Тип транзакции связан с TON (boost_purchase, ton_boost, ton_farming_reward)
      // 3. Источник транзакции содержит TON
      // 4. Категория связана с farming или boost
      // 5. Проверяем начисления TON Boost через специальные проверки
      
      // Проверка на начисления TON Boost
      // Многие начисления от TON Boost могут быть в UNI и TON
      const isTonBoostReward = 
        (source.includes('ton boost') || source.includes('ton farming')) ||
        (type === 'boost_bonus' && (
          source.toLowerCase().includes('ton') || 
          // Проверяем любые бонусы от TON Boost включая UNI-награды
          (tx.description && tx.description.toLowerCase().includes('ton'))
        )) ||
        (type === 'ton_farming_reward') ||
        // Ищем начисления UNI, которые связаны с TON Boost
        (currency === 'UNI' && source.toLowerCase().includes('ton'));
        
      if (isTonBoostReward) {
        console.log('[transactionService] 💰 Найдено начисление от TON Boost/Farming:', {
          id: tx.id,
          type,
          currency,
          source,
          amount: tx.amount,
          created_at: tx.created_at
        });
      }
        
      return currency === 'TON' || 
             type.includes('ton') ||
             type === 'boost_purchase' ||  // Покупка TON Boost пакетов
             type === 'ton_boost' ||       // TON Boost операции
             source.includes('ton') ||
             type === 'ton_farming_reward' || // TON Farming награды
             (category === 'boost' && currency === 'TON') ||
             isTonBoostReward;  // Начисления от TON Boost
    });
    
    console.log('[transactionService] Найдено TON транзакций:', tonTransactions.length);
    
    // Логирование для отладки
    if (tonTransactions.length > 0) {
      console.log('[transactionService] Примеры TON транзакций:', 
        tonTransactions.slice(0, 3).map((tx: any) => ({
          id: tx.id,
          type: tx.type,
          currency: tx.currency || tx.token_type,
          amount: tx.amount,
          created_at: tx.created_at
        }))
      );
    } else {
      console.warn('[transactionService] Не найдено ни одной TON транзакции');
    }
    
    // Преобразуем данные в нужный формат
    return tonTransactions.map((tx: any) => formatTransaction(tx));
  } catch (error) {
    console.error('[transactionService] Ошибка в fetchTonTransactions:', error);
    return []; // Возвращаем пустой массив вместо выброса ошибки для устойчивости
  }
}

/**
 * Форматирует сырые данные транзакции в удобный формат
 * @param rawTransaction Сырые данные транзакции с сервера
 * @returns Отформатированная транзакция
 */
function formatTransaction(rawTransaction: any): Transaction {
  // Проверяем наличие полей в сыром объекте
  if (!rawTransaction || typeof rawTransaction !== 'object') {
    console.warn('[transactionService] Попытка форматирования некорректного объекта транзакции:', rawTransaction);
    
    // Возвращаем объект с дефолтными значениями для безопасности
    return {
      id: 0,
      type: TransactionType.UNKNOWN,
      title: 'Неизвестная транзакция',
      amount: 0,
      tokenType: 'UNI',
      timestamp: new Date(),
      status: TransactionStatus.PENDING,
      source: '',
      category: 'other',
      description: 'Данные транзакции недоступны'
    };
  }
  
  // Выводим все поля транзакции для отладки
  console.log('[transactionService] Форматирование транзакции:', JSON.stringify({
    id: rawTransaction.id,
    type: rawTransaction.type,
    currency: rawTransaction.currency,
    token_type: rawTransaction.token_type,
    amount: rawTransaction.amount,
    created_at: rawTransaction.created_at
  }));
  
  // Определяем тип токена из currency или token_type
  let tokenType = 'UNI';
  if (rawTransaction.currency) {
    tokenType = rawTransaction.currency.toUpperCase();
  } else if (rawTransaction.token_type) {
    tokenType = rawTransaction.token_type.toUpperCase();
  }
  
  // Проверка и логирование для TON транзакций
  if (tokenType === 'TON') {
    console.log('[transactionService] 🔵 Обнаружена TON транзакция:', {
      id: rawTransaction.id,
      type: rawTransaction.type,
      currency: tokenType,
      amount: rawTransaction.amount,
      created_at: rawTransaction.created_at
    });
  }
  
  // Определяем тип транзакции
  const type = formatTransactionType(rawTransaction.type || 'unknown');
  const title = getTransactionTitle(type);
  const category = getTransactionCategory(type) || rawTransaction.category || 'other';
  
  // Определяем timestamp из created_at или timestamp
  let timestamp = new Date();
  if (rawTransaction.created_at) {
    timestamp = new Date(rawTransaction.created_at);
  } else if (rawTransaction.timestamp) {
    timestamp = new Date(rawTransaction.timestamp);
  }
  
  // Определяем статус транзакции  
  const status = formatTransactionStatus(rawTransaction.status || 'pending');
  
  // Создаем форматированный объект Transaction
  const formattedTransaction: Transaction = {
    id: rawTransaction.id || 0,
    type: type,
    title: rawTransaction.title || title,
    amount: typeof rawTransaction.amount === 'string' ? parseFloat(rawTransaction.amount) : (rawTransaction.amount || 0),
    tokenType: tokenType,
    timestamp: timestamp,
    status: status,
    source: rawTransaction.source || '',
    category: category,
    description: rawTransaction.description || ''
  };
  
  return formattedTransaction;
}

/**
 * Форматирует тип транзакции в стандартный формат
 * @param type Тип транзакции из API
 * @returns Стандартизированный тип транзакции
 */
function formatTransactionType(type: string): string {
  const typeMap: { [key: string]: string } = {
    'deposit': TransactionType.DEPOSIT,
    'withdrawal': TransactionType.WITHDRAWAL,
    'bonus': TransactionType.BONUS,
    'farming_deposit': TransactionType.FARMING_DEPOSIT,
    'farming_reward': TransactionType.FARMING_REWARD,
    'farming_harvest': TransactionType.FARMING_HARVEST,
    'referral_reward': TransactionType.REFERRAL_REWARD,
    'daily_bonus': TransactionType.DAILY_BONUS,
    'signup_bonus': TransactionType.SIGNUP_BONUS,
    'airdrop': TransactionType.AIRDROP,
    'ton_boost': TransactionType.TON_BOOST,
    'boost': TransactionType.BOOST,
    'boost_purchase': TransactionType.TON_BOOST, // Новый тип транзакции для boost_purchase
    'ton_farming_reward': TransactionType.TON_FARMING_REWARD
  };
  
  return typeMap[type.toLowerCase()] || TransactionType.UNKNOWN;
}

/**
 * Форматирует статус транзакции в стандартный формат
 * @param status Статус транзакции из API
 * @returns Стандартизированный статус транзакции
 */
function formatTransactionStatus(status: string): string {
  const statusMap: { [key: string]: string } = {
    'pending': TransactionStatus.PENDING,
    'completed': TransactionStatus.COMPLETED,
    'failed': TransactionStatus.FAILED
  };
  
  return statusMap[status.toLowerCase()] || TransactionStatus.PENDING;
}

/**
 * Получает категорию транзакции на основе типа
 * @param type Тип транзакции
 * @returns Категория транзакции
 */
function getTransactionCategory(type: string): string {
  const categoryMap: { [key: string]: string } = {
    [TransactionType.DEPOSIT]: 'deposit',
    [TransactionType.WITHDRAWAL]: 'withdrawal',
    [TransactionType.FARMING_DEPOSIT]: 'farming',
    [TransactionType.FARMING_REWARD]: 'farming',
    [TransactionType.FARMING_HARVEST]: 'farming',
    [TransactionType.BONUS]: 'bonus',
    [TransactionType.REFERRAL_REWARD]: 'referral',
    [TransactionType.DAILY_BONUS]: 'bonus',
    [TransactionType.SIGNUP_BONUS]: 'bonus',
    [TransactionType.AIRDROP]: 'airdrop',
    [TransactionType.TON_BOOST]: 'boost',
    [TransactionType.BOOST]: 'boost',
    [TransactionType.TON_FARMING_REWARD]: 'farming'
  };
  
  return categoryMap[type] || 'other';
}

/**
 * Получает заголовок транзакции на основе типа
 * @param type Тип транзакции
 * @returns Заголовок транзакции
 */
function getTransactionTitle(type: string): string {
  const titleMap: { [key: string]: string } = {
    [TransactionType.DEPOSIT]: 'Пополнение',
    [TransactionType.WITHDRAWAL]: 'Вывод средств',
    [TransactionType.FARMING_DEPOSIT]: 'Депозит в фарминг',
    [TransactionType.FARMING_REWARD]: 'Доход фарминга',
    [TransactionType.FARMING_HARVEST]: 'Сбор фарминга',
    [TransactionType.BONUS]: 'Бонус',
    [TransactionType.REFERRAL_REWARD]: 'Реферальное вознаграждение',
    [TransactionType.DAILY_BONUS]: 'Ежедневный бонус',
    [TransactionType.SIGNUP_BONUS]: 'Бонус регистрации',
    [TransactionType.AIRDROP]: 'Airdrop',
    [TransactionType.TON_BOOST]: 'Покупка TON Boost',
    [TransactionType.BOOST]: 'Boost пакет',
    [TransactionType.TON_FARMING_REWARD]: 'Начисление TON фарминга',
    'boost_purchase': 'Покупка TON Boost'
  };
  
  return titleMap[type] || 'Другая операция';
}