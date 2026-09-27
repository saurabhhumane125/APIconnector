import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

let dbInstance: Database.Database | null = null;

export function getDatabasePath(): string {
  const dbPath = process.env.DATABASE_PATH || 'data/hub.db';
  return path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath);
}

export function getDatabase(customPath?: string): Database.Database {
  if (dbInstance && !customPath) {
    return dbInstance;
  }

  const resolvedPath = customPath || getDatabasePath();
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(resolvedPath);

  // Performance and integrity pragmas
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');

  if (!customPath) {
    dbInstance = db;
  }

  return db;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
