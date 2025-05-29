/**
 * Інструмент для перевірки маршрутів API через статичний аналіз
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Читаємо файл маршрутів
const routesPath = path.join(__dirname, 'server', 'routes-new.ts');
let routesContent = '';

try {
  routesContent = fs.readFileSync(routesPath, 'utf8');
} catch (error) {
  console.error(`Помилка читання файлу маршрутів: ${error.message}`);
  process.exit(1);
}

// Парсимо API ендпоінти за допомогою регулярних виразів
function extractEndpoints(content) {
  const endpoints = [];
  
  // Шукаємо рядки типу app.get('/api/v2/...' або app.post('/api/v2/...
  const routeRegex = /app\.(get|post|put|delete)\s*\(\s*['"]([^'"]+)['"](?:\s*,\s*)?([^)]+)\)/g;
  let match;
  
  while ((match = routeRegex.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const path = match[2];
    const handlerCode = match[3];
    
    // Визначаємо назву контролера
    let controller = 'Невідомий';
    if (handlerCode.includes('Controller')) {
      const controllerMatch = handlerCode.match(/(\w+)Controller/);
      if (controllerMatch) {
        controller = controllerMatch[1] + 'Controller';
      }
    }
    
    // Визначаємо функцію обробника
    let handler = 'Невідомий';
    const handlerMatch = handlerCode.match(/\.(\w+)(?:\)|\()/);
    if (handlerMatch) {
      handler = handlerMatch[1];
    }
    
    if (path.startsWith('/api/')) {
      endpoints.push({
        method,
        path,
        controller,
        handler,
        isConsolidated: handlerCode.includes('Consolidated')
      });
    }
  }
  
  return endpoints;
}

const endpoints = extractEndpoints(routesContent);

// Виводимо інформацію про ендпоінти
console.log('\n=== Аналіз API ендпоінтів ===\n');
console.log(`Всього знайдено API ендпоінтів: ${endpoints.length}\n`);

// Групуємо за контролерами
const controllerGroups = {};
endpoints.forEach(endpoint => {
  if (!controllerGroups[endpoint.controller]) {
    controllerGroups[endpoint.controller] = [];
  }
  controllerGroups[endpoint.controller].push(endpoint);
});

// Виводимо інформацію про консолідовані контролери
console.log('=== Консолідовані контролери ===');
let totalConsolidatedEndpoints = 0;

Object.keys(controllerGroups).forEach(controller => {
  const endpoints = controllerGroups[controller];
  const consolidatedEndpoints = endpoints.filter(e => e.isConsolidated);
  
  if (consolidatedEndpoints.length > 0) {
    totalConsolidatedEndpoints += consolidatedEndpoints.length;
    console.log(`${controller}: ${consolidatedEndpoints.length} ендпоінтів`);
    
    consolidatedEndpoints.forEach(endpoint => {
      console.log(`  - ${endpoint.method} ${endpoint.path} → ${endpoint.handler}`);
    });
    console.log('');
  }
});

console.log(`Всього консолідованих ендпоінтів: ${totalConsolidatedEndpoints}`);

// Виводимо інформацію про не консолідовані контролери
console.log('\n=== Не консолідовані контролери ===');
let totalNonConsolidatedEndpoints = 0;

Object.keys(controllerGroups).forEach(controller => {
  const endpoints = controllerGroups[controller];
  const nonConsolidatedEndpoints = endpoints.filter(e => !e.isConsolidated);
  
  if (nonConsolidatedEndpoints.length > 0) {
    totalNonConsolidatedEndpoints += nonConsolidatedEndpoints.length;
    console.log(`${controller}: ${nonConsolidatedEndpoints.length} ендпоінтів`);
    
    nonConsolidatedEndpoints.forEach(endpoint => {
      console.log(`  - ${endpoint.method} ${endpoint.path} → ${endpoint.handler}`);
    });
    console.log('');
  }
});

console.log(`Всього не консолідованих ендпоінтів: ${totalNonConsolidatedEndpoints}`);

// Генеруємо звіт про перевірку ендпоінтів
console.log('\n=== Підсумковий звіт ===');
console.log(`Загальна кількість API ендпоінтів: ${endpoints.length}`);
console.log(`Консолідованих: ${totalConsolidatedEndpoints} (${(totalConsolidatedEndpoints / endpoints.length * 100).toFixed(2)}%)`);
console.log(`Не консолідованих: ${totalNonConsolidatedEndpoints} (${(totalNonConsolidatedEndpoints / endpoints.length * 100).toFixed(2)}%)`);

// Виводимо рекомендації
console.log('\n=== Рекомендації ===');
if (totalNonConsolidatedEndpoints > 0) {
  console.log(`1. Розглянути консолідацію наступних контролерів:`);
  
  Object.keys(controllerGroups).forEach(controller => {
    const endpoints = controllerGroups[controller];
    const nonConsolidatedEndpoints = endpoints.filter(e => !e.isConsolidated);
    
    if (nonConsolidatedEndpoints.length > 0) {
      console.log(`   - ${controller} (${nonConsolidatedEndpoints.length} ендпоінтів)`);
    }
  });
}

// Перевірка структури файлової системи
console.log('\n=== Аналіз структури файлів ===');
const controllersPath = path.join(__dirname, 'server', 'controllers');
let controllerFiles = [];

try {
  controllerFiles = fs.readdirSync(controllersPath);
} catch (error) {
  console.error(`Помилка читання директорії контролерів: ${error.message}`);
}

const fallbackControllers = controllerFiles.filter(file => 
  file.includes('Fallback') && !file.endsWith('.bak')
);

const duplicateControllers = controllerFiles.filter(file => 
  file.includes('Controller.ts') && !file.includes('Consolidated') && !file.endsWith('.bak')
);

if (fallbackControllers.length > 0) {
  console.log(`\nЗнайдено ${fallbackControllers.length} Fallback контролерів, які ще не видалені:`);
  fallbackControllers.forEach(file => console.log(`- ${file}`));
}

if (duplicateControllers.length > 0) {
  console.log(`\nЗнайдено ${duplicateControllers.length} потенційно надлишкових контролерів:`);
  duplicateControllers.forEach(file => console.log(`- ${file}`));
}

console.log('\n=== Завершення аналізу ===');
