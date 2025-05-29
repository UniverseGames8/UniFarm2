/**
 * КОМПЛЕКСНАЯ ПРОВЕРКА СИСТЕМЫ UNIFARM
 * Детальный аудит всех компонентов с проверкой реальной функциональности
 */

import pkg from 'pg';
const { Pool } = pkg;

// Подключение к базе данных
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.NEON_DATABASE_URL,
});

class SystemAuditor {
  constructor() {
    this.results = {
      database: { tables: [], issues: [] },
      api: { working: [], broken: [] },
      data: { consistent: [], inconsistent: [] },
      functionality: { working: [], broken: [] }
    };
  }

  log(message, type = 'info') {
    const colors = { info: '\x1b[36m', pass: '\x1b[32m', fail: '\x1b[31m', warn: '\x1b[33m', reset: '\x1b[0m' };
    console.log(`${colors[type]}${message}${colors.reset}`);
  }

  async checkDatabaseStructure() {
    this.log('\n🗄️ ПРОВЕРКА СТРУКТУРЫ БАЗЫ ДАННЫХ', 'info');
    this.log('='.repeat(50), 'info');

    try {
      // Получаем все таблицы
      const tablesQuery = `
        SELECT table_name, 
               (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
        FROM information_schema.tables t 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `;
      const { rows: tables } = await pool.query(tablesQuery);
      
      this.log(`✓ Найдено таблиц: ${tables.length}`, 'pass');
      
      for (const table of tables) {
        // Проверяем количество записей в каждой таблице
        const countQuery = `SELECT COUNT(*) as count FROM ${table.table_name}`;
        const { rows: countResult } = await pool.query(countQuery);
        const recordCount = countResult[0].count;
        
        this.results.database.tables.push({
          name: table.table_name,
          columns: table.column_count,
          records: recordCount
        });
        
        this.log(`  📋 ${table.table_name}: ${table.column_count} колонок, ${recordCount} записей`, 
                 recordCount > 0 ? 'pass' : 'warn');
      }
      
    } catch (error) {
      this.log(`✗ Ошибка проверки БД: ${error.message}`, 'fail');
      this.results.database.issues.push(error.message);
    }
  }

  async checkMissionsData() {
    this.log('\n🎯 ДЕТАЛЬНАЯ ПРОВЕРКА МИССИЙ', 'info');
    this.log('='.repeat(50), 'info');

    try {
      // Проверяем миссии
      const missionsQuery = `
        SELECT m.*, 
               COUNT(um.id) as completion_count,
               STRING_AGG(DISTINCT u.telegram_username, ', ') as completed_by_users
        FROM missions m
        LEFT JOIN user_missions um ON m.id = um.mission_id
        LEFT JOIN users u ON um.user_id = u.id
        WHERE m.is_active = true
        GROUP BY m.id
        ORDER BY m.id
      `;
      const { rows: missions } = await pool.query(missionsQuery);
      
      this.log(`✓ Активных миссий: ${missions.length}`, missions.length === 4 ? 'pass' : 'warn');
      
      missions.forEach((mission, index) => {
        this.log(`  ${index + 1}. ${mission.title}`, 'info');
        this.log(`     Тип: ${mission.type}`, 'info');
        this.log(`     Вознаграждение: ${mission.reward_uni} UNI`, 'info');
        this.log(`     Ссылка: ${mission.link}`, 'info');
        this.log(`     Завершений: ${mission.completion_count}`, 'info');
        
        // Проверяем соответствие RIOTMAP
        const expectedReward = '500.00';
        if (parseFloat(mission.reward_uni) === 500.00) {
          this.results.data.consistent.push(`Миссия ${mission.title}: корректное вознаграждение`);
          this.log(`     ✓ Вознаграждение соответствует RIOTMAP`, 'pass');
        } else {
          this.results.data.inconsistent.push(`Миссия ${mission.title}: неверное вознаграждение`);
          this.log(`     ✗ Ожидалось 500 UNI, получено ${mission.reward_uni}`, 'fail');
        }
      });
      
    } catch (error) {
      this.log(`✗ Ошибка проверки миссий: ${error.message}`, 'fail');
      this.results.data.inconsistent.push(`Миссии: ${error.message}`);
    }
  }

  async checkBoostPackages() {
    this.log('\n💎 ДЕТАЛЬНАЯ ПРОВЕРКА TON BOOST ПАКЕТОВ', 'info');
    this.log('='.repeat(50), 'info');

    try {
      const boostQuery = `
        SELECT bp.*, 
               COUNT(ub.id) as purchase_count,
               SUM(ub.amount_paid) as total_revenue
        FROM boost_packages bp
        LEFT JOIN user_boosts ub ON bp.id = ub.boost_package_id
        WHERE bp.is_active = true
        GROUP BY bp.id
        ORDER BY bp.price_ton
      `;
      const { rows: boosts } = await pool.query(boostQuery);
      
      this.log(`✓ Активных boost пакетов: ${boosts.length}`, boosts.length === 4 ? 'pass' : 'warn');
      
      const expectedBoosts = [
        { name: 'Starter Boost', price_ton: '1.00', bonus_uni: '10000.00', daily_rate: '0.0050' },
        { name: 'Standard Boost', price_ton: '5.00', bonus_uni: '75000.00', daily_rate: '0.0100' },
        { name: 'Advanced Boost', price_ton: '15.00', bonus_uni: '250000.00', daily_rate: '0.0200' },
        { name: 'Premium Boost', price_ton: '25.00', bonus_uni: '500000.00', daily_rate: '0.0250' }
      ];
      
      boosts.forEach((boost, index) => {
        const expected = expectedBoosts.find(e => e.price_ton === boost.price_ton);
        
        this.log(`  ${index + 1}. ${boost.name}`, 'info');
        this.log(`     Цена: ${boost.price_ton} TON`, 'info');
        this.log(`     Бонус: ${boost.uni_bonus_amount} UNI`, 'info');
        this.log(`     Дневная ставка: ${boost.fixed_ton_daily_rate}`, 'info');
        this.log(`     Покупок: ${boost.purchase_count}`, 'info');
        
        if (expected) {
          let allCorrect = true;
          
          if (boost.uni_bonus_amount !== expected.bonus_uni) {
            this.log(`     ✗ Неверный бонус UNI: ожидалось ${expected.bonus_uni}`, 'fail');
            allCorrect = false;
          }
          
          if (boost.fixed_ton_daily_rate !== expected.daily_rate) {
            this.log(`     ✗ Неверная дневная ставка: ожидалось ${expected.daily_rate}`, 'fail');
            allCorrect = false;
          }
          
          if (allCorrect) {
            this.log(`     ✓ Соответствует RIOTMAP`, 'pass');
            this.results.data.consistent.push(`Boost пакет ${boost.name}: соответствует`);
          } else {
            this.results.data.inconsistent.push(`Boost пакет ${boost.name}: несоответствие`);
          }
        }
      });
      
    } catch (error) {
      this.log(`✗ Ошибка проверки boost пакетов: ${error.message}`, 'fail');
      this.results.data.inconsistent.push(`Boost пакеты: ${error.message}`);
    }
  }

  async checkUserData() {
    this.log('\n👥 ПРОВЕРКА ПОЛЬЗОВАТЕЛЬСКИХ ДАННЫХ', 'info');
    this.log('='.repeat(50), 'info');

    try {
      // Статистика пользователей
      const userStatsQuery = `
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN telegram_id IS NOT NULL THEN 1 END) as telegram_users,
          COUNT(CASE WHEN ref_code IS NOT NULL THEN 1 END) as users_with_refcode,
          AVG(balance_uni::numeric) as avg_balance_uni,
          AVG(balance_ton::numeric) as avg_balance_ton
        FROM users
      `;
      const { rows: userStats } = await pool.query(userStatsQuery);
      const stats = userStats[0];
      
      this.log(`✓ Всего пользователей: ${stats.total_users}`, 'pass');
      this.log(`  Пользователи Telegram: ${stats.telegram_users}`, 'info');
      this.log(`  Пользователи с ref_code: ${stats.users_with_refcode}`, 'info');
      this.log(`  Средний баланс UNI: ${parseFloat(stats.avg_balance_uni || 0).toFixed(2)}`, 'info');
      this.log(`  Средний баланс TON: ${parseFloat(stats.avg_balance_ton || 0).toFixed(2)}`, 'info');
      
      // Проверяем уникальность реферальных кодов
      const duplicateRefCodesQuery = `
        SELECT ref_code, COUNT(*) as count 
        FROM users 
        WHERE ref_code IS NOT NULL 
        GROUP BY ref_code 
        HAVING COUNT(*) > 1
      `;
      const { rows: duplicates } = await pool.query(duplicateRefCodesQuery);
      
      if (duplicates.length === 0) {
        this.log(`  ✓ Все реферальные коды уникальны`, 'pass');
        this.results.data.consistent.push('Реферальные коды уникальны');
      } else {
        this.log(`  ✗ Найдены дублирующиеся реф. коды: ${duplicates.length}`, 'fail');
        this.results.data.inconsistent.push(`Дублирующиеся ref_code: ${duplicates.length}`);
      }
      
    } catch (error) {
      this.log(`✗ Ошибка проверки пользователей: ${error.message}`, 'fail');
      this.results.data.inconsistent.push(`Пользователи: ${error.message}`);
    }
  }

  async checkTransactionSystem() {
    this.log('\n💰 ПРОВЕРКА СИСТЕМЫ ТРАНЗАКЦИЙ', 'info');
    this.log('='.repeat(50), 'info');

    try {
      // Статистика транзакций
      const transactionStatsQuery = `
        SELECT 
          type,
          COUNT(*) as count,
          SUM(amount::numeric) as total_amount,
          AVG(amount::numeric) as avg_amount
        FROM transactions 
        GROUP BY type
        ORDER BY count DESC
      `;
      const { rows: transactionStats } = await pool.query(transactionStatsQuery);
      
      this.log(`✓ Типы транзакций:`, 'pass');
      transactionStats.forEach(stat => {
        this.log(`  ${stat.type}: ${stat.count} шт., сумма: ${parseFloat(stat.total_amount).toFixed(2)}`, 'info');
      });
      
      // Проверяем целостность балансов
      const balanceCheckQuery = `
        SELECT 
          u.id,
          u.balance_uni,
          u.balance_ton,
          COALESCE(SUM(CASE WHEN t.type = 'deposit' THEN t.amount::numeric ELSE 0 END), 0) as total_deposits,
          COALESCE(SUM(CASE WHEN t.type = 'withdrawal' THEN t.amount::numeric ELSE 0 END), 0) as total_withdrawals
        FROM users u
        LEFT JOIN transactions t ON u.id = t.user_id
        WHERE u.id <= 5  -- Проверяем первых 5 пользователей
        GROUP BY u.id, u.balance_uni, u.balance_ton
      `;
      const { rows: balanceCheck } = await pool.query(balanceCheckQuery);
      
      let balanceIssues = 0;
      balanceCheck.forEach(user => {
        const expectedBalance = parseFloat(user.total_deposits) - parseFloat(user.total_withdrawals);
        const actualBalance = parseFloat(user.balance_uni || 0);
        if (Math.abs(expectedBalance - actualBalance) > 0.01) {
          balanceIssues++;
        }
      });
      
      if (balanceIssues === 0) {
        this.log(`  ✓ Балансы пользователей корректны`, 'pass');
        this.results.data.consistent.push('Балансы соответствуют транзакциям');
      } else {
        this.log(`  ✗ Найдены несоответствия балансов: ${balanceIssues}`, 'fail');
        this.results.data.inconsistent.push(`Несоответствия балансов: ${balanceIssues}`);
      }
      
    } catch (error) {
      this.log(`✗ Ошибка проверки транзакций: ${error.message}`, 'fail');
      this.results.data.inconsistent.push(`Транзакции: ${error.message}`);
    }
  }

  async checkAPIEndpoints() {
    this.log('\n🔗 ПРОВЕРКА РАБОТОСПОСОБНОСТИ API', 'info');
    this.log('='.repeat(50), 'info');

    const criticalEndpoints = [
      { method: 'GET', path: '/api/v2/missions/active', description: 'Активные миссии' },
      { method: 'POST', path: '/api/v2/missions/complete', description: 'Завершение миссий' },
      { method: 'GET', path: '/api/v2/wallet/balance', description: 'Баланс кошелька' },
      { method: 'GET', path: '/api/v2/daily-bonus/status', description: 'Статус ежедневного бонуса' },
      { method: 'GET', path: '/api/v2/referral/tree', description: 'Дерево рефералов' },
      { method: 'GET', path: '/api/v2/ton-farming/boosts', description: 'TON boost пакеты' }
    ];

    try {
      const fetch = (await import('node-fetch')).default;
      const baseUrl = 'http://localhost:3000';

      for (const endpoint of criticalEndpoints) {
        try {
          const response = await fetch(`${baseUrl}${endpoint.path}`, {
            method: endpoint.method,
            timeout: 5000,
            headers: { 'Content-Type': 'application/json' }
          });

          if (response.ok) {
            this.log(`  ✓ ${endpoint.description}: работает (${response.status})`, 'pass');
            this.results.api.working.push(`${endpoint.method} ${endpoint.path}`);
          } else {
            this.log(`  ✗ ${endpoint.description}: ошибка ${response.status}`, 'fail');
            this.results.api.broken.push(`${endpoint.method} ${endpoint.path} (${response.status})`);
          }
        } catch (error) {
          this.log(`  ✗ ${endpoint.description}: недоступен`, 'fail');
          this.results.api.broken.push(`${endpoint.method} ${endpoint.path} (timeout)`);
        }
      }
    } catch (error) {
      this.log(`✗ Ошибка проверки API: ${error.message}`, 'fail');
    }
  }

  generateDetailedReport() {
    this.log('\n📊 ДЕТАЛЬНЫЙ ОТЧЕТ О СОСТОЯНИИ СИСТЕМЫ', 'info');
    this.log('='.repeat(60), 'info');

    // Статистика по базе данных
    this.log('\n🗄️ БАЗА ДАННЫХ:', 'info');
    this.results.database.tables.forEach(table => {
      const status = table.records > 0 ? '✓' : '⚠';
      this.log(`  ${status} ${table.name}: ${table.records} записей`, table.records > 0 ? 'pass' : 'warn');
    });

    // Статистика по API
    this.log('\n🔗 API ЭНДПОИНТЫ:', 'info');
    this.log(`  ✓ Работающих: ${this.results.api.working.length}`, 'pass');
    this.log(`  ✗ Неработающих: ${this.results.api.broken.length}`, this.results.api.broken.length === 0 ? 'pass' : 'fail');

    // Согласованность данных
    this.log('\n📊 СОГЛАСОВАННОСТЬ ДАННЫХ:', 'info');
    this.log(`  ✓ Корректных проверок: ${this.results.data.consistent.length}`, 'pass');
    this.log(`  ✗ Найденных проблем: ${this.results.data.inconsistent.length}`, this.results.data.inconsistent.length === 0 ? 'pass' : 'fail');

    // Детали проблем
    if (this.results.data.inconsistent.length > 0) {
      this.log('\n⚠️ НАЙДЕННЫЕ ПРОБЛЕМЫ:', 'warn');
      this.results.data.inconsistent.forEach(issue => {
        this.log(`  - ${issue}`, 'warn');
      });
    }

    // Общая оценка
    const totalIssues = this.results.api.broken.length + this.results.data.inconsistent.length + this.results.database.issues.length;
    this.log('\n' + '='.repeat(60), 'info');
    
    if (totalIssues === 0) {
      this.log('🎉 СИСТЕМА В ОТЛИЧНОМ СОСТОЯНИИ', 'pass');
      this.log('✅ Готова к сравнению с RIOTMAP.md', 'pass');
    } else if (totalIssues <= 3) {
      this.log('✅ СИСТЕМА В ХОРОШЕМ СОСТОЯНИИ', 'pass');
      this.log(`⚠️ Найдено ${totalIssues} минорных проблем`, 'warn');
    } else {
      this.log('⚠️ СИСТЕМА ТРЕБУЕТ ВНИМАНИЯ', 'warn');
      this.log(`❌ Найдено ${totalIssues} проблем для исправления`, 'fail');
    }
  }

  async runCompleteAudit() {
    this.log('🚀 ЗАПУСК КОМПЛЕКСНОГО АУДИТА СИСТЕМЫ UNIFARM', 'info');
    this.log('📋 Детальная проверка перед сравнением с RIOTMAP.md', 'info');
    this.log('='.repeat(60), 'info');

    await this.checkDatabaseStructure();
    await this.checkMissionsData();
    await this.checkBoostPackages();
    await this.checkUserData();
    await this.checkTransactionSystem();
    await this.checkAPIEndpoints();
    
    this.generateDetailedReport();

    await pool.end();
  }
}

// Запуск полного аудита
const auditor = new SystemAuditor();
auditor.runCompleteAudit().catch(console.error);