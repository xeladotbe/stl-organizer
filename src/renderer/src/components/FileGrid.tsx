import { useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useLibraryStore, type Selection } from '../store/useLibraryStore'
import { useVisibilityPriority } from '../hooks/useVisibilityPriority'
import { modelThumbnailUrl } from '@shared/modelFileUrl'
import type { FileRow, ModelGroupRow } from '@shared/types'
import type { DisplayItem } from '../lib/groupFiles'

const CARD_MIN_WIDTH = 140
const GAP = 12
const ESTIMATED_ROW_HEIGHT = 190
// Expanded group members sit inside `border-l-2 pl-3` (2px border + 12px padding) — their row
// has that much less width to lay cards out in than a top-level row.
const GROUP_INDENT = 14

interface RowLayout {
  columns: number
  cardWidth: number
}

/** Same math as CSS `repeat(auto-fill, minmax(CARD_MIN_WIDTH, 1fr))` would produce, computed in
 * JS so every row (including the narrower, indented group-member rows) gets a card width derived
 * from its own actual available width, rather than each row's `<div>` resolving `1fr` independently
 * and risking a mismatch between rows with different available widths. */
function computeLayout(availableWidth: number): RowLayout {
  const columns = Math.max(1, Math.floor((availableWidth + GAP) / (CARD_MIN_WIDTH + GAP)))
  const cardWidth = (availableWidth - (columns - 1) * GAP) / columns
  return { columns, cardWidth }
}

interface FileCardProps {
  file: FileRow
  width: number
  isSelected: boolean
  isChecked: boolean
  showCheckbox: boolean
  isDuplicate: boolean
  onSelect: () => void
  onToggleCheck: () => void
  registerVisible: (file: FileRow) => (el: Element | null) => (() => void) | void
}

function FileCard({
  file,
  width,
  isSelected,
  isChecked,
  showCheckbox,
  isDuplicate,
  onSelect,
  onToggleCheck,
  registerVisible
}: FileCardProps): React.JSX.Element {
  return (
    <button
      ref={registerVisible(file)}
      onClick={onSelect}
      style={{ width }}
      className={`relative flex shrink-0 flex-col items-center gap-2 rounded border p-2 text-left ${
        isSelected ? 'border-neutral-500 bg-neutral-900' : 'border-neutral-800 hover:bg-neutral-900'
      }`}
    >
      {showCheckbox && (
        <input
          type="checkbox"
          checked={isChecked}
          onChange={onToggleCheck}
          onClick={(event) => event.stopPropagation()}
          className="absolute left-2 top-2 z-10"
        />
      )}
      <div className="relative flex h-28 w-full items-center justify-center overflow-hidden rounded bg-neutral-800">
        {file.thumbnail_status === 'done' ? (
          <img src={modelThumbnailUrl(file.id)} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs text-neutral-600">{file.ext.toUpperCase()}</span>
        )}
        {isDuplicate && (
          <span className="absolute right-1 top-1 rounded bg-amber-900/80 px-1.5 py-0.5 text-[9px] font-medium uppercase text-amber-200">
            Dup
          </span>
        )}
      </div>
      <span className="line-clamp-2 w-full break-words text-center text-xs text-neutral-300">
        {file.filename}
      </span>
    </button>
  )
}

// Consecutive lone files are chunked into rows of `columns` cards each; a group always starts
// its own row (collapsed header, or header + its member cards when expanded) so its variable
// height never has to share a virtual row with unrelated file cards.
type GridRow =
  { type: 'files'; files: FileRow[] } | { type: 'group'; group: ModelGroupRow; members: FileRow[] }

function buildGridRows(items: DisplayItem[], columns: number): GridRow[] {
  const rows: GridRow[] = []
  let buffer: FileRow[] = []
  const flush = (): void => {
    if (buffer.length > 0) {
      rows.push({ type: 'files', files: buffer })
      buffer = []
    }
  }
  for (const item of items) {
    if (item.type === 'group') {
      flush()
      rows.push({ type: 'group', group: item.group, members: item.members })
      continue
    }
    buffer.push(item.file)
    if (buffer.length === columns) flush()
  }
  flush()
  return rows
}

export function FileGrid({ items }: { items: DisplayItem[] }): React.JSX.Element {
  const selection = useLibraryStore((state) => state.selection)
  const selectFile = useLibraryStore((state) => state.selectFile)
  const selectGroup = useLibraryStore((state) => state.selectGroup)
  const duplicateIds = useLibraryStore((state) => state.duplicateIds)
  const selectedFileIds = useLibraryStore((state) => state.selectedFileIds)
  const toggleFileSelection = useLibraryStore((state) => state.toggleFileSelection)
  const groupingMode = useLibraryStore((state) => state.groupingMode)
  const registerVisible = useVisibilityPriority()
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set())

  const scrollRef = useRef<HTMLDivElement>(null)
  const [contentWidth, setContentWidth] = useState(0)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      setContentWidth(entries[0].contentRect.width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const layout = computeLayout(contentWidth)
  const memberLayout = computeLayout(Math.max(0, contentWidth - GROUP_INDENT))

  const toggleExpanded = (groupId: number): void => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const gridRows = useMemo(() => buildGridRows(items, layout.columns), [items, layout.columns])

  const rowVirtualizer = useVirtualizer({
    count: gridRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 4
  })

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto p-4">
      <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const row = gridRows[virtualRow.index]
          return (
            <div
              key={virtualRow.key}
              ref={rowVirtualizer.measureElement}
              data-index={virtualRow.index}
              className="pb-3"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`
              }}
            >
              {row.type === 'files' ? (
                <div className="flex flex-wrap" style={{ gap: GAP }}>
                  {row.files.map((file) => (
                    <FileCard
                      key={file.id}
                      file={file}
                      width={layout.cardWidth}
                      isSelected={selection?.type === 'file' && selection.id === file.id}
                      isChecked={selectedFileIds.has(file.id)}
                      showCheckbox={groupingMode}
                      isDuplicate={duplicateIds.has(file.id)}
                      onSelect={() => selectFile(file.id)}
                      onToggleCheck={() => toggleFileSelection(file.id)}
                      registerVisible={registerVisible}
                    />
                  ))}
                </div>
              ) : (
                <GroupRow
                  group={row.group}
                  members={row.members}
                  isExpanded={expandedGroups.has(row.group.id)}
                  isSelected={selection?.type === 'group' && selection.id === row.group.id}
                  memberCardWidth={memberLayout.cardWidth}
                  onToggleExpanded={() => toggleExpanded(row.group.id)}
                  onSelectGroup={() => selectGroup(row.group.id)}
                  selection={selection}
                  selectedFileIds={selectedFileIds}
                  showCheckbox={groupingMode}
                  duplicateIds={duplicateIds}
                  onSelectFile={selectFile}
                  onToggleFileCheck={toggleFileSelection}
                  registerVisible={registerVisible}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface GroupRowProps {
  group: ModelGroupRow
  members: FileRow[]
  isExpanded: boolean
  isSelected: boolean
  memberCardWidth: number
  onToggleExpanded: () => void
  onSelectGroup: () => void
  selection: Selection
  selectedFileIds: Set<number>
  showCheckbox: boolean
  duplicateIds: Set<number>
  onSelectFile: (id: number) => void
  onToggleFileCheck: (id: number) => void
  registerVisible: (file: FileRow) => (el: Element | null) => (() => void) | void
}

function GroupRow({
  group,
  members,
  isExpanded,
  isSelected,
  memberCardWidth,
  onToggleExpanded,
  onSelectGroup,
  selection,
  selectedFileIds,
  showCheckbox,
  duplicateIds,
  onSelectFile,
  onToggleFileCheck,
  registerVisible
}: GroupRowProps): React.JSX.Element {
  const thumbFile = members.find((m) => m.thumbnail_status === 'done')

  return (
    <div>
      <div
        className={`flex items-center gap-2 rounded border p-2 ${
          isSelected ? 'border-neutral-500 bg-neutral-900' : 'border-neutral-800'
        }`}
      >
        <button
          onClick={onToggleExpanded}
          className="shrink-0 px-1 text-neutral-500 hover:text-neutral-200"
          aria-label={isExpanded ? 'Collapse group' : 'Expand group'}
        >
          {isExpanded ? '▾' : '▸'}
        </button>
        <button onClick={onSelectGroup} className="flex flex-1 items-center gap-2 text-left">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-neutral-800">
            {thumbFile ? (
              <img
                src={modelThumbnailUrl(thumbFile.id)}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] text-neutral-600">
                {members.length}
              </div>
            )}
          </div>
          <span className="truncate text-sm font-medium text-neutral-200">{group.name}</span>
          <span className="shrink-0 text-xs text-neutral-500">×{members.length}</span>
        </button>
      </div>
      {isExpanded && (
        <div
          className="mt-2 flex flex-wrap border-l-2 border-neutral-800 pl-3"
          style={{ gap: GAP }}
        >
          {members.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              width={memberCardWidth}
              isSelected={selection?.type === 'file' && selection.id === file.id}
              isChecked={selectedFileIds.has(file.id)}
              showCheckbox={showCheckbox}
              isDuplicate={duplicateIds.has(file.id)}
              onSelect={() => onSelectFile(file.id)}
              onToggleCheck={() => onToggleFileCheck(file.id)}
              registerVisible={registerVisible}
            />
          ))}
        </div>
      )}
    </div>
  )
}
