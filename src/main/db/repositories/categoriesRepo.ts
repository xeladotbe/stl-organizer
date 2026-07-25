import { getDb } from '../index'
import type { CategoryRow } from '../../../shared/types'

export function listCategories(): CategoryRow[] {
  return getDb()
    .prepare('SELECT * FROM categories ORDER BY name COLLATE NOCASE')
    .all() as CategoryRow[]
}

/** Idempotent by name — re-"creating" an existing category just returns it, so callers don't need to check first. */
export function createCategory(name: string, color: string | null): CategoryRow {
  const db = getDb()
  const trimmed = name.trim()
  const existing = db.prepare('SELECT * FROM categories WHERE name = ?').get(trimmed) as
    CategoryRow | undefined
  if (existing) return existing
  const info = db.prepare('INSERT INTO categories (name, color) VALUES (?, ?)').run(trimmed, color)
  return db
    .prepare('SELECT * FROM categories WHERE id = ?')
    .get(info.lastInsertRowid) as CategoryRow
}

export function renameCategory(id: number, name: string): void {
  getDb().prepare('UPDATE categories SET name = ? WHERE id = ?').run(name.trim(), id)
}

export function deleteCategory(id: number): void {
  getDb().prepare('DELETE FROM categories WHERE id = ?').run(id)
}
