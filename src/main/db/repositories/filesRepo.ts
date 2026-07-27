import { getDb } from '../index';
import type { FileRow, ModelExt, ListFilesFilter } from '../../../shared/types';

export interface UpsertFileInput {
  folderId: number;
  path: string;
  filename: string;
  ext: ModelExt;
  size: number;
  mtimeMs: number;
}

/** Insert a new file row, or update an existing one by path. Resets hash/thumbnail state if the file content may have changed (size/mtime differ). */
export function upsertFile(input: UpsertFileInput): FileRow {
  const db = getDb();
  const now = Date.now();
  const existing = db.prepare('SELECT * FROM files WHERE path = ?').get(input.path) as
    FileRow | undefined;

  if (existing) {
    const contentMayHaveChanged =
      existing.size !== input.size || existing.mtime_ms !== input.mtimeMs;
    db.prepare(
      `UPDATE files SET
         folder_id = ?, filename = ?, ext = ?, size = ?, mtime_ms = ?, missing = 0, updated_at = ?,
         content_hash = CASE WHEN ? THEN NULL ELSE content_hash END,
         hash_status = CASE WHEN ? THEN 'pending' ELSE hash_status END,
         thumbnail_path = CASE WHEN ? THEN NULL ELSE thumbnail_path END,
         thumbnail_status = CASE WHEN ? THEN 'pending' ELSE thumbnail_status END
       WHERE id = ?`
    ).run(
      input.folderId,
      input.filename,
      input.ext,
      input.size,
      input.mtimeMs,
      now,
      contentMayHaveChanged ? 1 : 0,
      contentMayHaveChanged ? 1 : 0,
      contentMayHaveChanged ? 1 : 0,
      contentMayHaveChanged ? 1 : 0,
      existing.id
    );
    return getFileById(existing.id)!;
  }

  const info = db
    .prepare(
      `INSERT INTO files (folder_id, path, filename, ext, size, mtime_ms, hash_status, thumbnail_status, missing, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', 'pending', 0, ?, ?)`
    )
    .run(
      input.folderId,
      input.path,
      input.filename,
      input.ext,
      input.size,
      input.mtimeMs,
      now,
      now
    );
  return getFileById(Number(info.lastInsertRowid))!;
}

export function getFileById(id: number): FileRow | undefined {
  return getDb().prepare('SELECT * FROM files WHERE id = ?').get(id) as FileRow | undefined;
}

export function markMissingByPath(path: string): void {
  getDb()
    .prepare('UPDATE files SET missing = 1, updated_at = ? WHERE path = ?')
    .run(Date.now(), path);
}

export function listFiles(filter: ListFilesFilter = {}): FileRow[] {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (!filter.includeMissing) clauses.push('missing = 0');
  if (filter.search) {
    clauses.push("filename LIKE ? ESCAPE '\\'");
    const escaped = filter.search.replace(/[\\%_]/g, (c) => `\\${c}`);
    params.push(`%${escaped}%`);
  }
  if (filter.folderId != null) {
    clauses.push('folder_id = ?');
    params.push(filter.folderId);
  }
  if (filter.categoryId !== undefined) {
    if (filter.categoryId === null) {
      clauses.push('category_id IS NULL');
    } else {
      clauses.push('category_id = ?');
      params.push(filter.categoryId);
    }
  }
  if (filter.tagIds && filter.tagIds.length > 0) {
    clauses.push(
      `id IN (SELECT file_id FROM file_tags WHERE tag_id IN (${filter.tagIds.map(() => '?').join(',')}))`
    );
    params.push(...filter.tagIds);
  }

  let sql = 'SELECT * FROM files';
  if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
  sql += ' ORDER BY filename COLLATE NOCASE';

  return getDb()
    .prepare(sql)
    .all(...params) as FileRow[];
}

/**
 * Files in the same watched folder whose mtime falls within `windowMs` of `mtimeMs` - a cheap
 * SQL pre-filter for auto-grouping (see autoGroup.ts). folder_id only narrows to the watched
 * folder's root, which can contain many subfolders, so callers still need to check the results
 * actually share the same directory.
 */
export function findFilesNearMtime(
  folderId: number,
  mtimeMs: number,
  windowMs: number,
  excludeId: number
): FileRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM files
       WHERE folder_id = ? AND missing = 0 AND id != ?
         AND mtime_ms BETWEEN ? AND ?`
    )
    .all(folderId, excludeId, mtimeMs - windowMs, mtimeMs + windowMs) as FileRow[];
}

/** Updates the row after an on-disk rename. Caller renames the file first; this just points the DB at the new location. */
export function renameFile(id: number, newPath: string, newFilename: string): void {
  getDb()
    .prepare('UPDATE files SET path = ?, filename = ?, updated_at = ? WHERE id = ?')
    .run(newPath, newFilename, Date.now(), id);
}

export function setCategory(fileId: number, categoryId: number | null): void {
  getDb()
    .prepare('UPDATE files SET category_id = ?, updated_at = ? WHERE id = ?')
    .run(categoryId, Date.now(), fileId);
}

export function setFileTags(fileId: number, tagIds: number[]): void {
  const db = getDb();
  const applyChange = db.transaction(() => {
    db.prepare('DELETE FROM file_tags WHERE file_id = ?').run(fileId);
    const insert = db.prepare('INSERT INTO file_tags (file_id, tag_id) VALUES (?, ?)');
    for (const tagId of tagIds) insert.run(fileId, tagId);
  });
  applyChange();
}

/** Files worth hashing: not yet hashed, and sharing their exact size with at least one other file (a unique size can never be an exact duplicate). */
export function findHashCandidates(limit: number): FileRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM files
       WHERE missing = 0 AND hash_status = 'pending'
         AND size IN (SELECT size FROM files WHERE missing = 0 GROUP BY size HAVING COUNT(*) > 1)
       LIMIT ?`
    )
    .all(limit) as FileRow[];
}

/** Same eligibility rule as findHashCandidates, restricted to a specific set of ids (e.g. what's currently on screen). */
export function findHashCandidatesAmong(ids: number[]): FileRow[] {
  if (ids.length === 0) return [];
  return getDb()
    .prepare(
      `SELECT * FROM files
       WHERE missing = 0 AND hash_status = 'pending'
         AND size IN (SELECT size FROM files WHERE missing = 0 GROUP BY size HAVING COUNT(*) > 1)
         AND id IN (${ids.map(() => '?').join(',')})`
    )
    .all(...ids) as FileRow[];
}

export function setHashing(id: number): void {
  getDb()
    .prepare("UPDATE files SET hash_status = 'hashing', updated_at = ? WHERE id = ?")
    .run(Date.now(), id);
}

export function setHashResult(id: number, hash: string): void {
  getDb()
    .prepare("UPDATE files SET content_hash = ?, hash_status = 'done', updated_at = ? WHERE id = ?")
    .run(hash, Date.now(), id);
}

export function setHashError(id: number): void {
  getDb()
    .prepare("UPDATE files SET hash_status = 'error', updated_at = ? WHERE id = ?")
    .run(Date.now(), id);
}

/**
 * Files still needing a thumbnail. Deliberately independent of hash_status — files with a
 * unique size are never hashed (see findHashCandidates) but still deserve a preview. When a
 * file does have a content_hash, findExistingThumbnailPath lets duplicates share one render.
 */
export function findThumbnailCandidates(limit: number): FileRow[] {
  return getDb()
    .prepare(`SELECT * FROM files WHERE missing = 0 AND thumbnail_status = 'pending' LIMIT ?`)
    .all(limit) as FileRow[];
}

/** Same as findThumbnailCandidates, restricted to a specific set of ids (e.g. what's currently on screen). */
export function findThumbnailCandidatesAmong(ids: number[]): FileRow[] {
  if (ids.length === 0) return [];
  return getDb()
    .prepare(
      `SELECT * FROM files
       WHERE missing = 0 AND thumbnail_status = 'pending'
         AND id IN (${ids.map(() => '?').join(',')})`
    )
    .all(...ids) as FileRow[];
}

/** An already-rendered thumbnail path for this content hash, if some other file with the same bytes already has one. */
export function findExistingThumbnailPath(contentHash: string): string | undefined {
  const row = getDb()
    .prepare(
      `SELECT thumbnail_path FROM files
       WHERE content_hash = ? AND thumbnail_status = 'done' AND thumbnail_path IS NOT NULL
       LIMIT 1`
    )
    .get(contentHash) as { thumbnail_path: string } | undefined;
  return row?.thumbnail_path;
}

export function setThumbnailRendering(id: number): void {
  getDb()
    .prepare("UPDATE files SET thumbnail_status = 'rendering', updated_at = ? WHERE id = ?")
    .run(Date.now(), id);
}

export function setThumbnailResult(id: number, thumbnailPath: string): void {
  getDb()
    .prepare(
      "UPDATE files SET thumbnail_path = ?, thumbnail_status = 'done', updated_at = ? WHERE id = ?"
    )
    .run(thumbnailPath, Date.now(), id);
}

export function setThumbnailError(id: number): void {
  getDb()
    .prepare("UPDATE files SET thumbnail_status = 'error', updated_at = ? WHERE id = ?")
    .run(Date.now(), id);
}

export function setThumbnailUnsupported(id: number): void {
  getDb()
    .prepare("UPDATE files SET thumbnail_status = 'unsupported', updated_at = ? WHERE id = ?")
    .run(Date.now(), id);
}

/** Recovers files left mid-flight by an abrupt shutdown (crash, forced quit) — 'hashing'/'rendering' can only be a leftover, never a legitimately terminal state. */
export function resetStuckProcessingStatuses(): void {
  const db = getDb();
  db.prepare("UPDATE files SET hash_status = 'pending' WHERE hash_status = 'hashing'").run();
  db.prepare(
    "UPDATE files SET thumbnail_status = 'pending' WHERE thumbnail_status = 'rendering'"
  ).run();
}

export function listDuplicateFiles(): FileRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM files
       WHERE missing = 0 AND content_hash IN (
         SELECT content_hash FROM files
         WHERE missing = 0 AND content_hash IS NOT NULL
         GROUP BY content_hash HAVING COUNT(*) > 1
       )
       ORDER BY content_hash, filename COLLATE NOCASE`
    )
    .all() as FileRow[];
}
