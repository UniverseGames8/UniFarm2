import { tonBoostServiceInstance } from './server/services/tonBoostServiceInstance';

const main = async () => {
  try {
    console.log('Вызываем обновление TON фарминга для пользователя с ID 1');
    const result = await tonBoostServiceInstance.calculateAndUpdateUserTonFarming(1);
    console.log('Результат обновления:', JSON.stringify(result, null, 2));
    
    console.log('Проверяем информацию о TON фарминге');
    const farmingInfo = await tonBoostServiceInstance.getUserTonFarmingInfo(1);
    console.log('Фарминг-информация:', JSON.stringify(farmingInfo, null, 2));
  } catch (error) {
    console.error('Ошибка при выполнении:', error);
    process.exit(1);
  }
};

main();