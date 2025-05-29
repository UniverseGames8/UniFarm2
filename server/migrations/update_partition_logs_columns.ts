import { sql } from 'drizzle-orm';
import { db } from '../db';

function log(message: string) {
  console.log(`[Migration] ${message}`);
}

export async function updatePartitionLogsColumns() {
  try {
    // Проверяем существующие колонки
    const columnsCheckResult = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'partition_logs'
    `);
    
    const columns = columnsCheckResult.rows.map((row: any) => row.column_name);
    log(`Existing columns: ${columns.join(', ')}`);
    
    // Переименовываем operation в operation_type, если это необходимо
    if (columns.includes('operation') && !columns.includes('operation_type')) {
      log('Renaming column operation to operation_type');
      await db.execute(sql`ALTER TABLE partition_logs RENAME COLUMN operation TO operation_type`);
    }
    
    // Переименовываем error_details в error_message, если это необходимо
    if (columns.includes('error_details') && !columns.includes('error_message')) {
      log('Renaming column error_details to error_message');
      await db.execute(sql`ALTER TABLE partition_logs RENAME COLUMN error_details TO error_message`);
    }
    
    // Переименовываем timestamp в created_at, если это необходимо
    if (columns.includes('timestamp') && !columns.includes('created_at')) {
      log('Renaming column timestamp to created_at');
      await db.execute(sql`ALTER TABLE partition_logs RENAME COLUMN timestamp TO created_at`);
    }
    
    // Если колонка notes отсутствует, добавляем ее
    if (!columns.includes('notes')) {
      log('Adding missing notes column');
      await db.execute(sql`ALTER TABLE partition_logs ADD COLUMN notes TEXT`);
    }
    
    // Если колонка error_message отсутствует, добавляем ее
    if (!columns.includes('error_message') && !columns.includes('error_details')) {
      log('Adding missing error_message column');
      await db.execute(sql`ALTER TABLE partition_logs ADD COLUMN error_message TEXT`);
    }
    
    log('Partition_logs table columns updated successfully');
    return true;
  } catch (error: any) {
    log(`Error updating partition_logs columns: ${error.message}`);
    console.error(error);
    return false;
  }
}

export async function runMigration() {
  try {
    log('Starting migration: Updating partition_logs columns');
    await updatePartitionLogsColumns();
    log('Migration completed successfully');
  } catch (error: any) {
    log(`Migration failed: ${error.message}`);
    console.error(error);
    throw error;
  }
}

// Автоматический запуск миграции при выполнении файла
runMigration()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });