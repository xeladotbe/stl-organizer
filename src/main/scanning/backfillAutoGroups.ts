import type Database from 'better-sqlite3';
import { planAutoGroup, deriveAutoGroupName } from './autoGroup';
import type { AutoGroupCandidate } from './autoGroup';

export interface BackfillResult {
  groupsCreated: number;
  filesGrouped: number;
}

interface BackfillFileRow {
  id: number;
  folder_id: number;
  path: string;
  mtime_ms: number;
  group_id: number | null;
}

function toCandidate(row: BackfillFileRow): AutoGroupCandidate {
  return { id: row.id, path: row.path, mtimeMs: row.mtime_ms, groupId: row.group_id };
}

/**
 * One-off, retroactive counterpart to maybeAutoGroupFile (see autoGroup.ts) - run once as part of
 * the DB migration sequence (migrations.ts, id 3) so libraries scanned before auto-grouping
 * existed get the same treatment new scans get for free, per issue #32.
 *
 * Processes every non-missing file in ascending mtime order, replaying the exact same
 * planAutoGroup decision the live scanner hook uses against that file's siblings-so-far. Because
 * files are visited oldest-first and each decision is applied to the in-memory working set before
 * moving on, this produces the same result auto-grouping would have produced if it had been
 * active since the library's very first scan (earlier-created files are always resolved, and
 * therefore already carry a group_id, before a later file that might join their group is
 * considered).
 */
export function backfillAutoGroups(db: Database.Database): BackfillResult {
  const rows = db
    .prepare(
      `SELECT id, folder_id, path, mtime_ms, group_id FROM files
       WHERE missing = 0
       ORDER BY mtime_ms ASC, id ASC`
    )
    .all() as BackfillFileRow[];

  if (rows.length === 0) return { groupsCreated: 0, filesGrouped: 0 };

  const byId = new Map(rows.map((row) => [row.id, row]));
  const byFolder = new Map<number, BackfillFileRow[]>();
  for (const row of rows) {
    const list = byFolder.get(row.folder_id);
    if (list) list.push(row);
    else byFolder.set(row.folder_id, [row]);
  }

  const createGroupStmt = db.prepare(
    'INSERT INTO model_groups (name, category_id, created_at, updated_at) VALUES (?, NULL, ?, ?)'
  );
  const touchGroupStmt = db.prepare('UPDATE model_groups SET updated_at = ? WHERE id = ?');
  const setGroupStmt = db.prepare('UPDATE files SET group_id = ?, updated_at = ? WHERE id = ?');

  let groupsCreated = 0;
  let filesGrouped = 0;

  const run = db.transaction(() => {
    for (const row of rows) {
      if (row.group_id != null) continue;

      const candidates = (byFolder.get(row.folder_id) ?? []).map(toCandidate);
      const decision = planAutoGroup(toCandidate(row), candidates);
      if (decision.action === 'none') continue;

      const now = Date.now();
      if (decision.action === 'create') {
        const info = createGroupStmt.run(deriveAutoGroupName(row.path), now, now);
        const groupId = Number(info.lastInsertRowid);
        for (const id of decision.fileIds) {
          setGroupStmt.run(groupId, now, id);
          const memberRow = byId.get(id);
          if (memberRow) memberRow.group_id = groupId;
        }
        groupsCreated++;
        filesGrouped += decision.fileIds.length;
      } else {
        for (const id of decision.fileIds) {
          setGroupStmt.run(decision.groupId, now, id);
          const memberRow = byId.get(id);
          if (memberRow) memberRow.group_id = decision.groupId;
        }
        touchGroupStmt.run(now, decision.groupId);
        filesGrouped += decision.fileIds.length;
      }
    }
  });
  run();

  return { groupsCreated, filesGrouped };
}
