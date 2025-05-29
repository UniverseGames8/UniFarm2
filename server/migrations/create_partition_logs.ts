import { Pool } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { sql } from 'drizzle-orm';
import { db } from '../db';

dotenv.config();

function log(message: string) {
  console.log(`[Migration] ${message}`);
}

export async function createPartitionLogs() {
  await db.execute(sql`
    DROP TABLE IF EXISTS partition_logs;

    CREATE TABLE partition_logs (
      id SERIAL PRIMARY KEY,
      operation_type VARCHAR(50) NOT NULL,
      partition_name VARCHAR(100) NOT NULL,
      status VARCHAR(20) NOT NULL,
      notes TEXT,
      error_message TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX idx_partition_logs_status ON partition_logs(status);
    CREATE INDEX idx_partition_logs_name ON partition_logs(partition_name);
    CREATE INDEX idx_partition_logs_date ON partition_logs(created_at);
  `);
  log('Created partition_logs table with error_message column');
}

export async function runMigration() {
  try {
    log('Starting migration: Creating partition_logs table');
    await createPartitionLogs();
    log('Migration completed successfully');
  } catch (error: any) {
    log(`Migration failed: ${error.message}`);
    console.error(error);
    throw error;
  }
}

if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}