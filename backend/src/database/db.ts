import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const config: mysql.PoolOptions = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'rms_db',
  waitForConnections: true,
  connectionLimit: 10,
  typeCast(field, next) {
    if (field.type === 'DECIMAL' || field.type === 'NEWDECIMAL') {
      const v = field.string();
      return v === null ? null : parseFloat(v);
    }
    return next();
  },
};

let pool: mysql.Pool;

export function getPool(): mysql.Pool {
  if (!pool) pool = mysql.createPool(config);
  return pool;
}

export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const [rows] = await getPool().execute(sql, params);
  return rows as T[];
}

export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function run(sql: string, params: any[] = []): Promise<mysql.ResultSetHeader> {
  const [result] = await getPool().execute(sql, params);
  return result as mysql.ResultSetHeader;
}

export async function initDb(): Promise<void> {
  const { SCHEMA_SQL } = await import('./schema');
  const dbName = process.env.DB_NAME || 'rms_db';

  // Create database if not exists (connect without database first)
  const conn = await mysql.createConnection({
    host: config.host, port: config.port,
    user: config.user, password: config.password,
  });
  await conn.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  await conn.end();

  // Run each CREATE TABLE statement
  const statements = SCHEMA_SQL.split('---').map(s => s.trim()).filter(s => s.length > 0);
  for (const stmt of statements) {
    await getPool().execute(stmt);
  }
}
