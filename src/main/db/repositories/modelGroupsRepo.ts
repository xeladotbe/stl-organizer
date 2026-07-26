import { getDb } from '../index'
import type { ModelGroupRow } from '../../../shared/types'

export function listGroups(): ModelGroupRow[] {
  return getDb()
    .prepare('SELECT * FROM model_groups ORDER BY name COLLATE NOCASE')
    .all() as ModelGroupRow[]
}

export function getGroupById(id: number): ModelGroupRow | undefined {
  return getDb().prepare('SELECT * FROM model_groups WHERE id = ?').get(id) as
    ModelGroupRow | undefined
}

export function createGroup(name: string, fileIds: number[]): ModelGroupRow {
  const db = getDb()
  const now = Date.now()
  const create = db.transaction(() => {
    const info = db
      .prepare(
        'INSERT INTO model_groups (name, category_id, created_at, updated_at) VALUES (?, NULL, ?, ?)'
      )
      .run(name.trim(), now, now)
    const groupId = Number(info.lastInsertRowid)
    const setGroup = db.prepare('UPDATE files SET group_id = ?, updated_at = ? WHERE id = ?')
    for (const fileId of fileIds) setGroup.run(groupId, now, fileId)
    return groupId
  })
  const groupId = create()
  return getGroupById(groupId)!
}

export function renameGroup(id: number, name: string): void {
  getDb()
    .prepare('UPDATE model_groups SET name = ?, updated_at = ? WHERE id = ?')
    .run(name.trim(), Date.now(), id)
}

export function setGroupCategory(id: number, categoryId: number | null): void {
  getDb()
    .prepare('UPDATE model_groups SET category_id = ?, updated_at = ? WHERE id = ?')
    .run(categoryId, Date.now(), id)
}

export function addFilesToGroup(id: number, fileIds: number[]): void {
  const db = getDb()
  const now = Date.now()
  const setGroup = db.prepare('UPDATE files SET group_id = ?, updated_at = ? WHERE id = ?')
  const apply = db.transaction(() => {
    for (const fileId of fileIds) setGroup.run(id, now, fileId)
    db.prepare('UPDATE model_groups SET updated_at = ? WHERE id = ?').run(now, id)
  })
  apply()
}

interface GroupIdRow {
  group_id: number | null
}

/** Removes one file from its group. If that leaves the group with 0 or 1 members, the group is dissolved (the last member reverts to ungrouped) — a "group" of one file is meaningless. */
export function removeFileFromGroup(fileId: number): void {
  const db = getDb()
  const now = Date.now()
  const remove = db.transaction(() => {
    const row = db.prepare('SELECT group_id FROM files WHERE id = ?').get(fileId) as
      GroupIdRow | undefined
    const groupId = row?.group_id
    if (groupId == null) return

    db.prepare('UPDATE files SET group_id = NULL, updated_at = ? WHERE id = ?').run(now, fileId)

    const remaining = db.prepare('SELECT id FROM files WHERE group_id = ?').all(groupId) as {
      id: number
    }[]
    if (remaining.length <= 1) {
      for (const remainingFile of remaining) {
        db.prepare('UPDATE files SET group_id = NULL, updated_at = ? WHERE id = ?').run(
          now,
          remainingFile.id
        )
      }
      db.prepare('DELETE FROM model_groups WHERE id = ?').run(groupId)
    }
  })
  remove()
}

/** Dissolves a group entirely: every member reverts to ungrouped, the group row is deleted. */
export function deleteGroup(id: number): void {
  const db = getDb()
  const now = Date.now()
  const dissolve = db.transaction(() => {
    db.prepare('UPDATE files SET group_id = NULL, updated_at = ? WHERE group_id = ?').run(now, id)
    db.prepare('DELETE FROM model_groups WHERE id = ?').run(id)
  })
  dissolve()
}
