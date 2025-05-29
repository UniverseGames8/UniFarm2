/**
 * Скрипт для анализа существующих реферальных кодов в базе данных
 * Анализирует длину, используемые символы и уникальность кодов
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import * as dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

// Настройка WebSocket для Neon DB
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function analyzeRefCodes() {
  try {
    const { rows } = await pool.query('SELECT ref_code FROM users WHERE ref_code IS NOT NULL');
    
    console.log(`Всего реферальных кодов: ${rows.length}`);
    
    // Анализ длины кодов
    const lengthStats = {};
    rows.forEach(row => {
      const length = row.ref_code.length;
      lengthStats[length] = (lengthStats[length] || 0) + 1;
    });
    
    console.log('\nСтатистика по длине кодов:');
    Object.keys(lengthStats).sort((a, b) => a - b).forEach(length => {
      console.log(`  ${length} символов: ${lengthStats[length]} кодов (${Math.round(lengthStats[length] / rows.length * 100)}%)`);
    });
    
    // Анализ символов (только для первых 20 кодов)
    const sampleCodes = rows.slice(0, 20).map(row => row.ref_code);
    console.log('\nПримеры реферальных кодов:');
    sampleCodes.forEach((code, index) => {
      console.log(`  ${index + 1}. ${code}`);
    });
    
    // Проверка наличия дубликатов
    const uniqueCodes = new Set(rows.map(row => row.ref_code));
    console.log(`\nУникальных кодов: ${uniqueCodes.size} из ${rows.length}`);
    
    if (uniqueCodes.size < rows.length) {
      console.log('ВНИМАНИЕ: Обнаружены дубликаты реферальных кодов!');
      
      // Находим дубликаты
      const codeCounts = {};
      rows.forEach(row => {
        codeCounts[row.ref_code] = (codeCounts[row.ref_code] || 0) + 1;
      });
      
      const duplicates = Object.entries(codeCounts)
        .filter(([_, count]) => count > 1)
        .sort((a, b) => b[1] - a[1]);
      
      console.log('\nТоп-10 дублирующихся кодов:');
      duplicates.slice(0, 10).forEach(([code, count]) => {
        console.log(`  ${code}: встречается ${count} раз`);
      });
      
      // Более подробная информация о первом дубликате
      if (duplicates.length > 0) {
        const [firstDuplicate] = duplicates;
        const { rows: usersWithDuplicate } = await pool.query(
          'SELECT id, username, guest_id, telegram_id, created_at FROM users WHERE ref_code = $1',
          [firstDuplicate[0]]
        );
        
        console.log(`\nПодробная информация о пользователях с кодом "${firstDuplicate[0]}":`);
        usersWithDuplicate.forEach(user => {
          console.log(`  ID: ${user.id}, Username: ${user.username}, Создан: ${user.created_at}`);
        });
      }
    }
    
    await pool.end();
  } catch (error) {
    console.error('Ошибка при анализе реферальных кодов:', error);
    await pool.end();
  }
}

analyzeRefCodes();