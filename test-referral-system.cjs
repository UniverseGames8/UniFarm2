/**
 * Скрипт для тестирования и сравнения производительности
 * стандартной и оптимизированной реферальной системы
 * 
 * Этот скрипт запускает серию тестов для измерения эффективности рекурсивных CTE
 * в сравнении со стандартными запросами при работе с глубокими реферальными структурами.
 */

require('dotenv').config();
const { Pool } = require('pg');

// Подключение к базе данных
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Базовая конфигурация тестов
const config = {
  // Количество уровней в тестовой реферальной структуре
  depth: 5,
  
  // Коэффициент ветвления (сколько рефералов у каждого пользователя)
  branchingFactor: 3,
  
  // Очищать ли тестовых пользователей после тестирования
  cleanupAfterTests: true,
  
  // Показывать ли подробные результаты SQL запросов
  verboseOutput: false
};

/**
 * Выполняет SQL запрос
 * @param {string} query SQL запрос
 * @param {Array} params Параметры запроса
 * @returns {Promise<Object>} Результат запроса
 */
async function executeQuery(query, params = []) {
  const client = await pool.connect();
  try {
    return await client.query(query, params);
  } finally {
    client.release();
  }
}

/**
 * Создает тестовую реферальную структуру
 * @returns {Promise<Object>} Информация о созданной структуре
 */
async function createTestReferralStructure() {
  console.log(`\n🔄 Создание тестовой реферальной структуры (глубина: ${config.depth}, ветвление: ${config.branchingFactor})...`);
  
  // Очистка существующих тестовых данных (если есть)
  await executeQuery("DELETE FROM users WHERE username LIKE 'test_opt_%'");
  
  // Создаем корневого пользователя
  const rootResult = await executeQuery(`
    INSERT INTO users (username, ref_code, parent_ref_code, balance_uni, balance_ton)
    VALUES ('test_opt_root', 'ROOT_OPT', NULL, '1000.0', '10.0')
    RETURNING id, ref_code
  `);
  
  const rootId = rootResult.rows[0].id;
  const rootRefCode = rootResult.rows[0].ref_code;
  
  console.log(`✅ Создан корневой пользователь: ID ${rootId}, ref_code: ${rootRefCode}`);
  
  // Рекурсивно создаем дерево рефералов
  async function createReferralsRecursively(level, parentId, parentRefCode, path = '') {
    if (level > config.depth) {
      return;
    }
    
    for (let i = 0; i < config.branchingFactor; i++) {
      const username = `test_opt_${level}_${path}${i}`;
      const refCode = `REF_OPT_${level}_${path}${i}`;
      
      // Создаем пользователя
      const userResult = await executeQuery(`
        INSERT INTO users (username, ref_code, parent_ref_code, balance_uni, balance_ton)
        VALUES ($1, $2, $3, '100.0', '1.0')
        RETURNING id
      `, [username, refCode, parentRefCode]);
      
      const userId = userResult.rows[0].id;
      
      // Создаем запись в таблице referrals
      await executeQuery(`
        INSERT INTO referrals (user_id, inviter_id, level)
        VALUES ($1, $2, 1)
      `, [userId, parentId]);
      
      // Рекурсивно создаем дочерние уровни
      await createReferralsRecursively(level + 1, userId, refCode, `${path}${i}_`);
    }
  }
  
  // Запускаем создание структуры
  await createReferralsRecursively(1, rootId, rootRefCode);
  
  // Подсчитываем созданных пользователей
  const countResult = await executeQuery(`
    SELECT COUNT(*) FROM users WHERE username LIKE 'test_opt_%'
  `);
  
  const totalCount = parseInt(countResult.rows[0].count);
  
  console.log(`✅ Создано ${totalCount} тестовых пользователей в реферальной структуре`);
  
  return {
    rootId,
    rootRefCode,
    totalUsers: totalCount
  };
}

/**
 * Тестирует стандартный подход к получению структуры рефералов
 * @param {number} rootId ID корневого пользователя
 * @returns {Promise<Object>} Результаты теста
 */
async function testStandardApproach(rootId) {
  console.log(`\n🔄 Тестирование стандартного подхода к получению рефералов...`);
  
  const startTime = performance.now();
  let queryCount = 0;
  
  // Имитация стандартного подхода - последовательные запросы для каждого уровня
  async function getReferralsStandardWay(userId, currentLevel = 0, maxLevel = config.depth) {
    if (currentLevel >= maxLevel) {
      return { count: 0, users: [] };
    }
    
    // Получаем прямых рефералов пользователя
    const query = `
      SELECT u.id, u.username, u.ref_code 
      FROM users u
      WHERE u.parent_ref_code = (
        SELECT ref_code FROM users WHERE id = $1
      )
    `;
    
    const result = await executeQuery(query, [userId]);
    queryCount++;
    
    let totalCount = result.rows.length;
    let allUsers = [...result.rows];
    
    // Для каждого реферала рекурсивно получаем его рефералов
    for (const user of result.rows) {
      const childResults = await getReferralsStandardWay(
        user.id, 
        currentLevel + 1,
        maxLevel
      );
      
      totalCount += childResults.count;
      allUsers = allUsers.concat(childResults.users);
    }
    
    return { count: totalCount, users: allUsers };
  }
  
  // Выполняем стандартный подход
  const result = await getReferralsStandardWay(rootId);
  
  const endTime = performance.now();
  const duration = endTime - startTime;
  
  console.log(`✅ Стандартный подход: ${result.count} рефералов найдено`);
  console.log(`⏱️ Время выполнения: ${duration.toFixed(2)} мс`);
  console.log(`🔍 Количество SQL запросов: ${queryCount}`);
  
  return {
    count: result.count,
    duration,
    queryCount,
    approach: 'standard'
  };
}

/**
 * Тестирует оптимизированный подход с рекурсивными CTE
 * @param {number} rootId ID корневого пользователя
 * @returns {Promise<Object>} Результаты теста
 */
async function testOptimizedApproach(rootId) {
  console.log(`\n🔄 Тестирование оптимизированного подхода с рекурсивными CTE...`);
  
  const startTime = performance.now();
  
  // Выполняем единственный SQL запрос с рекурсивным CTE
  const query = `
    WITH RECURSIVE referral_chain AS (
      -- Начальный запрос: находим прямых рефералов
      SELECT 
        u.id, 
        u.username, 
        u.ref_code, 
        u.parent_ref_code,
        1 AS level
      FROM 
        users u
      INNER JOIN 
        (SELECT ref_code FROM users WHERE id = $1) root
      ON 
        u.parent_ref_code = root.ref_code
      
      UNION ALL
      
      -- Рекурсивный запрос: находим рефералов более глубоких уровней
      SELECT 
        u.id, 
        u.username, 
        u.ref_code, 
        u.parent_ref_code, 
        rc.level + 1 AS level
      FROM 
        users u
      INNER JOIN 
        referral_chain rc ON u.parent_ref_code = rc.ref_code
      WHERE 
        rc.level < $2 -- Ограничиваем глубину
    )
    -- Финальная выборка с группировкой по уровням
    SELECT 
      level,
      COUNT(*) AS count,
      ARRAY_AGG(id) AS user_ids
    FROM 
      referral_chain
    GROUP BY 
      level
    ORDER BY 
      level
  `;
  
  const result = await executeQuery(query, [rootId, config.depth]);
  
  const endTime = performance.now();
  const duration = endTime - startTime;
  
  // Подсчитываем общее количество рефералов
  let totalCount = 0;
  for (const row of result.rows) {
    totalCount += parseInt(row.count);
  }
  
  console.log(`✅ Оптимизированный подход: ${totalCount} рефералов найдено`);
  console.log(`⏱️ Время выполнения: ${duration.toFixed(2)} мс`);
  console.log(`🔍 Количество SQL запросов: 1`);
  
  if (config.verboseOutput) {
    console.log("\nРаспределение по уровням:");
    for (const row of result.rows) {
      console.log(`Уровень ${row.level}: ${row.count} пользователей`);
    }
  }
  
  return {
    count: totalCount,
    duration,
    queryCount: 1,
    approach: 'optimized',
    levelDistribution: result.rows
  };
}

/**
 * Тестирует получение цепочки инвайтеров с использованием рекурсивных CTE
 * @param {number} userId ID пользователя
 * @returns {Promise<Object>} Результаты теста
 */
async function testGetInviters(userId) {
  console.log(`\n🔄 Тестирование получения цепочки инвайтеров для пользователя ${userId}...`);
  
  const startTime = performance.now();
  
  // Выполняем запрос с рекурсивным CTE для получения цепочки инвайтеров
  const query = `
    WITH RECURSIVE inviter_chain AS (
      -- Начальный запрос: находим прямого инвайтера
      SELECT 
        u.id, 
        u.username,
        u.ref_code, 
        u.parent_ref_code,
        1 AS level
      FROM 
        users u
      INNER JOIN
        users target ON u.ref_code = target.parent_ref_code
      WHERE 
        target.id = $1
      
      UNION ALL
      
      -- Рекурсивный запрос: находим инвайтеров более высоких уровней
      SELECT 
        u.id, 
        u.username,
        u.ref_code, 
        u.parent_ref_code, 
        ic.level + 1 AS level
      FROM 
        users u
      INNER JOIN 
        inviter_chain ic ON u.ref_code = ic.parent_ref_code
      WHERE 
        u.parent_ref_code IS NOT NULL AND
        ic.level < 20
    )
    -- Финальная выборка
    SELECT 
      id,
      username,
      level
    FROM 
      inviter_chain
    ORDER BY 
      level
  `;
  
  const result = await executeQuery(query, [userId]);
  
  const endTime = performance.now();
  const duration = endTime - startTime;
  
  console.log(`✅ Найдено ${result.rows.length} инвайтеров в цепочке`);
  console.log(`⏱️ Время выполнения: ${duration.toFixed(2)} мс`);
  
  if (config.verboseOutput && result.rows.length > 0) {
    console.log("\nЦепочка инвайтеров:");
    for (const row of result.rows) {
      console.log(`Уровень ${row.level}: ID ${row.id}, ${row.username}`);
    }
  }
  
  return {
    count: result.rows.length,
    duration,
    inviters: result.rows
  };
}

/**
 * Тестирует атомарную транзакцию для распределения реферальных вознаграждений
 * @param {number} userId ID пользователя
 * @returns {Promise<Object>} Результаты теста
 */
async function testAtomicRewardsDistribution(userId) {
  console.log(`\n🔄 Тестирование атомарной транзакции для распределения реферальных вознаграждений...`);
  
  const client = await pool.connect();
  const startTime = performance.now();
  
  try {
    await client.query('BEGIN');
    
    // Создаем запись о распределении вознаграждений
    const batchId = `test-${Date.now()}`;
    const amount = 100; // Тестовая сумма в UNI
    
    await client.query(`
      INSERT INTO reward_distribution_logs 
      (source_user_id, batch_id, currency, earned_amount, status, processed_at)
      VALUES ($1, $2, 'UNI', $3, 'processing', NOW())
    `, [userId, batchId, amount.toString()]);
    
    // Получаем цепочку инвайтеров в одном запросе
    const invitersQuery = `
      WITH RECURSIVE inviter_chain AS (
        SELECT 
          u.id,
          u.parent_ref_code,
          1 AS level
        FROM 
          users u
        WHERE 
          u.id = $1
        
        UNION ALL
        
        SELECT 
          u.id,
          u.parent_ref_code,
          ic.level + 1
        FROM 
          users u
        JOIN 
          inviter_chain ic ON u.ref_code = ic.parent_ref_code
        WHERE 
          u.parent_ref_code IS NOT NULL AND
          ic.level < 20
      )
      SELECT 
        u.id,
        u.username,
        u.balance_uni,
        ic.level
      FROM 
        inviter_chain ic
      JOIN 
        users u ON u.id = ic.id
      WHERE 
        ic.level > 0
      ORDER BY 
        ic.level
    `;
    
    const invitersResult = await client.query(invitersQuery, [userId]);
    const inviters = invitersResult.rows;
    
    if (inviters.length === 0) {
      await client.query(`
        UPDATE reward_distribution_logs
        SET status = 'completed', levels_processed = 0, inviter_count = 0, 
            total_distributed = '0', completed_at = NOW()
        WHERE batch_id = $1
      `, [batchId]);
      
      await client.query('COMMIT');
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`✅ Нет инвайтеров для распределения вознаграждений`);
      console.log(`⏱️ Время выполнения: ${duration.toFixed(2)} мс`);
      
      return {
        batchId,
        invitersCount: 0,
        totalDistributed: 0,
        duration,
        status: 'completed'
      };
    }
    
    // Процент вознаграждения по уровням
    const levelPercents = [
      5.0,  // Уровень 1: 5%
      3.0,  // Уровень 2: 3%
      2.0,  // Уровень 3: 2%
      1.0,  // Уровень 4: 1%
      0.8,  // Уровень 5: 0.8%
      0.5,  // Уровень 6: 0.5%
      0.3,  // Уровень 7: 0.3%
      0.3,  // Уровень 8: 0.3%
      0.3,  // Уровень 9: 0.3%
      0.3,  // Уровень 10: 0.3%
      0.2,  // Уровень 11: 0.2%
      0.2,  // Уровень 12: 0.2%
      0.2,  // Уровень 13: 0.2%
      0.2,  // Уровень 14: 0.2%
      0.2,  // Уровень 15: 0.2%
      0.1,  // Уровень 16: 0.1%
      0.1,  // Уровень 17: 0.1%
      0.1,  // Уровень 18: 0.1%
      0.1,  // Уровень 19: 0.1%
      0.1   // Уровень 20: 0.1%
    ];
    
    let totalDistributed = 0;
    let updatedInviters = 0;
    let balanceUpdates = [];
    
    // Рассчитываем и собираем обновления балансов для всех инвайтеров
    for (const inviter of inviters) {
      const level = inviter.level;
      if (level <= 0 || level > 20) continue;
      
      const percent = levelPercents[level - 1];
      const bonusAmount = amount * (percent / 100);
      
      if (bonusAmount <= 0) continue;
      
      const currentBalance = parseFloat(inviter.balance_uni);
      const newBalance = currentBalance + bonusAmount;
      
      balanceUpdates.push({
        id: inviter.id,
        bonusAmount,
        newBalance,
        level,
        percent
      });
      
      totalDistributed += bonusAmount;
      updatedInviters++;
    }
    
    // Выполняем пакетное обновление балансов
    if (balanceUpdates.length > 0) {
      // Создаем значения для подстановки в запрос
      const valueStrings = [];
      const valueParams = [];
      let paramIndex = 1;
      
      for (const update of balanceUpdates) {
        valueStrings.push(`($${paramIndex}, $${paramIndex + 1}::numeric)`);
        valueParams.push(update.id, update.newBalance.toString());
        paramIndex += 2;
      }
      
      // Формируем и выполняем пакетный запрос на обновление балансов
      const updateBalanceQuery = `
        UPDATE users AS u
        SET balance_uni = v.new_balance
        FROM (VALUES ${valueStrings.join(', ')}) AS v(id, new_balance)
        WHERE u.id = v.id::integer
      `;
      
      await client.query(updateBalanceQuery, valueParams);
      
      // Записываем транзакции для каждого обновления
      for (const update of balanceUpdates) {
        await client.query(`
          INSERT INTO transactions (
            user_id, type, currency, amount, status, source, 
            description, source_user_id, category, data
          )
          VALUES ($1, 'referral', 'UNI', $2, 'confirmed', 'Referral Income', 
                  $3, $4, 'bonus', $5)
        `, [
          update.id,
          update.bonusAmount.toString(),
          `Referral reward from level ${update.level} farming (test)`,
          userId,
          JSON.stringify({
            batch_id: batchId,
            level: update.level,
            percent: update.percent
          })
        ]);
      }
    }
    
    // Обновляем запись в журнале распределения
    await client.query(`
      UPDATE reward_distribution_logs
      SET 
        status = 'completed', 
        levels_processed = $1, 
        inviter_count = $2, 
        total_distributed = $3, 
        completed_at = NOW()
      WHERE batch_id = $4
    `, [
      inviters.length,
      updatedInviters,
      totalDistributed.toString(),
      batchId
    ]);
    
    // Завершаем транзакцию
    await client.query('COMMIT');
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.log(`✅ Успешно распределено ${totalDistributed.toFixed(6)} UNI среди ${updatedInviters} инвайтеров`);
    console.log(`⏱️ Время выполнения: ${duration.toFixed(2)} мс`);
    
    if (config.verboseOutput && balanceUpdates.length > 0) {
      console.log("\nОбновления балансов:");
      for (const update of balanceUpdates) {
        console.log(`Уровень ${update.level}: ID ${update.id}, Бонус: ${update.bonusAmount.toFixed(6)} UNI (${update.percent}%)`);
      }
    }
    
    return {
      batchId,
      invitersCount: updatedInviters,
      totalDistributed,
      duration,
      status: 'completed'
    };
  } catch (error) {
    // В случае ошибки откатываем транзакцию
    await client.query('ROLLBACK');
    
    console.error(`❌ Ошибка при распределении вознаграждений:`, error);
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    return {
      error: error.message,
      duration,
      status: 'failed'
    };
  } finally {
    client.release();
  }
}

/**
 * Очищает тестовые данные
 */
async function cleanupTestData() {
  console.log(`\n🧹 Очистка тестовых данных...`);
  
  try {
    // Удаляем транзакции, связанные с тестовыми пользователями
    await executeQuery(`
      DELETE FROM transactions 
      WHERE source_user_id IN (SELECT id FROM users WHERE username LIKE 'test_opt_%')
      OR user_id IN (SELECT id FROM users WHERE username LIKE 'test_opt_%')
    `);
    
    // Удаляем тестовые записи reward_distribution_logs
    await executeQuery(`
      DELETE FROM reward_distribution_logs
      WHERE source_user_id IN (SELECT id FROM users WHERE username LIKE 'test_opt_%')
    `);
    
    // Удаляем тестовые записи referrals
    await executeQuery(`
      DELETE FROM referrals
      WHERE user_id IN (SELECT id FROM users WHERE username LIKE 'test_opt_%')
      OR inviter_id IN (SELECT id FROM users WHERE username LIKE 'test_opt_%')
    `);
    
    // Удаляем тестовых пользователей
    const deleteResult = await executeQuery(`
      DELETE FROM users WHERE username LIKE 'test_opt_%'
      RETURNING id
    `);
    
    console.log(`✅ Удалено ${deleteResult.rows.length} тестовых пользователей`);
  } catch (error) {
    console.error(`❌ Ошибка при очистке данных:`, error);
  }
}

/**
 * Запускает все тесты и выводит сравнительные результаты
 */
async function runTests() {
  try {
    console.log(`🚀 Запуск тестов оптимизированной реферальной системы\n`);
    console.log(`Конфигурация:`);
    console.log(`- Глубина структуры: ${config.depth}`);
    console.log(`- Коэффициент ветвления: ${config.branchingFactor}`);
    
    // Создаем тестовую структуру
    const { rootId } = await createTestReferralStructure();
    
    // Тестируем стандартный подход
    const standardResults = await testStandardApproach(rootId);
    
    // Тестируем оптимизированный подход
    const optimizedResults = await testOptimizedApproach(rootId);
    
    // Выбираем пользователя с глубокого уровня для тестирования цепочки инвайтеров
    const leafQuery = `
      WITH RECURSIVE all_users AS (
        SELECT id FROM users WHERE id = $1
        
        UNION ALL
        
        SELECT u.id
        FROM users u
        JOIN all_users au ON u.parent_ref_code = (SELECT ref_code FROM users WHERE id = au.id)
      )
      SELECT id FROM all_users
      WHERE id <> $1
      ORDER BY id DESC
      LIMIT 1
    `;
    
    const leafResult = await executeQuery(leafQuery, [rootId]);
    
    if (leafResult.rows.length > 0) {
      const leafId = leafResult.rows[0].id;
      
      // Тестируем получение цепочки инвайтеров
      await testGetInviters(leafId);
      
      // Тестируем атомарное распределение вознаграждений
      await testAtomicRewardsDistribution(leafId);
    }
    
    // Сравнение результатов
    console.log(`\n📊 Сравнение результатов:`);
    console.log(`┌──────────────────────┬───────────────┬────────────────┐`);
    console.log(`│ Метрика              │ Стандартный   │ Оптимизированный │`);
    console.log(`├──────────────────────┼───────────────┼────────────────┤`);
    console.log(`│ Время выполнения, мс │ ${standardResults.duration.toFixed(2).padStart(13)} │ ${optimizedResults.duration.toFixed(2).padStart(14)} │`);
    console.log(`│ Количество запросов  │ ${standardResults.queryCount.toString().padStart(13)} │ ${optimizedResults.queryCount.toString().padStart(14)} │`);
    console.log(`│ Найдено рефералов    │ ${standardResults.count.toString().padStart(13)} │ ${optimizedResults.count.toString().padStart(14)} │`);
    console.log(`└──────────────────────┴───────────────┴────────────────┘`);
    
    // Расчет ускорения
    const speedup = standardResults.duration / optimizedResults.duration;
    console.log(`\n🚀 Ускорение: ${speedup.toFixed(2)}x`);
    console.log(`🔍 Сокращение SQL запросов: ${standardResults.queryCount}x`);
    
    // Очищаем тестовые данные, если указано в конфигурации
    if (config.cleanupAfterTests) {
      await cleanupTestData();
    }
    
    console.log(`\n✅ Тестирование завершено успешно`);
  } catch (error) {
    console.error(`\n❌ Ошибка при выполнении тестов:`, error);
  } finally {
    // Завершаем соединение с БД
    await pool.end();
  }
}

// Запускаем тесты
runTests();