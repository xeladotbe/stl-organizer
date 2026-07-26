import { describe, expect, it } from 'vitest'
import { itemKeyOf, findAnchorRowIndex } from './gridScrollAnchor'
import type { FileRow, ModelGroupRow } from '@shared/types'
import type { DisplayItem } from './groupFiles'

function makeFile(id: number): FileRow {
  return {
    id,
    folder_id: 1,
    path: `C:/models/file-${id}.stl`,
    filename: `file-${id}.stl`,
    ext: 'stl',
    size: 1024,
    mtime_ms: 0,
    content_hash: null,
    hash_status: 'pending',
    thumbnail_path: null,
    thumbnail_status: 'pending',
    category_id: null,
    group_id: null,
    missing: 0,
    created_at: 0,
    updated_at: 0
  }
}

function makeGroup(id: number): ModelGroupRow {
  return { id, name: `Group ${id}`, category_id: null, created_at: 0, updated_at: 0 }
}

const fileItem = (id: number): DisplayItem => ({ type: 'file', file: makeFile(id) })
const groupItem = (id: number): DisplayItem => ({
  type: 'group',
  group: makeGroup(id),
  members: [makeFile(id * 100), makeFile(id * 100 + 1)]
})

describe('itemKeyOf', () => {
  it('distinguishes files and groups even if their ids collide', () => {
    expect(itemKeyOf(fileItem(1))).toBe('file-1')
    expect(itemKeyOf(groupItem(1))).toBe('group-1')
    expect(itemKeyOf(fileItem(1))).not.toBe(itemKeyOf(groupItem(1)))
  })
})

describe('findAnchorRowIndex', () => {
  it('returns -1 when there is no anchor to restore', () => {
    const rows = [[fileItem(1)], [fileItem(2)]]
    expect(findAnchorRowIndex(rows, null)).toBe(-1)
  })

  it('finds the row a tile moved to after the grid re-chunked into fewer columns', () => {
    // Before: 3 per row. After a resize, chunked down to 1 per row - file 5 moves from row 1
    // to row 4.
    const rows = [[fileItem(5)], [fileItem(2)], [fileItem(3)], [fileItem(1)], [fileItem(4)]]
    expect(findAnchorRowIndex(rows, 'file-5')).toBe(0)
  })

  it('matches a group tile by its group id, not a file id that happens to match', () => {
    const rows = [[fileItem(1)], [groupItem(1)]]
    expect(findAnchorRowIndex(rows, 'group-1')).toBe(1)
  })

  it('returns -1 when the anchor tile is no longer present', () => {
    const rows = [[fileItem(1)], [fileItem(2)]]
    expect(findAnchorRowIndex(rows, 'file-999')).toBe(-1)
  })
})
