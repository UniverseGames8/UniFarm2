/**
 * ПОЛНАЯ ПРОВЕРКА СИСТЕМЫ UNIFARM СОГЛАСНО RIOTMAP.md
 * 
 * Этот скрипт проверяет соответствие всех компонентов системы
 * официальной спецификации RIOTMAP.md
 */

import pkg from 'pg';
const { Pool } = pkg;

// Подключение к базе данных
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.NEON_DATABASE_URL,
});

class RiotmapAuditor {
  constructor() {
    this.results = {
      missions: { passed: 0, failed: 0, details: [] },
      tonBoost: { passed: 0, failed: 0, details: [] },
      farming: { passed: 0, failed: 0, details: [] },
      referral: { passed: 0, failed: 0, details: [] },
      dailyBonus: { passed: 0, failed: 0, details: [] },
      api: { passed: 0, failed: 0, details: [] },
      database: { passed: 0, failed: 0, details: [] }
    };
  }

  log(message, status = 'info') {
    const colors = {
      info: '\x1b[36m',    // cyan
      pass: '\x1b[32m',    // green
      fail: '\x1b[31m',    // red
      warn: '\x1b[33m',    // yellow
      reset: '\x1b[0m'
    };
    console.log(`${colors[status]}${message}${colors.reset}`);
  }

  async checkMissions() {
    this.log('\n🎯 ПРОВЕРКА МИССИЙ СОГЛАСНО RIOTMAP.md', 'info');
    this.log('='.repeat(50), 'info');

    try {
      // Проверяем миссии в базе данных
      const missionsQuery = 'SELECT * FROM missions WHERE is_active = true ORDER BY id';
      const { rows: missions } = await pool.query(missionsQuery);

      // Ожидаемые миссии согласно RIOTMAP.md
      const expectedMissions = [
        { type: 'telegram_group', reward: '500.00', link: 'https://t.me/universegameschat' },
        { type: 'telegram_channel', reward: '500.00', link: 'https://t.me/universegames' },
        { type: 'youtube', reward: '500.00', link: 'https://youtube.com/@universegamesyoutube' },
        { type: 'tiktok', reward: '500.00', link: 'https://www.tiktok.com/@universegames.io' }
      ];

      this.log(`✓ Найдено миссий в БД: ${missions.length}`, missions.length === 4 ? 'pass' : 'fail');
      
      if (missions.length === 4) {
        this.results.missions.passed++;
        this.results.missions.details.push('✓ Количество миссий соответствует RIOTMAP (4 шт.)');
      } else {
        this.results.missions.failed++;
        this.results.missions.details.push(`✗ Ожидалось 4 миссии, найдено ${missions.length}`);
      }

      // Проверяем каждую миссию
      for (let i = 0; i < expectedMissions.length; i++) {
        const expected = expectedMissions[i];
        const actual = missions[i];

        if (actual) {
          // Проверяем тип
          if (actual.type === expected.type) {
            this.log(`  ✓ Миссия ${i+1}: тип ${actual.type} корректен`, 'pass');
            this.results.missions.passed++;
          } else {
            this.log(`  ✗ Миссия ${i+1}: ожидался тип ${expected.type}, получен ${actual.type}`, 'fail');
            this.results.missions.failed++;
          }

          // Проверяем вознаграждение
          if (parseFloat(actual.reward_uni) === 500.00) {
            this.log(`  ✓ Миссия ${i+1}: вознаграждение 500 UNI корректно`, 'pass');
            this.results.missions.passed++;
          } else {
            this.log(`  ✗ Миссия ${i+1}: ожидалось 500 UNI, получено ${actual.reward_uni}`, 'fail');
            this.results.missions.failed++;
          }

          // Проверяем ссылку
          if (actual.link === expected.link) {
            this.log(`  ✓ Миссия ${i+1}: ссылка корректна`, 'pass');
            this.results.missions.passed++;
          } else {
            this.log(`  ✗ Миссия ${i+1}: неверная ссылка`, 'fail');
            this.results.missions.failed++;
          }
        } else {
          this.log(`  ✗ Миссия ${i+1} отсутствует`, 'fail');
          this.results.missions.failed++;
        }
      }

    } catch (error) {
      this.log(`✗ Ошибка проверки миссий: ${error.message}`, 'fail');
      this.results.missions.failed++;
    }
  }

  async checkTonBoost() {
    this.log('\n💎 ПРОВЕРКА TON BOOST СОГЛАСНО RIOTMAP.md', 'info');
    this.log('='.repeat(50), 'info');

    try {
      // Проверяем пакеты буста в базе данных
      const boostQuery = 'SELECT * FROM boost_packages WHERE is_active = true ORDER BY price_ton';
      const { rows: boosts } = await pool.query(boostQuery);

      // Ожидаемые пакеты согласно RIOTMAP.md
      const expectedBoosts = [
        { name: 'Starter Boost', price_ton: '1.00', bonus_uni: '10000.00', daily_percent: '0.5' },
        { name: 'Standard Boost', price_ton: '5.00', bonus_uni: '75000.00', daily_percent: '1.0' },
        { name: 'Advanced Boost', price_ton: '15.00', bonus_uni: '250000.00', daily_percent: '2.0' },
        { name: 'Premium Boost', price_ton: '25.00', bonus_uni: '500000.00', daily_percent: '2.5' }
      ];

      this.log(`✓ Найдено boost пакетов: ${boosts.length}`, boosts.length === 4 ? 'pass' : 'fail');
      
      if (boosts.length === 4) {
        this.results.tonBoost.passed++;
      } else {
        this.results.tonBoost.failed++;
      }

      // Проверяем каждый пакет
      expectedBoosts.forEach((expected, i) => {
        const actual = boosts.find(b => b.price_ton === expected.price_ton);
        if (actual) {
          this.log(`  ✓ ${expected.name}: найден`, 'pass');
          this.results.tonBoost.passed++;
        } else {
          this.log(`  ✗ ${expected.name}: отсутствует`, 'fail');
          this.results.tonBoost.failed++;
        }
      });

    } catch (error) {
      this.log(`✗ Ошибка проверки TON Boost: ${error.message}`, 'fail');
      this.results.tonBoost.failed++;
    }
  }

  async checkFarming() {
    this.log('\n🌾 ПРОВЕРКА UNI FARMING СОГЛАСНО RIOTMAP.md', 'info');
    this.log('='.repeat(50), 'info');

    try {
      // Проверяем таблицы фарминга
      const farmingTables = ['farming_deposits', 'farming_rewards'];
      
      for (const table of farmingTables) {
        const checkQuery = `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name = '${table}'`;
        const { rows } = await pool.query(checkQuery);
        
        if (rows[0].count > 0) {
          this.log(`  ✓ Таблица ${table} существует`, 'pass');
          this.results.farming.passed++;
        } else {
          this.log(`  ✗ Таблица ${table} отсутствует`, 'fail');
          this.results.farming.failed++;
        }
      }

      // Проверяем базовую доходность 3% в день
      const farmingConfigQuery = 'SELECT * FROM farming_config WHERE is_active = true';
      const { rows: configs } = await pool.query(farmingConfigQuery);
      
      if (configs.length > 0) {
        const dailyRate = parseFloat(configs[0].daily_rate || '0.03');
        if (dailyRate === 0.03) {
          this.log(`  ✓ Базовая доходность 3% в день корректна`, 'pass');
          this.results.farming.passed++;
        } else {
          this.log(`  ✗ Ожидалась доходность 3%, получена ${dailyRate * 100}%`, 'fail');
          this.results.farming.failed++;
        }
      }

    } catch (error) {
      this.log(`✗ Ошибка проверки фарминга: ${error.message}`, 'fail');
      this.results.farming.failed++;
    }
  }

  async checkReferralSystem() {
    this.log('\n👥 ПРОВЕРКА РЕФЕРАЛЬНОЙ СИСТЕМЫ СОГЛАСНО RIOTMAP.md', 'info');
    this.log('='.repeat(50), 'info');

    try {
      // Проверяем таблицы реферальной системы
      const referralTables = ['referral_tree', 'referral_rewards'];
      
      for (const table of referralTables) {
        const checkQuery = `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name = '${table}'`;
        const { rows } = await pool.query(checkQuery);
        
        if (rows[0].count > 0) {
          this.log(`  ✓ Таблица ${table} существует`, 'pass');
          this.results.referral.passed++;
        } else {
          this.log(`  ✗ Таблица ${table} отсутствует`, 'fail');
          this.results.referral.failed++;
        }
      }

      // Проверяем уникальность реферальных кодов
      const refCodesQuery = 'SELECT ref_code, COUNT(*) as count FROM users WHERE ref_code IS NOT NULL GROUP BY ref_code HAVING COUNT(*) > 1';
      const { rows: duplicates } = await pool.query(refCodesQuery);
      
      if (duplicates.length === 0) {
        this.log(`  ✓ Все реферальные коды уникальны`, 'pass');
        this.results.referral.passed++;
      } else {
        this.log(`  ✗ Найдены дублирующиеся реферальные коды: ${duplicates.length}`, 'fail');
        this.results.referral.failed++;
      }

    } catch (error) {
      this.log(`✗ Ошибка проверки реферальной системы: ${error.message}`, 'fail');
      this.results.referral.failed++;
    }
  }

  async checkDailyBonus() {
    this.log('\n🎁 ПРОВЕРКА ЕЖЕДНЕВНОГО БОНУСА СОГЛАСНО RIOTMAP.md', 'info');
    this.log('='.repeat(50), 'info');

    try {
      // Проверяем таблицу ежедневных бонусов
      const bonusQuery = 'SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name = \'daily_bonuses\'';
      const { rows } = await pool.query(bonusQuery);
      
      if (rows[0].count > 0) {
        this.log(`  ✓ Таблица daily_bonuses существует`, 'pass');
        this.results.dailyBonus.passed++;
      } else {
        this.log(`  ✗ Таблица daily_bonuses отсутствует`, 'fail');
        this.results.dailyBonus.failed++;
      }

      // Проверяем логику streak (последовательных дней)
      const streakQuery = 'SELECT * FROM daily_bonuses WHERE streak_days > 0 LIMIT 1';
      const { rows: streakData } = await pool.query(streakQuery);
      
      if (streakData.length > 0) {
        this.log(`  ✓ Система streak бонусов активна`, 'pass');
        this.results.dailyBonus.passed++;
      } else {
        this.log(`  ! Система streak бонусов не использовалась`, 'warn');
      }

    } catch (error) {
      this.log(`✗ Ошибка проверки ежедневного бонуса: ${error.message}`, 'fail');
      this.results.dailyBonus.failed++;
    }
  }

  async checkAPIRoutes() {
    this.log('\n🔗 ПРОВЕРКА API МАРШРУТОВ СОГЛАСНО RIOTMAP.md', 'info');
    this.log('='.repeat(50), 'info');

    try {
      // Основные API эндпоинты согласно RIOTMAP.md
      const expectedRoutes = [
        '/api/v2/missions/active',
        '/api/v2/missions/complete',
        '/api/v2/farming/deposit',
        '/api/v2/farming/harvest',
        '/api/v2/referral/generate-code',
        '/api/v2/daily-bonus/claim',
        '/api/v2/boost/purchase',
        '/api/v2/user/balance'
      ];

      const fetch = (await import('node-fetch')).default;
      const baseUrl = 'http://localhost:3000';

      for (const route of expectedRoutes) {
        try {
          const response = await fetch(`${baseUrl}${route}`, { 
            method: 'GET',
            timeout: 5000 
          });
          
          if (response.status !== 404) {
            this.log(`  ✓ ${route}: доступен (статус ${response.status})`, 'pass');
            this.results.api.passed++;
          } else {
            this.log(`  ✗ ${route}: не найден (404)`, 'fail');
            this.results.api.failed++;
          }
        } catch (error) {
          this.log(`  ✗ ${route}: ошибка соединения`, 'fail');
          this.results.api.failed++;
        }
      }

    } catch (error) {
      this.log(`✗ Ошибка проверки API: ${error.message}`, 'fail');
      this.results.api.failed++;
    }
  }

  async checkDatabase() {
    this.log('\n🗄️ ПРОВЕРКА СТРУКТУРЫ БАЗЫ ДАННЫХ СОГЛАСНО RIOTMAP.md', 'info');
    this.log('='.repeat(50), 'info');

    try {
      // Основные таблицы согласно RIOTMAP.md
      const expectedTables = [
        'users',
        'missions', 
        'user_missions',
        'farming_deposits',
        'farming_rewards',
        'referral_tree',
        'daily_bonuses',
        'boost_packages',
        'transactions'
      ];

      for (const table of expectedTables) {
        const checkQuery = `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name = '${table}'`;
        const { rows } = await pool.query(checkQuery);
        
        if (rows[0].count > 0) {
          this.log(`  ✓ Таблица ${table}: существует`, 'pass');
          this.results.database.passed++;
        } else {
          this.log(`  ✗ Таблица ${table}: отсутствует`, 'fail');
          this.results.database.failed++;
        }
      }

    } catch (error) {
      this.log(`✗ Ошибка проверки БД: ${error.message}`, 'fail');
      this.results.database.failed++;
    }
  }

  generateReport() {
    this.log('\n📊 ИТОГОВЫЙ ОТЧЕТ СООТВЕТСТВИЯ RIOTMAP.md', 'info');
    this.log('='.repeat(60), 'info');

    const categories = Object.keys(this.results);
    let totalPassed = 0;
    let totalFailed = 0;

    categories.forEach(category => {
      const result = this.results[category];
      const total = result.passed + result.failed;
      const percentage = total > 0 ? Math.round((result.passed / total) * 100) : 0;
      
      totalPassed += result.passed;
      totalFailed += result.failed;

      const status = percentage >= 80 ? 'pass' : percentage >= 50 ? 'warn' : 'fail';
      this.log(`${category.toUpperCase()}: ${result.passed}/${total} (${percentage}%)`, status);
      
      if (result.details.length > 0) {
        result.details.forEach(detail => {
          this.log(`  ${detail}`, 'info');
        });
      }
    });

    const overallTotal = totalPassed + totalFailed;
    const overallPercentage = overallTotal > 0 ? Math.round((totalPassed / overallTotal) * 100) : 0;

    this.log('\n' + '='.repeat(60), 'info');
    this.log(`ОБЩИЙ РЕЗУЛЬТАТ: ${totalPassed}/${overallTotal} (${overallPercentage}%)`, 
             overallPercentage >= 80 ? 'pass' : 'fail');

    if (overallPercentage >= 80) {
      this.log('🎉 СИСТЕМА СООТВЕТСТВУЕТ RIOTMAP.md', 'pass');
    } else {
      this.log('⚠️ ТРЕБУЮТСЯ ИСПРАВЛЕНИЯ ДЛЯ СООТВЕТСТВИЯ RIOTMAP.md', 'warn');
    }
  }

  async runFullAudit() {
    this.log('🚀 ЗАПУСК ПОЛНОЙ ПРОВЕРКИ СИСТЕМЫ UNIFARM', 'info');
    this.log('📋 Сравнение с официальным RIOTMAP.md', 'info');
    this.log('='.repeat(60), 'info');

    await this.checkMissions();
    await this.checkTonBoost();
    await this.checkFarming();
    await this.checkReferralSystem();
    await this.checkDailyBonus();
    await this.checkAPIRoutes();
    await this.checkDatabase();
    
    this.generateReport();

    await pool.end();
  }
}

// Запуск аудита
const auditor = new RiotmapAuditor();
auditor.runFullAudit().catch(console.error);