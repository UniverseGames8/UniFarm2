#!/usr/bin/env node

/**
 * Production startup script for UniFarm
 * Uses npm start with PostgreSQL database only
 */

import { spawn } from 'child_process';

// Set correct production environment variables
process.env.NODE_ENV = 'production';
process.env.DATABASE_PROVIDER = 'neon';
process.env.FORCE_NEON_DB = 'true';
process.env.DISABLE_MEMORY_STORAGE = 'true';

console.log('===================================================');
console.log('  UNIFARM PRODUCTION START (POSTGRESQL ONLY)');
console.log('===================================================');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DATABASE_PROVIDER:', process.env.DATABASE_PROVIDER);
console.log('FORCE_NEON_DB:', process.env.FORCE_NEON_DB);
console.log('===================================================');

// Execute npm start
const npmStart = spawn('npm', ['start'], {
  stdio: 'inherit',
  env: process.env
});

npmStart.on('error', (error) => {
  console.error('Failed to start UniFarm:', error);
  process.exit(1);
});

npmStart.on('close', (code) => {
  console.log(`UniFarm process exited with code ${code}`);
  process.exit(code);
});