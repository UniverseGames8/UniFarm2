/**
 * СПРОЩЕНЕ ПІДКЛЮЧЕННЯ ДО PRODUCTION NEON DB
 * Тільки пряме з'єднання з ep-lucky-boat-a463bggt
 */

import { Pool, PoolClient } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../shared/schema.js';

// PRODUCTION DATABASE CONNECTION STRING
const PRODUCTION_DB_URL = 'postgresql://neondb_owner:npg_SpgdNBV70WKl@ep-lucky-boat-a463bggt-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';

class SimpleProductionDB {
  private static instance: SimpleProductionDB;
  private pool: Pool | null = null;
  private drizzleDb: any = null;

  private constructor() {
    console.log('🎯 [DB] Ініціалізація PRODUCTION підключення до ep-lucky-boat-a463bggt');
  }

  public static getInstance(): SimpleProductionDB {
    if (!SimpleProductionDB.instance) {
      SimpleProductionDB.instance = new SimpleProductionDB();
    }
    return SimpleProductionDB.instance;
  }

  public async getPool(): Promise<Pool> {
    if (!this.pool) {
      console.log('🚀 [DB] Створення підключення до PRODUCTION бази...');
      
      this.pool = new Pool({
        connectionString: PRODUCTION_DB_URL,
        ssl: { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });

      // Перевірка підключення
      try {
        const client = await this.pool.connect();
        const result = await client.query('SELECT current_database(), COUNT(*) as user_count FROM public.users');
        client.release();
        
        const dbName = result.rows[0].current_database;
        const userCount = result.rows[0].user_count;
        
        console.log(`✅ [DB CONNECTED] to ep-lucky-boat-a463bggt`);
        console.log(`✅ [DB] База: ${dbName}, користувачів: ${userCount}`);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('❌ [DB] Помилка підключення:', errorMessage);
        throw error;
      }
    }
    
    return this.pool;
  }

  public async getClient(): Promise<PoolClient> {
    const pool = await this.getPool();
    return pool.connect();
  }

  public async getDrizzle() {
    if (!this.drizzleDb) {
      const pool = await this.getPool();
      this.drizzleDb = drizzle(pool, { schema });
    }
    return this.drizzleDb;
  }

  public async execute(query: string, params: any[] = []) {
    const pool = await this.getPool();
    const client = await pool.connect();
    try {
      return await client.query(query, params);
    } finally {
      client.release();
    }
  }

  public async select(query: string, params: any[] = []) {
    const pool = await this.getPool();
    const client = await pool.connect();
    try {
      return await client.query(query, params);
    } finally {
      client.release();
    }
  }

  public async end() {
    if (this.pool) {
      await this.pool.end();
    }
  }
}

// Експорт єдиного екземпляра
const dbManager = SimpleProductionDB.getInstance();

// Основні експорти для сумісності
export const getConnectionManager = () => dbManager;

// Створюємо пул з'єднань
let poolInstance: Pool | null = null;
export const getPool = async () => {
  if (!poolInstance) {
    poolInstance = await dbManager.getPool();
  }
  return poolInstance;
};

// Створюємо drizzle екземпляр
let dbInstance: any = null;
export const getDb = async () => {
  if (!dbInstance) {
    const pool = await getPool();
    dbInstance = drizzle(pool, { schema });
  }
  return dbInstance;
};

export async function queryWithRetry(text: string, params: any[] = []): Promise<any> {
  const pool = await getPool();
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

export async function getDbConnection() {
  return getPool();
}

export async function testConnection(): Promise<boolean> {
  try {
    const pool = await getPool();
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ [DB] Тест підключення невдалий:', errorMessage);
    return false;
  }
}

// Статус підключення
export function getConnectionStatus() {
  return {
    isConnected: true,
    connectionName: 'production-neon-ep-lucky-boat-a463bggt',
    isMemoryMode: false
  };
}

export const dbType = 'postgres';
export const dbState = {
  isReady: true
};

// Додаткові експорти для сумісності
export const getSingleDbConnection = {
  select: async (query: string, params: any[] = []) => {
    const pool = await getPool();
    const client = await pool.connect();
    try {
      const result = await client.query(query, params);
      return result.rows;
    } finally {
      client.release();
    }
  },
  execute: async (query: string, params: any[] = []) => {
    const pool = await getPool();
    const client = await pool.connect();
    try {
      const result = await client.query(query, params);
      return result.rows;
    } finally {
      client.release();
    }
  }
};

export const getSinglePool = {
  query: async (text: string, params: any[] = []) => {
    const pool = await getPool();
    const client = await pool.connect();
    try {
      const result = await client.query(text, params);
      return result.rows;
    } finally {
      client.release();
    }
  },
  end: async () => {
    const pool = await getPool();
    await pool.end();
  }
};

// Експортуємо db та pool для сумісності
export const db = {
  execute: async (query: string, params: any[] = []) => {
    const pool = await getPool();
    const client = await pool.connect();
    try {
      const result = await client.query(query, params);
      return result.rows;
    } finally {
      client.release();
    }
  }
};

export const pool = {
  query: async (text: string, params: any[] = []) => {
    const pool = await getPool();
    const client = await pool.connect();
    try {
      const result = await client.query(text, params);
      return result.rows;
    } finally {
      client.release();
    }
  }
};