import { exec } from 'child_process';

console.log('🚀 Запуск миграции базы данных...');

// Выполняем команду для применения миграций
exec('tsx migrations/init.ts', (error, stdout, stderr) => {
  if (error) {
    console.error(`❌ Ошибка при выполнении миграции: ${error.message}`);
    return;
  }
  
  if (stderr) {
    console.error(`❌ Вывод ошибок: ${stderr}`);
    return;
  }
  
  console.log('✅ Вывод выполнения миграции:');
  console.log(stdout);
  console.log('✅ Миграция базы данных успешно завершена');
});