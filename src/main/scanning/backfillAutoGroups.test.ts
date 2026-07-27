import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { runMigrations } from '../db';
import { migrations } from '../db/migrations';
import { backfillAutoGroups } from './backfillAutoGroups';
import { AUTO_GROUP_WINDOW_MS } from './autoGroup';

interface TestFile {
  id: number;
  path: string;
  mtimeMs: number;
  groupId: number | null;
}

/** A real in-memory better-sqlite3 instance with the actual migrations applied - per this
 *  project's convention of not mocking the DB layer (see CLAUDE.md's Testing section). */
function makeDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  db.prepare(
    "INSERT INTO watched_folders (id, path, added_at, enabled) VALUES (1, 'C:/models', 0, 1)"
  ).run();
  return db;
}

function insertFile(db: Database.Database, file: TestFile): void {
  db.prepare(
    `INSERT INTO files
       (id, folder_id, path, filename, ext, size, mtime_ms, hash_status, thumbnail_status,
        missing, group_id, created_at, updated_at)
     VALUES (?, 1, ?, ?, 'stl', 1024, ?, 'pending', 'pending', 0, ?, 0, 0)`
  ).run(file.id, file.path, file.path.split('/').pop(), file.mtimeMs, file.groupId);
}

function groupIdOf(db: Database.Database, fileId: number): number | null {
  const row = db.prepare('SELECT group_id FROM files WHERE id = ?').get(fileId) as {
    group_id: number | null;
  };
  return row.group_id;
}

describe('backfillAutoGroups', () => {
  it('groups pre-existing files created within the time window in the same folder', () => {
    const db = makeDb();
    insertFile(db, { id: 1, path: 'C:/models/batch/a.stl', mtimeMs: 1_000_000, groupId: null });
    insertFile(db, {
      id: 2,
      path: 'C:/models/batch/b.stl',
      mtimeMs: 1_000_000 + AUTO_GROUP_WINDOW_MS - 1,
      groupId: null
    });
    insertFile(db, {
      id: 3,
      path: 'C:/models/batch/c.stl',
      mtimeMs: 1_000_000 + 2 * AUTO_GROUP_WINDOW_MS, // outside the window relative to file 1
      groupId: null
    });

    const result = backfillAutoGroups(db);

    expect(result.groupsCreated).toBe(1);
    expect(result.filesGrouped).toBe(2);
    const groupA = groupIdOf(db, 1);
    const groupB = groupIdOf(db, 2);
    expect(groupA).not.toBeNull();
    expect(groupA).toBe(groupB);
    expect(groupIdOf(db, 3)).toBeNull();

    const group = db.prepare('SELECT name FROM model_groups WHERE id = ?').get(groupA) as {
      name: string;
    };
    expect(group.name).toBe('batch');
  });

  it('leaves unrelated files (different folder, or too far apart in time) ungrouped', () => {
    const db = makeDb();
    insertFile(db, { id: 1, path: 'C:/models/solo/a.stl', mtimeMs: 5_000, groupId: null });
    insertFile(db, {
      id: 2,
      path: 'C:/models/other/b.stl',
      mtimeMs: 5_000, // same instant, different folder
      groupId: null
    });

    const result = backfillAutoGroups(db);

    expect(result.groupsCreated).toBe(0);
    expect(result.filesGrouped).toBe(0);
    expect(groupIdOf(db, 1)).toBeNull();
    expect(groupIdOf(db, 2)).toBeNull();
  });

  it('never re-groups a file that already belongs to a group', () => {
    const db = makeDb();
    db.prepare(
      "INSERT INTO model_groups (id, name, category_id, created_at, updated_at) VALUES (99, 'Manual group', NULL, 0, 0)"
    ).run();
    insertFile(db, { id: 1, path: 'C:/models/batch/a.stl', mtimeMs: 1_000, groupId: 99 });
    insertFile(db, { id: 2, path: 'C:/models/batch/b.stl', mtimeMs: 1_000, groupId: null });

    const result = backfillAutoGroups(db);

    // File 2 joins file 1's existing manual group rather than a fresh one being created.
    expect(result.groupsCreated).toBe(0);
    expect(result.filesGrouped).toBe(1);
    expect(groupIdOf(db, 1)).toBe(99);
    expect(groupIdOf(db, 2)).toBe(99);
  });

  it('is idempotent - running it twice does not create duplicate groups', () => {
    const db = makeDb();
    insertFile(db, { id: 1, path: 'C:/models/batch/a.stl', mtimeMs: 1_000, groupId: null });
    insertFile(db, { id: 2, path: 'C:/models/batch/b.stl', mtimeMs: 1_000, groupId: null });

    const first = backfillAutoGroups(db);
    const second = backfillAutoGroups(db);

    expect(first.groupsCreated).toBe(1);
    expect(second.groupsCreated).toBe(0);
    expect(second.filesGrouped).toBe(0);
  });

  it('is wired into the real migration sequence and backfills a pre-existing library on upgrade', () => {
    // Simulates the real-world upgrade path: a DB created before this feature existed already
    // has migrations 1 and 2 applied (and data scanned under that older schema); migration 3
    // (backfill_auto_groups) hasn't run yet. Opening it now (runMigrations) should apply id 3
    // against the files that were already sitting there, exactly like a genuine app upgrade.
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    db.exec(
      `CREATE TABLE schema_migrations (
        id INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL
      )`
    );
    const schemaOnly = migrations.filter((m) => m.id < 3);
    for (const migration of schemaOnly) {
      db.exec(migration.sql!);
      db.prepare('INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, 0)').run(
        migration.id,
        migration.name
      );
    }

    db.prepare(
      "INSERT INTO watched_folders (id, path, added_at, enabled) VALUES (1, 'C:/models', 0, 1)"
    ).run();
    insertFile(db, { id: 1, path: 'C:/models/batch/a.stl', mtimeMs: 1_000, groupId: null });
    insertFile(db, { id: 2, path: 'C:/models/batch/b.stl', mtimeMs: 1_000, groupId: null });

    runMigrations(db); // migration 3 is the only one still pending - runs the backfill now

    expect(groupIdOf(db, 1)).not.toBeNull();
    expect(groupIdOf(db, 1)).toBe(groupIdOf(db, 2));
  });
});
