import type Database from 'better-sqlite3'
import { backfillAutoGroups } from '../scanning/backfillAutoGroups'

export interface Migration {
  id: number
  name: string
  /** Raw schema DDL, run first if present. */
  sql?: string
  /**
   * One-off data transform, run after `sql` (if both are present) inside the same transaction as
   * the rest of migration application. Used for migrations that need JS logic rather than pure
   * DDL/DML - e.g. id 3's auto-group backfill (see backfillAutoGroups.ts), which needs to compare
   * file timestamps and replay grouping decisions, not just alter the schema.
   */
  migrate?: (db: Database.Database) => void
}

export const migrations: Migration[] = [
  {
    id: 1,
    name: 'init',
    sql: `
      CREATE TABLE watched_folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT NOT NULL UNIQUE,
        added_at INTEGER NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        color TEXT
      );

      CREATE TABLE files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        folder_id INTEGER NOT NULL REFERENCES watched_folders(id) ON DELETE CASCADE,
        path TEXT NOT NULL UNIQUE,
        filename TEXT NOT NULL,
        ext TEXT NOT NULL,
        size INTEGER NOT NULL,
        mtime_ms INTEGER NOT NULL,
        content_hash TEXT,
        hash_status TEXT NOT NULL DEFAULT 'pending',
        thumbnail_path TEXT,
        thumbnail_status TEXT NOT NULL DEFAULT 'pending',
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        missing INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX idx_files_folder ON files(folder_id);
      CREATE INDEX idx_files_hash ON files(content_hash);
      CREATE INDEX idx_files_size ON files(size);

      CREATE TABLE tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        color TEXT
      );

      CREATE TABLE file_tags (
        file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (file_id, tag_id)
      );
    `
  },
  {
    id: 2,
    name: 'model_groups',
    sql: `
      CREATE TABLE model_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      ALTER TABLE files ADD COLUMN group_id INTEGER REFERENCES model_groups(id) ON DELETE SET NULL;
      CREATE INDEX idx_files_group ON files(group_id);
    `
  },
  {
    id: 3,
    name: 'backfill_auto_groups',
    // Retroactively applies issue #32's "group files created within ~10s of each other" rule to
    // whatever's already in the library, since libraries scanned before this feature existed
    // never went through it. Runs exactly once per DB, same as any other migration; new files
    // scanned after this point get the equivalent live treatment via maybeAutoGroupFile
    // (autoGroup.ts), hooked into watcherManager.ts.
    migrate: (db) => {
      backfillAutoGroups(db)
    }
  }
]
