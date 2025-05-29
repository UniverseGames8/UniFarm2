/**
 * Предложения по исправлению выявленных ошибок в API UniFarm
 */

/************************
 * ИСПРАВЛЕНИЕ #1: Добавление валидации отрицательных сумм в /api/withdraw
 * 
 * Файл: server/controllers/withdrawController.ts (предполагаемый путь)
 ************************/

// Оригинальный код (предположительно)
export async function handleWithdraw(req, res) {
  const { user_id, amount, currency, address } = req.body;
  
  // Отсутствует проверка на отрицательные значения
  
  // Создание транзакции вывода
  const transaction = await createWithdrawTransaction(user_id, amount, currency, address);
  
  return res.json({
    success: true,
    message: "Запрос на вывод средств принят",
    data: {
      transaction_id: transaction.id
    }
  });
}

// Исправленный код
export async function handleWithdraw(req, res) {
  const { user_id, amount, currency, address } = req.body;
  
  // Добавлена проверка на отрицательные и нулевые значения
  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({
      success: false,
      message: "Сумма для вывода должна быть положительным числом"
    });
  }
  
  // Создание транзакции вывода
  const transaction = await createWithdrawTransaction(user_id, amount, currency, address);
  
  return res.json({
    success: true,
    message: "Запрос на вывод средств принят",
    data: {
      transaction_id: transaction.id
    }
  });
}

/************************
 * ИСПРАВЛЕНИЕ #2: Проверка существования пользователя в /api/harvest
 * 
 * Файл: server/controllers/farmingController.ts (предполагаемый путь)
 ************************/

// Оригинальный код (предположительно)
export async function harvestFarming(req, res) {
  const { user_id } = req.body;
  
  // Отсутствует проверка на существование пользователя
  
  // Выполнение сбора наград
  const result = await farmingService.harvestRewards(user_id);
  
  return res.json({
    success: true,
    data: result
  });
}

// Исправленный код
export async function harvestFarming(req, res) {
  const { user_id } = req.body;
  
  // Добавлена проверка существования пользователя
  const user = await storage.getUserById(user_id);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "Пользователь не найден"
    });
  }
  
  // Выполнение сбора наград
  const result = await farmingService.harvestRewards(user_id);
  
  return res.json({
    success: true,
    data: result
  });
}

/************************
 * ИСПРАВЛЕНИЕ #3: Корректная обработка несуществующих API эндпоинтов
 * 
 * Файл: server/routes.ts
 ************************/

// В конце файла server/routes.ts добавить:

// Обработка запросов к несуществующим API
app.all('/api/*', (req, res, next) => {
  // Проверяем, был ли обработан запрос ранее
  if (!res.headersSent) {
    res.status(404).json({
      success: false,
      message: "API endpoint not found"
    });
  } else {
    next();
  }
});

/************************
 * ИСПРАВЛЕНИЕ #4: Унификация структуры ответа в /api/uni-farming/deposits
 * 
 * Файл: server/controllers/uniFarmingController.ts (предполагаемый путь)
 ************************/

// Оригинальный код (предположительно)
export async function getDeposits(req, res) {
  const { user_id } = req.query;
  
  const deposits = await farmingService.getUserDeposits(user_id);
  
  // Возвращаем вложенную структуру deposits
  return res.json({
    success: true,
    data: {
      deposits: deposits
    }
  });
}

// Исправленный код
export async function getDeposits(req, res) {
  const { user_id } = req.query;
  
  const deposits = await farmingService.getUserDeposits(user_id);
  
  // Возвращаем deposits напрямую в data для унификации API
  return res.json({
    success: true,
    data: deposits
  });
}

/************************
 * ИСПРАВЛЕНИЕ #5: Исправление структуры ответа в /api/referral/tree
 * 
 * Файл: server/controllers/referralController.ts (предполагаемый путь)
 ************************/

// Оригинальный код (предположительно)
export async function getReferralTree(req, res) {
  const { user_id } = req.query;
  
  const referralsData = await referralService.getUserReferrals(user_id);
  
  // Могут отсутствовать некоторые обязательные поля
  return res.json({
    success: true,
    data: referralsData
  });
}

// Исправленный код
export async function getReferralTree(req, res) {
  const { user_id } = req.query;
  
  const user = await storage.getUserById(user_id);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "Пользователь не найден"
    });
  }
  
  const referralsData = await referralService.getUserReferrals(user_id);
  
  // Убеждаемся, что все необходимые поля присутствуют
  return res.json({
    success: true,
    data: {
      ownRefCode: user.ref_code, // Гарантируем наличие поля ownRefCode
      personalReferrals: referralsData.personalReferrals || [],
      referralCounts: referralsData.referralCounts || {},
      referralRewards: referralsData.referralRewards || {},
      totalReferralCount: referralsData.totalReferralCount || 0,
      ...referralsData // Сохраняем все остальные поля
    }
  });
}