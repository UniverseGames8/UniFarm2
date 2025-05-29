/**
 * Комплексная валидация API эндпоинтов UniFarm
 * 
 * Анализирует корректность реализации всех критических API
 * без необходимости запуска сервера
 */

import fs from 'fs';
import path from 'path';

// Критические API согласно REDMAP
const CRITICAL_APIS = [
  {
    path: '/api/v2/missions/active',
    method: 'GET',
    controller: 'MissionControllerFixed',
    action: 'getActiveMissions',
    description: 'Получение активных миссий',
    redmapRequirement: 'Обязательный для системы миссий'
  },
  {
    path: '/api/v2/missions/complete',
    method: 'POST',
    controller: 'MissionControllerFixed', 
    action: 'completeMission',
    description: 'Завершение миссии',
    redmapRequirement: 'Награда 500 UNI за миссию'
  },
  {
    path: '/api/v2/uni-farming/purchase',
    method: 'POST',
    controller: 'UniFarmingController',
    action: 'purchaseFarming',
    description: 'Покупка UNI фарминга',
    redmapRequirement: 'Вложение UNI для пассивного дохода'
  },
  {
    path: '/api/v2/uni-farming/withdraw',
    method: 'POST',
    controller: 'UniFarmingController',
    action: 'withdrawFarming', 
    description: 'Вывод средств из UNI фарминга',
    redmapRequirement: 'Доступен через API'
  },
  {
    path: '/api/v2/ton-farming/boosts',
    method: 'GET',
    controller: 'TonBoostController',
    action: 'getBoosts',
    description: 'Получение TON буст пакетов',
    redmapRequirement: 'Starter/Standard/Advanced/Premium пакеты'
  },
  {
    path: '/api/v2/boosts',
    method: 'GET',
    controller: 'BoostController',
    action: 'getAllBoosts',
    description: 'Получение всех буст пакетов',
    redmapRequirement: 'Отображение доступных бустов'
  },
  {
    path: '/api/v2/referrals/apply',
    method: 'POST',
    controller: 'ReferralController',
    action: 'applyReferralCode',
    description: 'Применение реферального кода',
    redmapRequirement: 'Реферальная система с уровнями'
  },
  {
    path: '/api/v2/referral/tree',
    method: 'GET', 
    controller: 'ReferralController',
    action: 'getReferralTree',
    description: 'Получение реферального дерева',
    redmapRequirement: 'Доход от фарминга рефералов'
  },
  {
    path: '/api/v2/wallet/balance',
    method: 'GET',
    controller: 'WalletController',
    action: 'getBalance',
    description: 'Получение баланса кошелька',
    redmapRequirement: 'Отображение баланса UNI и TON'
  },
  {
    path: '/api/v2/daily-bonus/claim',
    method: 'POST',
    controller: 'DailyBonusController',
    action: 'claimBonus',
    description: 'Получение ежедневного бонуса',
    redmapRequirement: 'Ежедневные начисления'
  }
];

/**
 * Читает и анализирует файл маршрутов
 */
function analyzeRoutesFile() {
  const routesPath = 'server/routes-new.ts';
  
  try {
    const content = fs.readFileSync(routesPath, 'utf8');
    return { success: true, content, path: routesPath };
  } catch (error) {
    return { success: false, error: error.message, path: routesPath };
  }
}

/**
 * Проверяет наличие API маршрута в коде
 */
function checkAPIRoute(content, api) {
  const methodLower = api.method.toLowerCase();
  const escapedPath = api.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Ищем различные паттерны определения маршрутов
  const patterns = [
    new RegExp(`app\\.${methodLower}\\s*\\(\\s*['"]${escapedPath}['"]`, 'i'),
    new RegExp(`${methodLower}\\s*\\(\\s*['"]${escapedPath}['"]`, 'i'),
    new RegExp(`'${escapedPath}'.*${api.controller}`, 'i'),
    new RegExp(`${api.controller}.*'${escapedPath}'`, 'i')
  ];
  
  const found = patterns.some(pattern => pattern.test(content));
  
  // Дополнительная проверка упоминания контроллера и действия
  const controllerMentioned = content.includes(api.controller);
  const actionMentioned = api.action ? content.includes(api.action) : true;
  
  return {
    routeFound: found,
    controllerMentioned,
    actionMentioned,
    confidence: found && controllerMentioned ? 'high' : 
                found || controllerMentioned ? 'medium' : 'low'
  };
}

/**
 * Анализирует наличие контроллера
 */
function analyzeController(controllerName) {
  const possiblePaths = [
    `server/controllers/${controllerName}.ts`,
    `server/controllers/${controllerName.toLowerCase()}.ts`,
    `server/controllers/${controllerName}Consolidated.ts`,
    `server/controllers/${controllerName.replace('Controller', '')}Controller.ts`,
    `server/controllers/${controllerName.replace('Controller', '')}ControllerConsolidated.ts`
  ];
  
  for (const controllerPath of possiblePaths) {
    try {
      if (fs.existsSync(controllerPath)) {
        const content = fs.readFileSync(controllerPath, 'utf8');
        return {
          exists: true,
          path: controllerPath,
          hasExports: content.includes('export'),
          hasClass: content.includes('class') || content.includes('export const'),
          size: content.length
        };
      }
    } catch (error) {
      // Продолжаем поиск
    }
  }
  
  return { exists: false, searchedPaths: possiblePaths };
}

/**
 * Генерирует детальный отчет о состоянии API
 */
function generateAPIValidationReport() {
  console.log('🔍 КОМПЛЕКСНАЯ ВАЛИДАЦИЯ API ЭНДПОИНТОВ UNIFARM');
  console.log('='.repeat(60));
  
  // Анализируем файл маршрутов
  const routesAnalysis = analyzeRoutesFile();
  
  if (!routesAnalysis.success) {
    console.log(`❌ Ошибка чтения файла маршрутов: ${routesAnalysis.error}`);
    return;
  }
  
  console.log(`✅ Файл маршрутов загружен: ${routesAnalysis.path}`);
  console.log(`📄 Размер файла: ${routesAnalysis.content.length} символов\n`);
  
  // Анализируем каждый критический API
  const results = [];
  
  CRITICAL_APIS.forEach((api, index) => {
    console.log(`🔍 ${index + 1}. Анализ: ${api.method} ${api.path}`);
    console.log(`   📝 ${api.description}`);
    console.log(`   📋 REDMAP: ${api.redmapRequirement}`);
    
    // Проверяем маршрут
    const routeCheck = checkAPIRoute(routesAnalysis.content, api);
    
    // Проверяем контроллер
    const controllerCheck = analyzeController(api.controller);
    
    // Определяем общий статус
    let status = '❌ НЕ РЕАЛИЗОВАН';
    let issues = [];
    
    if (routeCheck.routeFound && controllerCheck.exists) {
      status = '✅ РЕАЛИЗОВАН';
    } else if (routeCheck.routeFound) {
      status = '⚠️ МАРШРУТ ЕСТЬ, КОНТРОЛЛЕР ОТСУТСТВУЕТ';
      issues.push('Контроллер не найден');
    } else if (controllerCheck.exists) {
      status = '⚠️ КОНТРОЛЛЕР ЕСТЬ, МАРШРУТ ОТСУТСТВУЕТ';
      issues.push('Маршрут не зарегистрирован');
    } else {
      issues.push('Маршрут не найден', 'Контроллер не найден');
    }
    
    console.log(`   ${status}`);
    
    // Детали проверки маршрута
    console.log(`   🔗 Маршрут: ${routeCheck.routeFound ? '✅' : '❌'} (уверенность: ${routeCheck.confidence})`);
    console.log(`   🎛️ Контроллер: ${controllerCheck.exists ? '✅' : '❌'}`);
    
    if (controllerCheck.exists) {
      console.log(`      📁 Путь: ${controllerCheck.path}`);
    }
    
    if (issues.length > 0) {
      console.log(`   ⚠️ Проблемы: ${issues.join(', ')}`);
    }
    
    results.push({
      api,
      routeCheck,
      controllerCheck,
      status: status.includes('✅') ? 'implemented' : 
              status.includes('⚠️') ? 'partial' : 'missing',
      issues
    });
    
    console.log('');
  });
  
  // Итоговая статистика
  console.log('📊 ИТОГОВАЯ СТАТИСТИКА');
  console.log('-'.repeat(40));
  
  const implemented = results.filter(r => r.status === 'implemented').length;
  const partial = results.filter(r => r.status === 'partial').length;
  const missing = results.filter(r => r.status === 'missing').length;
  
  console.log(`✅ Полностью реализовано: ${implemented}/${CRITICAL_APIS.length}`);
  console.log(`⚠️ Частично реализовано: ${partial}/${CRITICAL_APIS.length}`);
  console.log(`❌ Отсутствует: ${missing}/${CRITICAL_APIS.length}`);
  
  const completionRate = (implemented / CRITICAL_APIS.length * 100).toFixed(1);
  console.log(`📈 Процент готовности: ${completionRate}%`);
  
  // Рекомендации
  console.log('\n💡 РЕКОМЕНДАЦИИ');
  console.log('-'.repeat(40));
  
  if (implemented === CRITICAL_APIS.length) {
    console.log('🎉 Все критические API реализованы! Готов к тестированию.');
  } else {
    const problematicAPIs = results.filter(r => r.status !== 'implemented');
    console.log('🔧 Требуют внимания:');
    
    problematicAPIs.forEach(result => {
      console.log(`   • ${result.api.method} ${result.api.path}`);
      result.issues.forEach(issue => {
        console.log(`     - ${issue}`);
      });
    });
  }
  
  // Следующие шаги
  console.log('\n🚀 СЛЕДУЮЩИЕ ШАГИ');
  console.log('-'.repeat(40));
  
  if (completionRate >= 90) {
    console.log('1. ✅ Запустить сервер для live-тестирования');
    console.log('2. 🧪 Протестировать все эндпоинты с реальными данными');
    console.log('3. 📱 Проверить интеграцию с Telegram Mini App');
  } else if (completionRate >= 70) {
    console.log('1. 🔧 Исправить частично реализованные API');
    console.log('2. ✅ Добавить отсутствующие маршруты или контроллеры');
    console.log('3. 🧪 Провести тестирование после исправлений');
  } else {
    console.log('1. 🏗️ Реализовать отсутствующие контроллеры');
    console.log('2. 🔗 Добавить маршруты в routes-new.ts');
    console.log('3. 📋 Проверить соответствие REDMAP требованиям');
  }
  
  return results;
}

// Запуск валидации
if (import.meta.url === `file://${process.argv[1]}`) {
  generateAPIValidationReport();
}

export { generateAPIValidationReport, CRITICAL_APIS };