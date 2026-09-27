import fs from 'fs';
import path from 'path';
import { getDatabase } from './connection';

export function runMigrations(customDbPath?: string): void {
  const db = getDatabase(customDbPath);

  // Migration tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const migrationsDir = path.resolve(process.cwd(), 'database/migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.warn(`[Migrations] Directory not found: ${migrationsDir}`);
    return;
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const getMigration = db.prepare('SELECT filename FROM schema_migrations WHERE filename = ?');
  const insertMigration = db.prepare('INSERT INTO schema_migrations (filename) VALUES (?)');

  for (const file of files) {
    const row = getMigration.get(file);
    if (!row) {
      console.log(`[Migrations] Applying: ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      
      const applyTx = db.transaction(() => {
        db.exec(sql);
        insertMigration.run(file);
      });

      applyTx();
      console.log(`[Migrations] Successfully applied: ${file}`);
    }
  }

  console.log('[Migrations] All migrations are up to date.');
}

// Run migrations if invoked directly
runMigrations();

