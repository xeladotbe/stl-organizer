import { describe, expect, it } from 'vitest'
import { findDuplicateSiblings } from './duplicates'
import type { FileRow } from '@shared/types'

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

describe('findDuplicateSiblings', () => {
  it('returns other files sharing the same content_hash', () => {
    const a = makeFile({ id: 1, content_hash: 'abc' })
    const b = makeFile({ id: 2, content_hash: 'abc' })
    const c = makeFile({ id: 3, content_hash: 'abc' })
    const unrelated = makeFile({ id: 4, content_hash: 'zzz' })

    const siblings = findDuplicateSiblings([a, b, c, unrelated], a)

    expect(siblings).toEqual([b, c])
  })

  it('excludes the file itself even when passed the full library list', () => {
    const a = makeFile({ id: 1, content_hash: 'abc' })
    const b = makeFile({ id: 2, content_hash: 'abc' })

    const siblings = findDuplicateSiblings([a, b], a)

    expect(siblings.map((f) => f.id)).toEqual([2])
  })

  it('returns an empty list for a file with no content_hash yet', () => {
    // Uniquely-sized files never get hashed (see hashQueue.ts) - content_hash stays null forever
    // for them, so they can never be flagged as duplicates of anything.
    const a = makeFile({ id: 1, content_hash: null })
    const b = makeFile({ id: 2, content_hash: null })

    const siblings = findDuplicateSiblings([a, b], a)

    expect(siblings).toEqual([])
  })

  it('does not match two different files that both happen to have a null hash', () => {
    const a = makeFile({ id: 1, content_hash: null })
    const b = makeFile({ id: 2, content_hash: null })
    const c = makeFile({ id: 3, content_hash: 'abc' })

    const siblings = findDuplicateSiblings([a, b, c], c)

    expect(siblings).toEqual([])
  })

  it('returns an empty list when the file is the sole owner of its hash', () => {
    const a = makeFile({ id: 1, content_hash: 'abc' })
    const other = makeFile({ id: 2, content_hash: 'def' })

    const siblings = findDuplicateSiblings([a, other], a)

    expect(siblings).toEqual([])
  })
})
