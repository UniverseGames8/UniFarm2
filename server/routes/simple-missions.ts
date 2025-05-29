/**
 * ПРОСТИЙ РАБОЧИЙ МАРШРУТ ДЛЯ МИССИЙ
 * Прямое подключение к БД без сложной архитектуры
 */

import { Router } from 'express';

const router = Router();

// Простий ендпоінт для активних місій
router.get('/api/v2/missions/active', async (req, res) => {
  try {
    console.log('[SIMPLE MISSIONS] 🚀 Запрос активных миссий');
    
    const { getSingleDbConnection } = await import('../single-db-connection');
    const { missions } = await import('../../shared/schema');
    const { eq } = await import('drizzle-orm');
    
    const db = await getSingleDbConnection();
    const activeMissions = await db
      .select()
      .from(missions)
      .where(eq(missions.is_active, true));
    
    console.log('[SIMPLE MISSIONS] 📋 Найдено миссий:', activeMissions.length);
    
    // Добавляем ссылки для каждой миссии
    const withLinks = activeMissions.map(mission => ({
      ...mission,
      link: mission.link || getDefaultLink(mission.type)
    }));
    
    console.log('[SIMPLE MISSIONS] 📋 Миссии с ссылками:', withLinks);

    res.status(200).json({
      success: true,
      data: withLinks,
      message: `Найдено ${withLinks.length} активных миссий`
    });

  } catch (error) {
    console.error('[SIMPLE MISSIONS] ❌ Ошибка:', error);

    res.status(500).json({
      success: false,
      error: 'Ошибка получения миссий',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// Функция для получения дефолтных ссылок
function getDefaultLink(type: string): string {
  switch (type) {
    case 'telegram_group':
      return 'https://t.me/unifarmchat';
    case 'telegram_channel':
      return 'https://t.me/unifarmchannel';
    case 'youtube':
      return 'https://youtube.com/@unifarm';
    case 'tiktok':
      return 'https://tiktok.com/@unifarm';
    default:
      return 'https://t.me/unifarm';
  }
}

// Простий ендпоінт для виконаних місій користувача
router.get('/api/v2/user-missions', async (req, res) => {
  try {
    const userId = parseInt(req.query.user_id as string) || 1;
    console.log('[SIMPLE MISSIONS] 🔍 Запрос выполненных миссий для пользователя:', userId);
    
    const { getSingleDbConnection } = await import('../single-db-connection');
    const { userMissions } = await import('../../shared/schema');
    const { eq } = await import('drizzle-orm');
    
    const db = await getSingleDbConnection();
    const completedMissions = await db
      .select()
      .from(userMissions)
      .where(eq(userMissions.user_id, userId));
    
    res.status(200).json({
      success: true,
      data: completedMissions,
      message: `Найдено ${completedMissions.length} выполненных миссий`
    });
    
  } catch (error) {
    console.error('[SIMPLE MISSIONS] ❌ Помилка user missions:', error);
    
    res.status(500).json({
      success: false,
      error: 'Помилка отримання виконаних місій'
    });
  }
});

// Ендпоінт для завершення місії
router.post('/api/v2/missions/complete', async (req, res) => {
  try {
    const { user_id, mission_id } = req.body;
    console.log('[SIMPLE MISSIONS] 🎯 Завершение миссии:', { user_id, mission_id });
    
    const { getSingleDbConnection } = await import('../single-db-connection');
    const { userMissions, users, missions } = await import('../../shared/schema');
    const { eq, and } = await import('drizzle-orm');
    
    const db = await getSingleDbConnection();
    
    // КРИТИЧНО: Перевіряємо чи місія не була виконана раніше
    const existingCompletion = await db
      .select()
      .from(userMissions)
      .where(and(
        eq(userMissions.user_id, user_id),
        eq(userMissions.mission_id, mission_id)
      ));
    
    if (existingCompletion.length > 0) {
      console.log('[SIMPLE MISSIONS] ⚠️ Повторное выполнение миссии заблокировано:', { user_id, mission_id });
      return res.status(409).json({
        success: false,
        error: 'Миссия уже выполнена',
        code: 'MISSION_ALREADY_COMPLETED',
        message: 'Эта миссия уже была выполнена ранее'
      });
    }
    
    // Отримуємо інформацію про місію для нагороди
    const mission = await db
      .select()
      .from(missions)
      .where(eq(missions.id, mission_id));
    
    if (mission.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Миссия не найдена'
      });
    }
    
    const reward = parseFloat(mission[0].reward_uni || '0');
    
    // Записуємо виконання місії
    await db.insert(userMissions).values({
      user_id,
      mission_id,
      completed_at: new Date()
    });
    
    // Нараховуємо нагороду користувачу через Drizzle
    await db
      .update(users)
      .set({
        balance_uni: `(balance_uni::numeric + ${reward})::varchar`
      })
      .where(eq(users.id, user_id));
    
    console.log('[SIMPLE MISSIONS] ✅ Миссия завершена, награда:', reward);
    
    res.status(200).json({
      success: true,
      data: {
        mission_id,
        reward,
        message: `Получено ${reward} UNI!`
      },
      message: 'Миссия успешно завершена'
    });
    
  } catch (error) {
    console.error('[SIMPLE MISSIONS] ❌ Помилка завершення місії:', error);
    
    res.status(500).json({
      success: false,
      error: 'Помилка завершення місії',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;