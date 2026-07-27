import { describe, expect, it } from 'vitest'
import { pickFileToKeep } from './pickFileToKeep'
import type { FileRow } from '@shared/types'

function makeFile(overrides: Partial<FileRow> & { id: number; filename: string }): FileRow {
  return {
    folder_id: 1,
    path: `C:/models/${overrides.filename}`,
    ext: 'stl',
    size: 1024,
    mtime_ms: 0,
    content_hash: 'abc',
    hash_status: 'done',
    thumbnail_path: null,
    thumbnail_status: 'done',
    category_id: null,
    group_id: null,
    missing: 0,
    created_at: 0,
    updated_at: 0,
    ...overrides
  }
}

describe('pickFileToKeep', () => {
  it('prefers the file without a copy suffix even when it sorts after suffixed copies', () => {
    // Alphabetically "model (1).stl" sorts before "model.stl" - the bug this issue is about.
    const suffixed1 = makeFile({ id: 1, filename: 'model (1).stl' })
    const suffixed2 = makeFile({ id: 2, filename: 'model (2).stl' })
    const original = makeFile({ id: 3, filename: 'model.stl' })

    expect(pickFileToKeep([suffixed1, suffixed2, original])).toBe(original)
  })

  it('keeps the first file in order when none of them have a copy suffix', () => {
    const first = makeFile({ id: 1, filename: 'alpha.stl' })
    const second = makeFile({ id: 2, filename: 'beta.stl' })

    expect(pickFileToKeep([first, second])).toBe(first)
  })

  it('falls back to the first file in order when every copy is suffixed', () => {
    const suffixed1 = makeFile({ id: 1, filename: 'model (1).stl' })
    const suffixed2 = makeFile({ id: 2, filename: 'model (2).stl' })

    expect(pickFileToKeep([suffixed1, suffixed2])).toBe(suffixed1)
  })

  it('returns the sole file for a single-file "group"', () => {
    const file = makeFile({ id: 1, filename: 'model.stl' })

    expect(pickFileToKeep([file])).toBe(file)
  })

  it('does not treat parenthesized text that is not a numeric suffix as a copy suffix', () => {
    const blue = makeFile({ id: 1, filename: 'widget (blue).stl' })
    const suffixed = makeFile({ id: 2, filename: 'widget (1).stl' })

    // "widget (blue)" has no digits inside the parens, so it isn't a copy suffix and should win.
    expect(pickFileToKeep([suffixed, blue])).toBe(blue)
  })

  it('does not treat a mid-name parenthesized number as a copy suffix', () => {
    // The "(2)" here isn't a trailing copy-suffix - it's followed by more text before the extension.
    const midName = makeFile({ id: 1, filename: 'v2 (2) final.stl' })
    const suffixed = makeFile({ id: 2, filename: 'v2 (1).stl' })

    expect(pickFileToKeep([suffixed, midName])).toBe(midName)
  })

  it('throws for an empty file list', () => {
    expect(() => pickFileToKeep([])).toThrow()
  })
})
