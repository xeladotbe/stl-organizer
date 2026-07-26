import type { FileRow, ModelGroupRow } from '@shared/types'

export type DisplayItem =
  { type: 'file'; file: FileRow } | { type: 'group'; group: ModelGroupRow; members: FileRow[] }

/**
 * Bundles an already search/filtered flat file list into display items: lone files pass through,
 * files sharing a group_id collapse into one group entry. Grouping happens after filtering so
 * search/tag/sort logic in FileList never needs to know groups exist.
 *
 * A group's entry is emitted at the position of its first member in `files`, rather than all
 * groups being collected and appended at the end - so a group takes part in whatever order
 * `files` is already in (e.g. sorted by name) instead of always trailing behind every lone file.
 */
export function toDisplayItems(files: FileRow[], groups: ModelGroupRow[]): DisplayItem[] {
  const groupById = new Map(groups.map((group) => [group.id, group]))
  const membersByGroup = new Map<number, FileRow[]>()

  for (const file of files) {
    if (file.group_id == null || !groupById.has(file.group_id)) continue
    const list = membersByGroup.get(file.group_id) ?? []
    list.push(file)
    membersByGroup.set(file.group_id, list)
  }

  const items: DisplayItem[] = []
  const emittedGroups = new Set<number>()

  for (const file of files) {
    if (file.group_id == null || !groupById.has(file.group_id)) {
      items.push({ type: 'file', file })
      continue
    }
    if (emittedGroups.has(file.group_id)) continue
    emittedGroups.add(file.group_id)
    items.push({
      type: 'group',
      group: groupById.get(file.group_id)!,
      members: membersByGroup.get(file.group_id)!
    })
  }

  return items
}
