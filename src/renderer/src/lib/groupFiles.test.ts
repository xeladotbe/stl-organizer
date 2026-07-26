import { describe, expect, it } from 'vitest'
import { toDisplayItems } from './groupFiles'
import type { FileRow, ModelGroupRow } from '@shared/types'

function makeFile(overrides: Partial<FileRow> & { id: number }): FileRow {
  return {
    folder_id: 1,
    path: `C:/models/file-${overrides.id}.stl`,
    filename: `file-${overrides.id}.stl`,
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
    updated_at: 0,
    ...overrides
  }
}

function makeGroup(overrides: Partial<ModelGroupRow> & { id: number }): ModelGroupRow {
  return {
    name: `Group ${overrides.id}`,
    category_id: null,
    created_at: 0,
    updated_at: 0,
    ...overrides
  }
}

describe('toDisplayItems', () => {
  it('passes ungrouped files through as lone file items', () => {
    const files = [makeFile({ id: 1 }), makeFile({ id: 2 })]

    const items = toDisplayItems(files, [])

    expect(items).toEqual([
      { type: 'file', file: files[0] },
      { type: 'file', file: files[1] }
    ])
  })

  it('collapses files sharing a group_id into one group item', () => {
    const group = makeGroup({ id: 10, name: 'Vase' })
    const a = makeFile({ id: 1, group_id: 10 })
    const b = makeFile({ id: 2, group_id: 10 })
    const lone = makeFile({ id: 3 })

    const items = toDisplayItems([a, b, lone], [group])

    expect(items).toContainEqual({ type: 'file', file: lone })
    const groupItem = items.find((item) => item.type === 'group')
    expect(groupItem).toEqual({ type: 'group', group, members: [a, b] })
  })

  it('treats a file pointing at a non-existent group as an ungrouped file', () => {
    const orphan = makeFile({ id: 1, group_id: 999 })

    const items = toDisplayItems([orphan], [])

    expect(items).toEqual([{ type: 'file', file: orphan }])
  })

  it('places a group at the position of its first member instead of trailing at the end', () => {
    const group = makeGroup({ id: 10, name: 'Vase' })
    const lone1 = makeFile({ id: 1 })
    const memberA = makeFile({ id: 2, group_id: 10 })
    const lone2 = makeFile({ id: 3 })
    const memberB = makeFile({ id: 4, group_id: 10 })
    const lone3 = makeFile({ id: 5 })

    const items = toDisplayItems([lone1, memberA, lone2, memberB, lone3], [group])

    expect(items).toEqual([
      { type: 'file', file: lone1 },
      { type: 'group', group, members: [memberA, memberB] },
      { type: 'file', file: lone2 },
      { type: 'file', file: lone3 }
    ])
  })
})
