import Database from 'better-sqlite3';
import { app } from 'electron';
import { join } from 'path';
import { migrations } from './migrations';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = join(app.getPath('userData'), 'library.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  return db;
}

/** Exported so tests can apply the real schema (and any data migrations) to an in-memory
 *  better-sqlite3 instance without going through getDb()'s Electron app.getPath() dependency. */
export function runMigrations(db: Database.Database): void {
  db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    )`
  );

  const appliedIds = new Set(
    (db.prepare('SELECT id FROM schema_migrations').all() as { id: number }[]).map((row) => row.id)
  );
  const recordApplied = db.prepare(
    'INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)'
  );

  for (const migration of migrations) {
    if (appliedIds.has(migration.id)) continue;
    const applyMigration = db.transaction(() => {
      if (migration.sql) db.exec(migration.sql);
      if (migration.migrate) migration.migrate(db);
      recordApplied.run(migration.id, migration.name, Date.now());
    });
    applyMigration();
  }
}
