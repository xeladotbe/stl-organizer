import { useMemo, useRef, useEffect, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useLibraryStore } from '../store/useLibraryStore'
import { useVisibilityPriority } from '../hooks/useVisibilityPriority'
import { formatSize } from '../lib/format'
import { modelThumbnailUrl } from '@shared/modelFileUrl'
import { ItemMenu, type MenuItem } from './ItemMenu'
import { GroupNameDialog } from './GroupNameDialog'
import { ConfirmDialog } from './ConfirmDialog'
import type { FileRow, ModelGroupRow } from '@shared/types'
import type { DisplayItem } from '../lib/groupFiles'

type MenuTarget = { type: 'file'; file: FileRow } | { type: 'group'; group: ModelGroupRow }
type TrashTarget = { type: 'file'; file: FileRow } | { type: 'selected'; ids: number[] }

interface MenuAnchor {
  target: MenuTarget
  anchorEl: HTMLElement
  offsetX: number
  offsetY: number
}

type SortKey = 'filename' | 'ext' | 'size' | 'mtime_ms'
type SortDirection = 'asc' | 'desc'

interface ColumnDef {
  key: string
  label: string
  sortKey?: SortKey
  defaultWidth: number
}

const COLUMNS: ColumnDef[] = [
  { key: 'name', label: 'Name', sortKey: 'filename', defaultWidth: 300 },
  { key: 'labels', label: 'Labels', defaultWidth: 200 },
  { key: 'type', label: 'Type', sortKey: 'ext', defaultWidth: 80 },
  { key: 'size', label: 'Size', sortKey: 'size', defaultWidth: 100 },
  { key: 'modified', label: 'Modified', sortKey: 'mtime_ms', defaultWidth: 120 }
]

const MIN_COLUMN_WIDTH = 60
const WIDTHS_STORAGE_KEY = 'stl-organizer:columnWidths'
const ROW_HEIGHT = 48

function loadStoredWidths(): Record<string, number> {
  const defaults = Object.fromEntries(COLUMNS.map((c) => [c.key, c.defaultWidth]))
  try {
    const raw = localStorage.getItem(WIDTHS_STORAGE_KEY)
    if (raw) return { ...defaults, ...(JSON.parse(raw) as Record<string, number>) }
  } catch {
    // ignore malformed storage, fall back to defaults
  }
  return defaults
}

function sortValue(item: DisplayItem, key: SortKey): string | number {
  if (item.type === 'file') return item.file[key]
  switch (key) {
    case 'filename':
      return item.group.name
    case 'ext':
      return ''
    case 'size':
      return item.members.reduce((sum, file) => sum + file.size, 0)
    case 'mtime_ms':
      return Math.max(...item.members.map((file) => file.mtime_ms))
  }
}

// Every real row (a lone file, an expanded group's member, or a group header) is the same
// height, so a flat, fixed-size list is all the virtualizer needs — expand/collapse just
// changes which rows are in this array, which the virtualizer picks up via `count`.
type VirtualRow =
  | { type: 'file'; file: FileRow; indent?: boolean }
  | { type: 'group'; group: ModelGroupRow; members: FileRow[] }

function buildVirtualRows(items: DisplayItem[], expandedGroups: Set<number>): VirtualRow[] {
  const rows: VirtualRow[] = []
  for (const item of items) {
    if (item.type === 'file') {
      rows.push({ type: 'file', file: item.file })
      continue
    }
    rows.push({ type: 'group', group: item.group, members: item.members })
    if (expandedGroups.has(item.group.id)) {
      for (const file of item.members) rows.push({ type: 'file', file, indent: true })
    }
  }
  return rows
}

function LabelBadges({
  categoryName,
  tagNames,
  isDuplicate
}: {
  categoryName?: string
  tagNames: string[]
  isDuplicate: boolean
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap gap-1">
      {categoryName && (
        <span className="rounded bg-green-900/60 px-1.5 py-0.5 text-[10px] text-green-300">
          {categoryName}
        </span>
      )}
      {tagNames.map((name, index) => (
        <span
          key={index}
          className="rounded bg-orange-900/60 px-1.5 py-0.5 text-[10px] text-orange-300"
        >
          {name}
        </span>
      ))}
      {isDuplicate && (
        <span className="rounded bg-red-900/60 px-1.5 py-0.5 text-[10px] font-medium uppercase text-red-300">
          Duplicate
        </span>
      )}
    </div>
  )
}

interface FileRowViewProps {
  file: FileRow
  indent?: boolean
  isSelected: boolean
  isMultiSelected: boolean
  categoryName?: string
  tagNames: string[]
  isDuplicate: boolean
  onSelect: (event: React.MouseEvent) => void
  onContextMenu: (event: React.MouseEvent) => void
  registerVisible: (file: FileRow) => (el: Element | null) => (() => void) | void
}

function FileRowView({
  file,
  indent,
  isSelected,
  isMultiSelected,
  categoryName,
  tagNames,
  isDuplicate,
  onSelect,
  onContextMenu,
  registerVisible
}: FileRowViewProps): React.JSX.Element {
  return (
    <tr
      ref={registerVisible(file)}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      className={`cursor-pointer border-t border-neutral-900 hover:bg-neutral-900 ${
        isMultiSelected ? 'bg-blue-950/50' : isSelected ? 'bg-neutral-900' : ''
      }`}
    >
      <td className="overflow-hidden px-4 py-2 text-neutral-200">
        <div className={`flex items-center gap-2 ${indent ? 'pl-6' : ''}`}>
          {file.thumbnail_status === 'done' ? (
            <img
              src={modelThumbnailUrl(file.id)}
              alt=""
              className="h-8 w-8 shrink-0 rounded bg-neutral-800 object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-neutral-800 text-[9px] text-neutral-600">
              {file.ext.toUpperCase()}
            </div>
          )}
          <span className="truncate">{file.filename}</span>
        </div>
      </td>
      <td className="overflow-hidden px-4 py-2">
        <LabelBadges categoryName={categoryName} tagNames={tagNames} isDuplicate={isDuplicate} />
      </td>
      <td className="overflow-hidden px-4 py-2 uppercase text-neutral-500">{file.ext}</td>
      <td className="overflow-hidden px-4 py-2 text-neutral-400">{formatSize(file.size)}</td>
      <td className="overflow-hidden px-4 py-2 text-neutral-400">
        {new Date(file.mtime_ms).toLocaleDateString()}
      </td>
    </tr>
  )
}

export function FileTable({ items }: { items: DisplayItem[] }): React.JSX.Element {
  const selection = useLibraryStore((state) => state.selection)
  const selectFile = useLibraryStore((state) => state.selectFile)
  const selectGroup = useLibraryStore((state) => state.selectGroup)
  const toggleFileSelection = useLibraryStore((state) => state.toggleFileSelection)
  const selectFileRange = useLibraryStore((state) => state.selectFileRange)
  const clearFileSelection = useLibraryStore((state) => state.clearFileSelection)
  const duplicateIds = useLibraryStore((state) => state.duplicateIds)
  const tags = useLibraryStore((state) => state.tags)
  const categories = useLibraryStore((state) => state.categories)
  const fileTagIds = useLibraryStore((state) => state.fileTagIds)
  const selectedFileIds = useLibraryStore((state) => state.selectedFileIds)
  const moveToTrash = useLibraryStore((state) => state.moveToTrash)
  const deleteGroup = useLibraryStore((state) => state.deleteGroup)
  const createGroup = useLibraryStore((state) => state.createGroup)
  const registerVisible = useVisibilityPriority()

  const scrollRef = useRef<HTMLDivElement>(null)
  const theadRef = useRef<HTMLTableSectionElement>(null)
  const [widths, setWidths] = useState<Record<string, number>>(loadStoredWidths)
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection } | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set())
  const [menu, setMenu] = useState<MenuAnchor | null>(null)
  const [groupDialogFor, setGroupDialogFor] = useState<number[] | null>(null)
  const [trashTarget, setTrashTarget] = useState<TrashTarget | null>(null)

  useEffect(() => {
    localStorage.setItem(WIDTHS_STORAGE_KEY, JSON.stringify(widths))
  }, [widths])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') clearFileSelection()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [clearFileSelection])

  const tagById = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags])
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  )

  const sortedItems = useMemo(() => {
    if (!sort) return items
    const factor = sort.direction === 'asc' ? 1 : -1
    return [...items].sort((a, b) => {
      const av = sortValue(a, sort.key)
      const bv = sortValue(b, sort.key)
      if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * factor
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor
      return 0
    })
  }, [items, sort])

  const virtualRows = useMemo(
    () => buildVirtualRows(sortedItems, expandedGroups),
    [sortedItems, expandedGroups]
  )

  const orderedFileIds = useMemo(
    () => virtualRows.filter((row) => row.type === 'file').map((row) => row.file.id),
    [virtualRows]
  )

  const rowVirtualizer = useVirtualizer({
    count: virtualRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12
  })
  const virtualItems = rowVirtualizer.getVirtualItems()
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0
  const paddingBottom =
    virtualItems.length > 0
      ? rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
      : 0

  const toggleSort = (key: SortKey): void => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, direction: 'asc' }
      return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
    })
  }

  const toggleExpanded = (groupId: number): void => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const startResize =
    (key: string) =>
    (event: React.MouseEvent): void => {
      event.preventDefault()
      const startX = event.clientX
      const startWidth = widths[key] ?? 120

      const handleMouseMove = (moveEvent: MouseEvent): void => {
        const delta = moveEvent.clientX - startX
        setWidths((prev) => ({ ...prev, [key]: Math.max(MIN_COLUMN_WIDTH, startWidth + delta) }))
      }
      const handleMouseUp = (): void => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

  const fileTagLabels = (fileId: number): string[] =>
    (fileTagIds.get(fileId) ?? []).map((tagId) => tagById.get(tagId)?.name ?? String(tagId))

  const handleFileClick = (event: React.MouseEvent, id: number): void => {
    if (event.shiftKey) selectFileRange(orderedFileIds, id)
    else if (event.ctrlKey || event.metaKey) toggleFileSelection(id)
    else selectFile(id)
  }

  const handleTrash = (file: FileRow): void => setTrashTarget({ type: 'file', file })
  const handleTrashSelected = (ids: number[]): void => setTrashTarget({ type: 'selected', ids })

  const openMenuAt = (event: React.MouseEvent, target: MenuTarget): void => {
    const anchorEl = event.currentTarget as HTMLElement
    const rect = anchorEl.getBoundingClientRect()
    setMenu({
      target,
      anchorEl,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top
    })
  }

  const openFileMenu = (event: React.MouseEvent, file: FileRow): void => {
    if (!selectedFileIds.has(file.id)) {
      // Right-clicking outside the current selection collapses it to just this file, matching
      // standard file-explorer behavior.
      selectFile(file.id)
    }
    openMenuAt(event, { type: 'file', file })
  }

  const menuItems: MenuItem[] = (() => {
    if (!menu) return []
    const target = menu.target
    if (target.type === 'group') {
      return [{ label: 'Ungroup', onClick: () => void deleteGroup(target.group.id) }]
    }
    const ids = selectedFileIds.has(target.file.id) ? [...selectedFileIds] : [target.file.id]
    if (ids.length > 1) {
      return [
        { label: 'Group…', onClick: () => setGroupDialogFor(ids) },
        { label: `Delete (${ids.length})`, danger: true, onClick: () => handleTrashSelected(ids) }
      ]
    }
    return [{ label: 'Delete', danger: true, onClick: () => handleTrash(target.file) }]
  })()

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto">
      {menu && (
        <ItemMenu
          anchorEl={menu.anchorEl}
          offsetX={menu.offsetX}
          offsetY={menu.offsetY}
          topPadding={theadRef.current?.offsetHeight ?? 0}
          items={menuItems}
          onClose={() => setMenu(null)}
        />
      )}
      {groupDialogFor && (
        <GroupNameDialog
          count={groupDialogFor.length}
          onCancel={() => setGroupDialogFor(null)}
          onConfirm={(name) => {
            void createGroup(name, groupDialogFor)
            setGroupDialogFor(null)
          }}
        />
      )}
      {trashTarget && (
        <ConfirmDialog
          title={
            trashTarget.type === 'file'
              ? `Move "${trashTarget.file.filename}" to the Recycle Bin?`
              : `Move ${trashTarget.ids.length} files to the Recycle Bin?`
          }
          description={trashTarget.type === 'file' ? trashTarget.file.path : undefined}
          confirmLabel="Move to Recycle Bin"
          danger
          onCancel={() => setTrashTarget(null)}
          onConfirm={() => {
            if (trashTarget.type === 'file') {
              void moveToTrash(trashTarget.file.id)
            } else {
              for (const id of trashTarget.ids) void moveToTrash(id)
              clearFileSelection()
            }
            setTrashTarget(null)
          }}
        />
      )}
      <table className="w-full text-left text-sm" style={{ tableLayout: 'fixed' }}>
        <colgroup>
          {COLUMNS.map((column) => (
            <col key={column.key} style={{ width: widths[column.key] }} />
          ))}
        </colgroup>
        <thead
          ref={theadRef}
          className="sticky top-0 z-10 bg-neutral-950 text-xs uppercase text-neutral-500"
        >
          <tr>
            {COLUMNS.map((column) => (
              <th key={column.key} className="relative select-none px-4 py-2 font-medium">
                {column.sortKey ? (
                  <button
                    onClick={() => toggleSort(column.sortKey!)}
                    className="flex items-center gap-1 hover:text-neutral-300"
                  >
                    {column.label}
                    {sort?.key === column.sortKey && (
                      <span>{sort.direction === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </button>
                ) : (
                  column.label
                )}
                <div
                  onMouseDown={startResize(column.key)}
                  className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-neutral-700"
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paddingTop > 0 && (
            <tr style={{ height: paddingTop }} aria-hidden="true">
              <td colSpan={COLUMNS.length} />
            </tr>
          )}
          {virtualItems.map((virtualItem) => {
            const row = virtualRows[virtualItem.index]

            if (row.type === 'file') {
              return (
                <FileRowView
                  key={virtualItem.key}
                  file={row.file}
                  indent={row.indent}
                  isSelected={selection?.type === 'file' && selection.id === row.file.id}
                  isMultiSelected={selectedFileIds.has(row.file.id)}
                  categoryName={
                    row.file.category_id != null
                      ? categoryById.get(row.file.category_id)?.name
                      : undefined
                  }
                  tagNames={fileTagLabels(row.file.id)}
                  isDuplicate={duplicateIds.has(row.file.id)}
                  onSelect={(event) => handleFileClick(event, row.file.id)}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    openFileMenu(event, row.file)
                  }}
                  registerVisible={registerVisible}
                />
              )
            }

            const { group, members } = row
            const isExpanded = expandedGroups.has(group.id)
            const isSelected = selection?.type === 'group' && selection.id === group.id
            const thumbFile = members.find((m) => m.thumbnail_status === 'done')
            const totalSize = members.reduce((sum, file) => sum + file.size, 0)
            const groupTagNames = [...new Set(members.flatMap((file) => fileTagLabels(file.id)))]
            const groupCategoryName =
              group.category_id != null ? categoryById.get(group.category_id)?.name : undefined
            const groupHasDuplicate = members.some((file) => duplicateIds.has(file.id))

            return (
              <tr
                key={virtualItem.key}
                onClick={() => selectGroup(group.id)}
                onContextMenu={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  openMenuAt(event, { type: 'group', group })
                }}
                className={`cursor-pointer border-t border-neutral-900 hover:bg-neutral-900 ${
                  isSelected ? 'bg-neutral-900' : ''
                }`}
              >
                <td className="overflow-hidden px-4 py-2 text-neutral-200">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(event) => {
                        event.stopPropagation()
                        toggleExpanded(group.id)
                      }}
                      className="w-3.5 shrink-0 text-neutral-500 hover:text-neutral-200"
                      aria-label={isExpanded ? 'Collapse group' : 'Expand group'}
                    >
                      {isExpanded ? '▾' : '▸'}
                    </button>
                    <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded bg-neutral-800">
                      {thumbFile ? (
                        <img
                          src={modelThumbnailUrl(thumbFile.id)}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[9px] text-neutral-600">
                          {members.length}
                        </div>
                      )}
                      <span className="absolute bottom-0 right-0 rounded-tl bg-neutral-950/90 px-1 text-[9px] text-neutral-300">
                        ×{members.length}
                      </span>
                    </div>
                    <span className="truncate font-medium">{group.name}</span>
                  </div>
                </td>
                <td className="overflow-hidden px-4 py-2">
                  <LabelBadges
                    categoryName={groupCategoryName}
                    tagNames={groupTagNames}
                    isDuplicate={groupHasDuplicate}
                  />
                </td>
                <td className="overflow-hidden px-4 py-2 uppercase text-neutral-500">model</td>
                <td className="overflow-hidden px-4 py-2 text-neutral-400">
                  {formatSize(totalSize)}
                </td>
                <td className="overflow-hidden px-4 py-2 text-neutral-400">
                  {new Date(Math.max(...members.map((m) => m.mtime_ms))).toLocaleDateString()}
                </td>
              </tr>
            )
          })}
          {paddingBottom > 0 && (
            <tr style={{ height: paddingBottom }} aria-hidden="true">
              <td colSpan={COLUMNS.length} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
