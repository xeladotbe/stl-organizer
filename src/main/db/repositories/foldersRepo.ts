import { getDb } from '../index'
import type { WatchedFolderRow } from '../../../shared/types'

export function addFolder(path: string): WatchedFolderRow {
  const db = getDb()
  db.prepare(
    'INSERT OR IGNORE INTO watched_folders (path, added_at, enabled) VALUES (?, ?, 1)'
  ).run(path, Date.now())
  return db.prepare('SELECT * FROM watched_folders WHERE path = ?').get(path) as WatchedFolderRow
}

export function removeFolder(id: number): void {
  getDb().prepare('DELETE FROM watched_folders WHERE id = ?').run(id)
}

export function listFolders(): WatchedFolderRow[] {
  return getDb()
    .prepare('SELECT * FROM watched_folders ORDER BY added_at')
    .all() as WatchedFolderRow[]
}

export function getFolder(id: number): WatchedFolderRow | undefined {
  return getDb().prepare('SELECT * FROM watched_folders WHERE id = ?').get(id) as
    WatchedFolderRow | undefined
}
