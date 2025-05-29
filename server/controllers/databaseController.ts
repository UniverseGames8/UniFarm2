/**
 * Контроллер для работы с базой данных
 * 
 * Предоставляет API-эндпоинты для выполнения общих операций с базой данных:
 * - Проверка состояния подключения
 * - Получение списка таблиц
 * - Получение информации о структуре таблицы
 * - Выполнение проверок целостности данных
 */

import { Request, Response } from 'express';
import { databaseService } from '../services';
import { pool } from '../db';

/**
 * Проверяет состояние подключения к базе данных
 */
export async function checkConnection(req: Request, res: Response) {
  try {
    const connectionStatus = await databaseService.checkConnection();
    
    return res.json({
      success: true,
      data: connectionStatus
    });
  } catch (error) {
    console.error('Error in checkConnection:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Ошибка при проверке подключения к базе данных',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Получает статус базы данных
 */
export async function getDatabaseStatus(req: Request, res: Response) {
  try {
    const status = await databaseService.getDatabaseStatus();
    
    return res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error in getDatabaseStatus:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Ошибка при получении статуса базы данных',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Получает список таблиц в базе данных
 */
export async function getTablesList(req: Request, res: Response) {
  try {
    const tables = await databaseService.getTablesList();
    
    return res.json({
      success: true,
      data: tables
    });
  } catch (error) {
    console.error('Error in getTablesList:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Ошибка при получении списка таблиц',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Получает информацию о структуре таблицы
 */
export async function getTableInfo(req: Request, res: Response) {
  try {
    const { tableName } = req.params;
    
    if (!tableName) {
      return res.status(400).json({
        success: false,
        message: 'Не указано название таблицы'
      });
    }
    
    const tableInfo = await databaseService.getTableInfo(tableName);
    
    return res.json({
      success: true,
      data: tableInfo
    });
  } catch (error) {
    console.error('Error in getTableInfo:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Ошибка при получении информации о таблице',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Создает резервную копию таблицы
 */
export async function backupTable(req: Request, res: Response) {
  try {
    const { tableName } = req.params;
    
    if (!tableName) {
      return res.status(400).json({
        success: false,
        message: 'Не указано название таблицы'
      });
    }
    
    const backupResult = await databaseService.backupTable(tableName);
    
    return res.json({
      success: true,
      data: backupResult
    });
  } catch (error) {
    console.error('Error in backupTable:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Ошибка при создании резервной копии таблицы',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Проверяет целостность данных в базе
 */
export async function checkDataIntegrity(req: Request, res: Response) {
  try {
    const { tables, relations } = req.query;
    
    const options = {
      tables: typeof tables === 'string' ? tables.split(',') : undefined,
      relations: relations === 'true'
    };
    
    const integrityResult = await databaseService.checkDataIntegrity(options);
    
    return res.json({
      success: true,
      data: integrityResult
    });
  } catch (error) {
    console.error('Error in checkDataIntegrity:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Ошибка при проверке целостности данных',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Выполняет произвольный SQL-запрос (только для разработки и отладки)
 * В production этот эндпоинт должен быть отключен или защищен
 */
export async function executeQuery(req: Request, res: Response) {
  try {
    const { query, params } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Не указан SQL-запрос'
      });
    }
    
    // Проверяем, что запрос не изменяет структуру таблиц, если это не явно разрешено
    const isStructureModification = /^(CREATE|DROP|ALTER|TRUNCATE)/i.test(query.trim());
    const allowStructureModification = req.body.allowStructureModification === true;
    
    if (isStructureModification && !allowStructureModification) {
      return res.status(403).json({
        success: false,
        message: 'Изменение структуры таблиц запрещено без явного разрешения'
      });
    }
    
    // Выполняем запрос
    const result = await databaseService.executeRawQuery(query, params);
    
    return res.json({
      success: true,
      data: {
        rowCount: result.length,
        rows: result
      }
    });
  } catch (error) {
    console.error('Error in executeQuery:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Ошибка при выполнении SQL-запроса',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Добавляет отсутствующую колонку uni_farming_deposit в таблицу users
 */
export async function addMissingUserColumns(req: Request, res: Response) {
  try {
    // Проверяем наличие колонки uni_farming_deposit в таблице users
    const columnsResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'users' 
      AND column_name = 'uni_farming_deposit'
    `);
    
    // Если колонка не существует, добавляем её
    if (columnsResult.rows.length === 0) {
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN uni_farming_deposit NUMERIC(18, 6) DEFAULT 0
      `);
      
      console.log('[DatabaseController] Добавлена колонка uni_farming_deposit в таблицу users');
    }
    
    // Проверяем наличие колонки uni_farming_activated_at в таблице users
    const activatedAtResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'users' 
      AND column_name = 'uni_farming_activated_at'
    `);
    
    // Если колонка не существует, добавляем её
    if (activatedAtResult.rows.length === 0) {
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN uni_farming_activated_at TIMESTAMP
      `);
      
      console.log('[DatabaseController] Добавлена колонка uni_farming_activated_at в таблицу users');
    }
    
    return res.json({
      success: true,
      message: 'Проверка и добавление отсутствующих колонок успешно выполнены',
      data: {
        uni_farming_deposit_added: columnsResult.rows.length === 0,
        uni_farming_activated_at_added: activatedAtResult.rows.length === 0
      }
    });
  } catch (error) {
    console.error('[DatabaseController] Error in addMissingUserColumns:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Ошибка при добавлении отсутствующих колонок',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}