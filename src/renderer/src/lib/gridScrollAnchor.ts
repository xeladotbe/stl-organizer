import type { DisplayItem } from './groupFiles'

/** Stable identity for a grid tile, independent of which row/column it currently lays out in. */
export function itemKeyOf(item: DisplayItem): string {
  return item.type === 'file' ? `file-${item.file.id}` : `group-${item.group.id}`
}

/**
 * Finds which row a previously-remembered anchor tile ended up in after the grid re-chunked
 * (e.g. the column count changed because the detail pane opened/closed). Returns -1 if the
 * anchor is gone (item deleted, filtered out, etc.) or there's no anchor to restore.
 */
export function findAnchorRowIndex(rows: DisplayItem[][], anchorKey: string | null): number {
  if (!anchorKey) return -1
  return rows.findIndex((row) => row.some((item) => itemKeyOf(item) === anchorKey))
}
