/**
 * Модуль для подробного логирования и анализа initData от Telegram Mini App
 */
import { Request, Response, NextFunction } from 'express';

/**
 * Улучшенное логирование для Telegram initData
 * Извлекает данные из всех возможных источников и выводит подробную информацию
 */
export function telegramInitDataLogger(req: Request, res: Response, next: NextFunction) {
  try {
    // Ищем initData во всех возможных источниках (заголовки разных форматов, query параметры)
    const telegramInitData = 
      req.headers['x-telegram-init-data'] || 
      req.headers['telegram-init-data'] || 
      req.query.initData || 
      req.query.tgInitData ||
      req.body?.initData;
      
    if (telegramInitData) {
      console.log('\n====== TELEGRAM INIT DATA LOGGER ======');
      console.log(`[${new Date().toISOString()}] Получены данные initData`);
      console.log('Источник:', 
        req.headers['x-telegram-init-data'] ? 'x-telegram-init-data header' :
        req.headers['telegram-init-data'] ? 'telegram-init-data header' :
        req.query.initData ? 'query параметр initData' :
        req.query.tgInitData ? 'query параметр tgInitData' : 
        req.body?.initData ? 'body.initData' : 'неизвестно'
      );
      
      // Проверка формата строки и длины
      if (typeof telegramInitData === 'string') {
        console.log('Длина initData:', telegramInitData.length);
        console.log('Содержимое:');
        console.log('---НАЧАЛО INIT DATA---');
        console.log(telegramInitData);
        console.log('---КОНЕЦ INIT DATA---');
        
        try {
          // Анализируем структуру (URL params или JSON)
          if (telegramInitData.includes('=') && telegramInitData.includes('&')) {
            console.log('Формат: URL-параметры');
            const decodedData = new URLSearchParams(telegramInitData);
            const extractedData: Record<string, any> = {};
            
            // Извлекаем все поля для анализа
            decodedData.forEach((value, key) => {
              if (key === 'hash') {
                // hash - приватное поле, нужное для проверки, не показываем полностью
                extractedData[key] = value.substring(0, 8) + '...' + value.substring(value.length - 8);
              } else if (key === 'user') {
                try {
                  extractedData[key] = JSON.parse(value);
                  console.log('Данные пользователя найдены.');
                  console.log('ID пользователя:', extractedData[key].id);
                  console.log('Имя пользователя:', 
                    extractedData[key].username ? 
                      '@' + extractedData[key].username : 
                      (extractedData[key].first_name || '') + ' ' + (extractedData[key].last_name || '')
                  );
                } catch (e) {
                  extractedData[key] = value;
                }
              } else {
                extractedData[key] = value;
              }
            });
            
            // Выводим ключевые поля
            console.log('Извлеченные данные:');
            if (extractedData.auth_date) console.log('- auth_date:', extractedData.auth_date);
            if (extractedData.query_id) console.log('- query_id:', extractedData.query_id);
            if (extractedData.start_param) console.log('- start_param:', extractedData.start_param);
            
            // Проверяем, что дата авторизации валидна
            if (extractedData.auth_date) {
              const authDate = new Date(parseInt(extractedData.auth_date, 10) * 1000);
              const now = new Date();
              const diffHours = (now.getTime() - authDate.getTime()) / (1000 * 60 * 60);
              console.log('Дата авторизации:', authDate.toISOString());
              console.log('Время с момента авторизации:', Math.round(diffHours * 10) / 10, 'ч');
              
              if (diffHours > 24) {
                console.warn('ВНИМАНИЕ: initData устарел (больше 24 часов)!');
              }
            }
            
            // Структура для вывода в консоль
            const dataForConsole = { ...extractedData };
            if (dataForConsole.user) delete dataForConsole.user; // Уже вывели отдельно
            if (dataForConsole.hash) delete dataForConsole.hash; // Уже вывели отдельно в замаскированном виде
            
            // Выводим оставшиеся поля
            if (Object.keys(dataForConsole).length > 0) {
              console.log('Другие поля:', dataForConsole);
            }
          } else {
            // Возможно JSON формат или другой формат
            try {
              const jsonData = JSON.parse(telegramInitData);
              console.log('Формат: JSON');
              console.log('Содержимое JSON:', jsonData);
            } catch (e) {
              console.log('Формат: неизвестный (не URL-параметры и не JSON)');
            }
          }
        } catch (error) {
          console.error('Ошибка при анализе initData:', error);
        }
      } else {
        console.log('Формат: не строка');
        console.log('Тип данных:', typeof telegramInitData);
      }
      
      console.log('====== КОНЕЦ TELEGRAM INIT DATA LOGGER ======\n');
    }
  } catch (error) {
    console.error('Ошибка в логгере initData:', error);
  }
  
  // Всегда продолжаем цепочку middleware
  next();
}