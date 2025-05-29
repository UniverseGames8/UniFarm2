import { partitionServiceInstance } from '../services/partitionServiceInstance';

async function testPartitionSystem() {
  try {
    console.log('=== Testing Partition System ===');
    
    // 1. Проверка, партиционирована ли таблица transactions
    const isPartitioned = await partitionServiceInstance.isTablePartitioned('transactions');
    console.log(`Is table transactions partitioned: ${isPartitioned}`);
    
    if (!isPartitioned) {
      console.log('Table transactions is not partitioned. Cannot continue testing.');
      return;
    }
    
    // 2. Получение списка существующих партиций
    console.log('\n=== Existing Partitions ===');
    const partitions = await partitionServiceInstance.getPartitionsList();
    console.log(`Found ${partitions.length} partitions:`);
    partitions.forEach(partition => {
      console.log(`- ${partition.partition_name} (Size: ${partition.size || 'unknown'})`);
    });
    
    // 3. Получение логов партиций
    console.log('\n=== Partition Logs ===');
    const logs = await partitionServiceInstance.getPartitionLogs(10);
    console.log(`Found ${logs.length} log entries:`);
    logs.forEach(log => {
      console.log(`- [${log.created_at}] ${log.operation_type} - ${log.partition_name} (${log.status})`);
      if (log.notes) console.log(`  Notes: ${log.notes}`);
      if (log.error_message) console.log(`  Error: ${log.error_message}`);
    });
    
    // 4. Создание партиций на 7 дней вперед
    console.log('\n=== Creating Future Partitions ===');
    const result = await partitionServiceInstance.createFuturePartitions(7);
    console.log(`Created ${result.createdCount} new partitions out of 8 days total.`);
    console.log('Created partitions:');
    result.partitions.forEach(name => console.log(`- ${name}`));
    
    if (result.errors.length > 0) {
      console.log('Errors encountered:');
      result.errors.forEach(error => console.log(`- ${error}`));
    }
    
    // 5. Повторная проверка списка партиций
    console.log('\n=== Updated Partitions List ===');
    const updatedPartitions = await partitionServiceInstance.getPartitionsList();
    console.log(`Now found ${updatedPartitions.length} partitions (before: ${partitions.length})`);
    
    // 6. Повторная проверка логов партиций
    console.log('\n=== Updated Partition Logs ===');
    const updatedLogs = await partitionServiceInstance.getPartitionLogs(10);
    console.log(`Now found ${updatedLogs.length} log entries:`);
    updatedLogs.forEach(log => {
      console.log(`- [${log.created_at}] ${log.operation_type} - ${log.partition_name} (${log.status})`);
      if (log.notes) console.log(`  Notes: ${log.notes}`);
      if (log.error_message) console.log(`  Error: ${log.error_message}`);
    });
    
    console.log('\n=== Testing Completed Successfully ===');
  } catch (error) {
    console.error('Error during partition testing:', error);
  }
}

// Запуск тестирования
testPartitionSystem()
  .then(() => {
    console.log('Test script completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Test script failed:', error);
    process.exit(1);
  });