import type { FileRow, ModelGroupRow } from '@shared/types'

export type DisplayItem =
  { type: 'file'; file: FileRow } | { type: 'group'; group: ModelGroupRow; members: FileRow[] }

/**
 * Bundles an already search/filtered flat file list into display items: lone files pass through,
 * files sharing a group_id collapse into one group entry. Grouping happens after filtering so
 * search/tag/sort logic in FileList never needs to know groups exist.
 */
export function toDisplayItems(files: FileRow[], groups: ModelGroupRow[]): DisplayItem[] {
  const groupById = new Map(groups.map((group) => [group.id, group]))
  const membersByGroup = new Map<number, FileRow[]>()
  const items: DisplayItem[] = []

  for (const file of files) {
    if (file.group_id == null || !groupById.has(file.group_id)) {
      items.push({ type: 'file', file })
      continue
    }
    const list = membersByGroup.get(file.group_id) ?? []
    list.push(file)
    membersByGroup.set(file.group_id, list)
  }

  for (const [groupId, members] of membersByGroup) {
    const group = groupById.get(groupId)
    if (!group) continue
    items.push({ type: 'group', group, members })
  }

  return items
}
