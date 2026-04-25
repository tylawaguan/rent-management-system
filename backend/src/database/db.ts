import Database from 'better-sqlite3';
import path from 'path';
import { SCHEMA_SQL } from './schema';
import dotenv from 'dotenv';

dotenv.config();

const DB_PATH = process.env.DB_PATH || './rms.db';
const dbPath = path.resolve(DB_PATH);

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(dbPath);
    db.exec(SCHEMA_SQL);
  }
  return db;
}

export default getDb;
