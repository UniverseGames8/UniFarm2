/**
 * Точное удаление дубликатов missions маршрутов
 * Сохраняет первые экземпляры, удаляет вторые
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 ТОЧНОЕ УДАЛЕНИЕ ДУБЛИКАТОВ MISSIONS МАРШРУТОВ\n');

function removeDuplicates() {
  const routesFile = path.join(__dirname, 'server', 'routes-new.ts');
  
  if (!fs.existsSync(routesFile)) {
    console.log('❌ Файл routes-new.ts не найден');
    return;
  }
  
  let content = fs.readFileSync(routesFile, 'utf8');
  const lines = content.split('\n');
  
  // Найдем все строки с missions маршрутами
  const missionRoutes = [
    '/api/v2/missions/active',
    '/api/v2/missions/complete', 
    '/api/v2/user-missions'
  ];
  
  console.log('🔍 ПОИСК ДУБЛИКАТОВ:');
  
  const routeOccurrences = {};
  
  // Найти все вхождения каждого маршрута
  missionRoutes.forEach(route => {
    routeOccurrences[route] = [];
    lines.forEach((line, index) => {
      if (line.includes(route) && line.includes('app.get') || line.includes('app.post')) {
        routeOccurrences[route].push({
          lineNumber: index + 1,
          content: line.trim(),
          index: index
        });
      }
    });
    
    console.log(`  ${route}: найдено ${routeOccurrences[route].length} вхождений`);
    routeOccurrences[route].forEach((occurrence, i) => {
      console.log(`    ${i + 1}. Строка ${occurrence.lineNumber}: ${occurrence.content}`);
    });
  });
  
  console.log('\n🎯 ПЛАН УДАЛЕНИЯ:');
  console.log('Оставляем первые экземпляры, удаляем вторые\n');
  
  // Создаем список строк для удаления (в обратном порядке, чтобы индексы не сбивались)
  const linesToRemove = [];
  
  missionRoutes.forEach(route => {
    const occurrences = routeOccurrences[route];
    if (occurrences.length > 1) {
      // Удаляем все экземпляры кроме первого
      for (let i = 1; i < occurrences.length; i++) {
        linesToRemove.push(occurrences[i].index);
        console.log(`✂️  Удаляем дубликат: строка ${occurrences[i].lineNumber}`);
      }
    }
  });
  
  // Сортируем в обратном порядке для корректного удаления
  linesToRemove.sort((a, b) => b - a);
  
  console.log(`\n🔧 УДАЛЯЕМ ${linesToRemove.length} ДУБЛИРОВАННЫХ СТРОК:`);
  
  // Удаляем дублированные строки
  linesToRemove.forEach(lineIndex => {
    console.log(`  Удаляем строку ${lineIndex + 1}: ${lines[lineIndex].trim()}`);
    lines.splice(lineIndex, 1);
  });
  
  // Записываем исправленный файл
  const newContent = lines.join('\n');
  fs.writeFileSync(routesFile, newContent, 'utf8');
  
  console.log('\n✅ ДУБЛИКАТЫ УСПЕШНО УДАЛЕНЫ!');
  console.log('✅ Файл routes-new.ts обновлен');
  console.log('✅ Система готова к использованию\n');
}

// Запуск
removeDuplicates();