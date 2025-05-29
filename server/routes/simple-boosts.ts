/**
 * ПРОСТИЙ РАБОЧИЙ МАРШРУТ ДЛЯ БУСТІВ
 * Прямое подключение к БД без сложной архитектуры
 */

import { Router } from 'express';

const router = Router();

// Ендпоінт для отримання активних boost-пакетів
router.get('/api/v2/boosts/active', async (req, res) => {
  try {
    console.log('[SIMPLE BOOSTS] 🚀 Запрос активных boost-пакетов');
    
    const { getSingleDbConnection } = await import('../single-db-connection');
    const { eq } = await import('drizzle-orm');
    
    const db = await getSingleDbConnection();
    
    // Выполняем прямой SQL запрос для получения boost-пакетов с правильной логикой
    const activeBoosts = await db.execute(`
      SELECT id, name, description, price_uni, price_ton, 
             fixed_ton_daily_rate, uni_bonus_amount, duration_hours
      FROM boost_packages 
      WHERE is_active = true
      ORDER BY price_ton ASC
    `);
    
    console.log('[SIMPLE BOOSTS] 📋 Найдено boost-пакетов:', activeBoosts.length);
    
    res.status(200).json({
      success: true,
      data: activeBoosts,
      message: `Найдено ${activeBoosts.length} активных boost-пакетов`
    });

  } catch (error) {
    console.error('[SIMPLE BOOSTS] ❌ Ошибка получения boost-пакетов:', error);

    res.status(500).json({
      success: false,
      error: 'Ошибка получения boost-пакетов',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// Ендпоінт для покупки boost-пакета
router.post('/api/v2/boosts/purchase', async (req, res) => {
  try {
    const { user_id, boost_package_id } = req.body;
    console.log('[SIMPLE BOOSTS] 🛒 Покупка boost-пакета:', { user_id, boost_package_id });
    
    const { getSingleDbConnection } = await import('../single-db-connection');
    
    const db = await getSingleDbConnection();
    
    // Получаем информацию о boost-пакете
    const boostInfo = await db.execute(`
      SELECT id, name, price_uni, price_ton, boost_multiplier, duration_hours
      FROM boost_packages 
      WHERE id = ${boost_package_id} AND is_active = true
    `);
    
    if (boostInfo.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Boost-пакет не найден'
      });
    }
    
    const boost = boostInfo[0];
    
    // Проверяем баланс пользователя
    const userBalance = await db.execute(`
      SELECT balance_uni, balance_ton FROM users WHERE id = ${user_id}
    `);
    
    if (userBalance.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Пользователь не найден'
      });
    }
    
    const currentBalance = parseFloat(userBalance[0].balance_uni || '0');
    const boostPrice = parseFloat(boost.price_uni || '0');
    
    if (currentBalance < boostPrice) {
      return res.status(400).json({
        success: false,
        error: 'Недостаточно средств',
        required: boostPrice,
        available: currentBalance
      });
    }
    
    // Создаем запись о покупке boost-а
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + parseInt(boost.duration_hours || '24'));
    
    await db.execute(`
      INSERT INTO user_boosts (user_id, boost_package_id, expires_at)
      VALUES (${user_id}, ${boost_package_id}, '${expiresAt.toISOString()}')
    `);
    
    // Списываем стоимость с баланса
    await db.execute(`
      UPDATE users 
      SET balance_uni = balance_uni - ${boostPrice}
      WHERE id = ${user_id}
    `);
    
    console.log('[SIMPLE BOOSTS] ✅ Boost-пакет куплен:', boost.name);
    
    res.status(200).json({
      success: true,
      data: {
        boost_name: boost.name,
        multiplier: boost.boost_multiplier,
        duration_hours: boost.duration_hours,
        expires_at: expiresAt,
        price_paid: boostPrice
      },
      message: `Boost-пакет "${boost.name}" успешно приобретен`
    });
    
  } catch (error) {
    console.error('[SIMPLE BOOSTS] ❌ Ошибка покупки boost-пакета:', error);
    
    res.status(500).json({
      success: false,
      error: 'Ошибка покупки boost-пакета',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// Ендпоінт для получения активных бустів користувача
router.get('/api/v2/boosts/user/:user_id', async (req, res) => {
  try {
    const userId = parseInt(req.params.user_id);
    console.log('[SIMPLE BOOSTS] 📊 Запрос активных бустов пользователя:', userId);
    
    const { getSingleDbConnection } = await import('../single-db-connection');
    
    const db = await getSingleDbConnection();
    
    const userBoosts = await db.execute(`
      SELECT 
        ub.id,
        ub.purchased_at,
        ub.expires_at,
        ub.is_active,
        bp.name,
        bp.description,
        bp.boost_multiplier,
        bp.duration_hours,
        CASE 
          WHEN ub.expires_at > NOW() THEN true 
          ELSE false 
        END as is_expired
      FROM user_boosts ub
      JOIN boost_packages bp ON ub.boost_package_id = bp.id
      WHERE ub.user_id = ${userId}
      ORDER BY ub.purchased_at DESC
    `);
    
    res.status(200).json({
      success: true,
      data: userBoosts,
      message: `Найдено ${userBoosts.length} бустов пользователя`
    });
    
  } catch (error) {
    console.error('[SIMPLE BOOSTS] ❌ Ошибка получения бустов пользователя:', error);
    
    res.status(500).json({
      success: false,
      error: 'Ошибка получения бустов пользователя',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;