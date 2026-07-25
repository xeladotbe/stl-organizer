import { getDb } from '../index'
import type { TagRow, FileTagLink } from '../../../shared/types'

export function listTags(): TagRow[] {
  return getDb().prepare('SELECT * FROM tags ORDER BY name COLLATE NOCASE').all() as TagRow[]
}

/** Idempotent by name — re-"creating" an existing tag just returns it, so callers don't need to check first. */
export function createTag(name: string, color: string | null): TagRow {
  const db = getDb()
  const trimmed = name.trim()
  const existing = db.prepare('SELECT * FROM tags WHERE name = ?').get(trimmed) as
    TagRow | undefined
  if (existing) return existing
  const info = db.prepare('INSERT INTO tags (name, color) VALUES (?, ?)').run(trimmed, color)
  return db.prepare('SELECT * FROM tags WHERE id = ?').get(info.lastInsertRowid) as TagRow
}

export function renameTag(id: number, name: string): void {
  getDb().prepare('UPDATE tags SET name = ? WHERE id = ?').run(name.trim(), id)
}

export function setTagColor(id: number, color: string | null): void {
  getDb().prepare('UPDATE tags SET color = ? WHERE id = ?').run(color, id)
}

export function deleteTag(id: number): void {
  getDb().prepare('DELETE FROM tags WHERE id = ?').run(id)
}

export function listFileTagLinks(): FileTagLink[] {
  return getDb().prepare('SELECT file_id, tag_id FROM file_tags').all() as FileTagLink[]
}
