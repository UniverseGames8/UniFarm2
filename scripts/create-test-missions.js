/**
 * Скрипт для создания тестовых миссий в базе данных
 * Используется для разработки и тестирования
 */

import pg from 'pg';
const { Pool } = pg;

// Подключение к базе данных PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Массив тестовых миссий
const testMissions = [
  {
    type: 'daily',
    title: 'Ежедневный бонус',
    description: 'Получите ежедневный бонус UNI токенов для фарминга',
    reward_uni: '10.000000',
    is_active: true
  },
  {
    type: 'social',
    title: 'Подписка на канал',
    description: 'Подпишитесь на наш Telegram канал https://t.me/unifarm',
    reward_uni: '15.000000',
    is_active: true
  },
  {
    type: 'deposit',
    title: 'Первый депозит',
    description: 'Внесите свой первый депозит в фарминг',
    reward_uni: '20.000000',
    is_active: true
  },
  {
    type: 'invite',
    title: 'Приглашение друга',
    description: 'Пригласите друга по реферальной ссылке',
    reward_uni: '25.000000',
    is_active: true
  }
];

/**
 * Создает тестовые миссии в базе данных
 */
async function createTestMissions() {
  console.log('Начинаем создание тестовых миссий...');
  
  try {
    // Подключение к базе данных
    const client = await pool.connect();
    
    try {
      // Проверяем, есть ли уже миссии в базе данных
      const checkResult = await client.query('SELECT COUNT(*) FROM missions');
      const count = parseInt(checkResult.rows[0].count, 10);
      
      if (count > 0) {
        console.log(`В базе данных уже есть ${count} миссий. Проверяем каждую тестовую миссию...`);
        
        // Проверяем и добавляем только недостающие миссии
        for (const mission of testMissions) {
          const checkMissionExists = await client.query(
            'SELECT COUNT(*) FROM missions WHERE title = $1',
            [mission.title]
          );
          
          if (parseInt(checkMissionExists.rows[0].count, 10) === 0) {
            // Добавляем новую миссию
            await client.query(
              `INSERT INTO missions (type, title, description, reward_uni, is_active)
               VALUES ($1, $2, $3, $4, $5)`,
              [mission.type, mission.title, mission.description, mission.reward_uni, mission.is_active]
            );
            console.log(`✅ Создана новая миссия: ${mission.title}`);
          } else {
            console.log(`ℹ️ Миссия "${mission.title}" уже существует, пропускаем`);
          }
        }
      } else {
        console.log('База данных пуста. Добавляем все тестовые миссии...');
        
        // Добавляем все тестовые миссии
        for (const mission of testMissions) {
          await client.query(
            `INSERT INTO missions (type, title, description, reward_uni, is_active)
             VALUES ($1, $2, $3, $4, $5)`,
            [mission.type, mission.title, mission.description, mission.reward_uni, mission.is_active]
          );
          console.log(`✅ Создана миссия: ${mission.title}`);
        }
      }
      
      // Проверяем финальное количество миссий
      const finalResult = await client.query('SELECT COUNT(*) FROM missions');
      const finalCount = parseInt(finalResult.rows[0].count, 10);
      
      console.log(`\n✅ Готово! В базе данных теперь ${finalCount} миссий.`);
    } finally {
      // Завершаем соединение
      client.release();
    }
  } catch (err) {
    console.error('Ошибка при создании тестовых миссий:', err);
  } finally {
    // Закрываем пул соединений
    await pool.end();
  }
}

// Запускаем функцию создания тестовых миссий
createTestMissions();