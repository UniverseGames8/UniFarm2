/**
 * Unified startup script for UniFarm (Remix)
 * - Forces Neon DB usage regardless of .replit settings
 * - Suitable for deployment
 * - Ensures DB connections are correctly established
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Set environment variables to ENSURE Neon DB usage with highest priority
// These settings will override any settings from .replit file
process.env.DATABASE_PROVIDER = 'neon';
process.env.FORCE_NEON_DB = 'true';
process.env.DISABLE_REPLIT_DB = 'true';
process.env.OVERRIDE_DB_PROVIDER = 'neon'; 
process.env.NODE_ENV = 'production';
process.env.SKIP_PARTITION_CREATION = 'true';
process.env.IGNORE_PARTITION_ERRORS = 'true';
// Отключаем проверку Telegram-окружения для прямого доступа по URL
process.env.SKIP_TELEGRAM_CHECK = 'true';
process.env.ALLOW_BROWSER_ACCESS = 'true';

// Log early DB configuration to verify settings
console.log('===============================================');
console.log('UNIFARM STARTUP - FORCED NEON DB CONFIGURATION');
console.log('===============================================');
console.log('DATABASE_PROVIDER =', process.env.DATABASE_PROVIDER);
console.log('FORCE_NEON_DB =', process.env.FORCE_NEON_DB);
console.log('DISABLE_REPLIT_DB =', process.env.DISABLE_REPLIT_DB);
console.log('OVERRIDE_DB_PROVIDER =', process.env.OVERRIDE_DB_PROVIDER);
console.log('NODE_ENV =', process.env.NODE_ENV);
console.log('PORT =', process.env.PORT);
console.log('SKIP_PARTITION_CREATION =', process.env.SKIP_PARTITION_CREATION);
console.log('IGNORE_PARTITION_ERRORS =', process.env.IGNORE_PARTITION_ERRORS);
console.log('SKIP_TELEGRAM_CHECK =', process.env.SKIP_TELEGRAM_CHECK);
console.log('ALLOW_BROWSER_ACCESS =', process.env.ALLOW_BROWSER_ACCESS);
console.log('===============================================');

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
    // Убедимся, что используем порт 3000 для совместимости с Replit
    const port = parseInt(process.env.PORT || '3000', 10);
    console.log(`Using port ${port} for application...`);
    
    // Проверяем, собран ли проект
    if (process.env.NODE_ENV === 'production' && !fs.existsSync('./dist/index.js')) {
      console.log('Production build not found. Running build process...');
      
      try {
        // Запускаем сборку проекта
        await runProcess('npm', ['run', 'build']);
        console.log('Build completed successfully!');
      } catch (buildError) {
        console.error('Error during build process:', buildError);
        console.log('Continuing with available files...');
      }
    }
    
    // Определяем последовательность приоритета файлов для запуска
    const potentialStartFiles = [
      { path: './dist/index.js', command: 'node dist/index.js' },
      { path: './server/index.js', command: 'node server/index.js' },
      { path: './server/index.ts', command: 'npx tsx server/index.ts' },
      { path: './index.js', command: 'node index.js' }
    ];
    
    let startFileFound = false;
    
    // Проверяем каждый файл в порядке приоритета
    for (const startFile of potentialStartFiles) {
      if (fs.existsSync(startFile.path)) {
        console.log(`Found ${startFile.path}, starting application...`);
        startFileFound = true;
        
        const [command, ...args] = startFile.command.split(' ');
        
        // Создаем единую среду с приоритетом принудительных настроек для Neon DB
        const envVars = {
          ...process.env,
          DATABASE_PROVIDER: 'neon',
          FORCE_NEON_DB: 'true',
          DISABLE_REPLIT_DB: 'true',
          OVERRIDE_DB_PROVIDER: 'neon',
          NODE_ENV: 'production',
          PORT: port.toString(),
          SKIP_PARTITION_CREATION: 'true',
          IGNORE_PARTITION_ERRORS: 'true',
          SKIP_TELEGRAM_CHECK: 'true',
          ALLOW_BROWSER_ACCESS: 'true'
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