/**
 * Deployment startup script for UniFarm (Remix)
 * - ES Module compatible version
 * - Forces Neon DB usage regardless of .replit settings
 * - Suitable for production deployment
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import { createRequire } from 'module';

// Create a require function for ES modules
const require = createRequire(import.meta.url);

// Подключаем фикс для базы данных
import './db-connect-fix.js';

// ПРИНУДИТЕЛЬНО устанавливаем дополнительные переменные окружения
process.env.NODE_ENV = 'production';
process.env.SKIP_PARTITION_CREATION = 'true';
process.env.IGNORE_PARTITION_ERRORS = 'true';

// Проверяем, установлена ли DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: DATABASE_URL не установлен. Neon DB не сможет работать.');
  console.error('Пожалуйста, установите DATABASE_URL в переменных окружения.');
  // Не выполняем немедленный выход, чтобы пользователь мог увидеть ошибку
} else {
  console.log('✅ DATABASE_URL установлен, Neon DB будет использоваться для подключения');
}

// Запускаем диагностическую проверку переменных окружения
if (fs.existsSync('./display-env-vars.js')) {
  console.log('\n=== ДИАГНОСТИКА ПЕРЕМЕННЫХ ОКРУЖЕНИЯ ===');
  try {
    require('./display-env-vars.js');
  } catch (error) {
    console.log('Не удалось запустить диагностику переменных окружения:', error);
  }
}

// Log early DB configuration to verify settings
console.log('===============================================');
console.log('UNIFARM DEPLOYMENT - FORCED NEON DB CONFIGURATION');
console.log('===============================================');
console.log('DATABASE_PROVIDER =', process.env.DATABASE_PROVIDER);
console.log('FORCE_NEON_DB =', process.env.FORCE_NEON_DB);
console.log('DISABLE_REPLIT_DB =', process.env.DISABLE_REPLIT_DB);
console.log('OVERRIDE_DB_PROVIDER =', process.env.OVERRIDE_DB_PROVIDER);
console.log('NODE_ENV =', process.env.NODE_ENV);
console.log('PORT =', process.env.PORT);
console.log('SKIP_PARTITION_CREATION =', process.env.SKIP_PARTITION_CREATION);
console.log('IGNORE_PARTITION_ERRORS =', process.env.IGNORE_PARTITION_ERRORS);
console.log('===============================================');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Run a command as a child process
 */
async function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${command} ${args.join(' ')}`);
    
    const childProcess = spawn(command, args, {
      stdio: 'inherit',
      ...options
    });

    childProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Process exited with code: ${code}`));
      }
    });
    
    childProcess.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Main application startup function
 */
async function main() {
  console.log('===================================================');
  console.log('  STARTING UNIFARM IN PRODUCTION MODE (NEON DB)');
  console.log('===================================================');
  console.log('Start time:', new Date().toISOString());
  console.log('Database settings: FORCED NEON DB');
  console.log('===================================================');
  
  try {
    // Use port 3000 for compatibility with Replit
    const port = parseInt(process.env.PORT || '3000', 10);
    console.log(`Using port ${port} for application...`);
    
    // Define startup file priority sequence
    const potentialStartFiles = [
      { path: './server/index.ts', command: 'npx tsx server/index.ts' },
      { path: './server/index.js', command: 'node server/index.js' },
      { path: './index.js', command: 'node index.js' },
      { path: './dist/index.js', command: 'node dist/index.js' }
    ];
    
    let startFileFound = false;
    
    // Check each file in priority order
    for (const startFile of potentialStartFiles) {
      if (fs.existsSync(startFile.path)) {
        console.log(`Found ${startFile.path}, starting application...`);
        startFileFound = true;
        
        const [command, ...args] = startFile.command.split(' ');
        
        // Create unified environment with forced Neon DB settings
        const envVars = {
          ...process.env,
          DATABASE_PROVIDER: 'neon',
          FORCE_NEON_DB: 'true',
          DISABLE_REPLIT_DB: 'true',
          OVERRIDE_DB_PROVIDER: 'neon',
          NODE_ENV: 'production',
          PORT: port.toString(),
          SKIP_PARTITION_CREATION: 'true',
          IGNORE_PARTITION_ERRORS: 'true'
        };
        
        console.log('Starting with environment variables:');
        console.log('DATABASE_PROVIDER =', envVars.DATABASE_PROVIDER);
        console.log('FORCE_NEON_DB =', envVars.FORCE_NEON_DB);
        console.log('DISABLE_REPLIT_DB =', envVars.DISABLE_REPLIT_DB);
        console.log('OVERRIDE_DB_PROVIDER =', envVars.OVERRIDE_DB_PROVIDER);
        
        await runProcess(command, args, { env: envVars });
        break;
      }
    }
    
    if (!startFileFound) {
      console.error('Error: No valid entry point found. Looked for: server/index.ts, server/index.js, index.js, dist/index.js');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error starting application:', error);
    process.exit(1);
  }
}

// Start the application
main().catch(error => {
  console.error('Critical error:', error);
  process.exit(1);
});