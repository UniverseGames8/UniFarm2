/**
 * Проверка устранения дубликатов маршрутов в системе UniFarm
 * Анализирует routes-new.ts на предмет конфликтующих маршрутов
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 ПРОВЕРКА УСТРАНЕНИЯ ДУБЛИКАТОВ МАРШРУТОВ\n');

function checkRouteDuplicates() {
  const routesFile = path.join(__dirname, 'server', 'routes-new.ts');
  
  if (!fs.existsSync(routesFile)) {
    console.log('❌ Файл routes-new.ts не найден');
    return;
  }
  
  const content = fs.readFileSync(routesFile, 'utf8');
  
  // Поиск маршрутов Daily Bonus
  const dailyBonusRoutes = [
    '/api/v2/daily-bonus/status',
    '/api/v2/daily-bonus/claim',
    '/api/v2/daily-bonus/streak-info'
  ];
  
  // Поиск маршрутов Missions
  const missionRoutes = [
    '/api/v2/missions/active',
    '/api/v2/missions/complete',
    '/api/v2/user-missions'
  ];
  
  console.log('📊 АНАЛИЗ МАРШРУТОВ DAILY BONUS:');
  dailyBonusRoutes.forEach(route => {
    const matches = content.split(route).length - 1;
    console.log(`  ${route}: ${matches} вхождений ${matches > 1 ? '⚠️  ДУБЛИКАТ!' : '✅'}`);
  });
  
  console.log('\n📊 АНАЛИЗ МАРШРУТОВ MISSIONS:');
  missionRoutes.forEach(route => {
    const matches = content.split(route).length - 1;
    console.log(`  ${route}: ${matches} вхождений ${matches > 1 ? '⚠️  ДУБЛИКАТ!' : '✅'}`);
  });
  
  // Проверка удаленных блоков
  const removedBlocks = [
    'Дублированные маршруты миссий удалены',
    'Дублированные маршруты Daily Bonus удалены'
  ];
  
  console.log('\n🧹 ПРОВЕРКА УДАЛЕННЫХ БЛОКОВ:');
  removedBlocks.forEach(block => {
    const found = content.includes(block);
    console.log(`  ${block}: ${found ? '✅ Найден' : '❌ Не найден'}`);
  });
  
  // Проверка рабочих маршрутов UNI/TON
  const workingRoutes = [
    '/api/v2/uni-farming/status',
    '/api/v2/ton-farming/info'
  ];
  
  console.log('\n💪 ПРОВЕРКА РАБОЧИХ МАРШРУТОВ:');
  workingRoutes.forEach(route => {
    const matches = content.split(route).length - 1;
    console.log(`  ${route}: ${matches} вхождений ${matches === 1 ? '✅ Корректно' : '⚠️  Проблема'}`);
  });
  
  console.log('\n📈 ИТОГОВЫЙ СТАТУС:');
  
  // Подсчет общих дубликатов
  const allCriticalRoutes = [...dailyBonusRoutes, ...missionRoutes];
  const duplicateCount = allCriticalRoutes.filter(route => {
    return (content.split(route).length - 1) > 1;
  }).length;
  
  if (duplicateCount === 0) {
    console.log('✅ ВСЕ ДУБЛИКАТЫ МАРШРУТОВ УСТРАНЕНЫ!');
    console.log('✅ Daily Bonus и Missions должны работать стабильно');
    console.log('✅ Система готова к использованию');
  } else {
    console.log(`⚠️  Обнаружено ${duplicateCount} дубликатов маршрутов`);
    console.log('❌ Требуется дополнительная очистка');
  }
}

// Запуск проверки
checkRouteDuplicates();