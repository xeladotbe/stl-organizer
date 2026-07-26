import { useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useLibraryStore } from '../store/useLibraryStore'
import { useVisibilityPriority } from '../hooks/useVisibilityPriority'
import { modelThumbnailUrl } from '@shared/modelFileUrl'
import { ItemMenu, type MenuItem } from './ItemMenu'
import { GroupNameDialog } from './GroupNameDialog'
import { ConfirmDialog } from './ConfirmDialog'
import type { FileRow, ModelGroupRow } from '@shared/types'
import type { DisplayItem } from '../lib/groupFiles'

const CARD_MIN_WIDTH = 140
const GAP = 12
const ESTIMATED_ROW_HEIGHT = 190
const GROUP_TILE_MAX_THUMBS = 4

interface RowLayout {
  columns: number
  cardWidth: number
}

/** Same math as CSS `repeat(auto-fill, minmax(CARD_MIN_WIDTH, 1fr))` would produce, computed in
 * JS so files and group tiles (both rendered at this one uniform width) always match exactly,
 * rather than each row's `<div>` resolving `1fr` independently. */
function computeLayout(availableWidth: number): RowLayout {
  const columns = Math.max(1, Math.floor((availableWidth + GAP) / (CARD_MIN_WIDTH + GAP)))
  const cardWidth = (availableWidth - (columns - 1) * GAP) / columns
  return { columns, cardWidth }
}

function chunkIntoRows(items: DisplayItem[], columns: number): DisplayItem[][] {
  const rows: DisplayItem[][] = []
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns))
  }
  return rows
}

interface MenuButtonProps {
  onOpen: (event: React.MouseEvent) => void
}

function MenuButton({ onOpen }: MenuButtonProps): React.JSX.Element {
  return (
    <button
      onClick={(event) => {
        event.stopPropagation()
        onOpen(event)
      }}
      aria-label="More actions"
      className="absolute right-1 top-1 z-10 rounded bg-neutral-950/70 px-1.5 py-0.5 text-xs text-neutral-300 hover:bg-neutral-800"
    >
      ⋮
    </button>
  )
}

interface FileCardProps {
  file: FileRow
  width: number
  isSelected: boolean
  isMultiSelected: boolean
  isDuplicate: boolean
  onSelect: (event: React.MouseEvent) => void
  onContextMenu: (event: React.MouseEvent) => void
  onOpenMenu: (event: React.MouseEvent) => void
  registerVisible: (file: FileRow) => (el: Element | null) => (() => void) | void
}

function FileCard({
  file,
  width,
  isSelected,
  isMultiSelected,
  isDuplicate,
  onSelect,
  onContextMenu,
  onOpenMenu,
  registerVisible
}: FileCardProps): React.JSX.Element {
  return (
    <button
      ref={registerVisible(file)}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      style={{ width }}
      className={`relative flex shrink-0 flex-col items-center gap-2 rounded border p-2 text-left ${
        isMultiSelected
          ? 'border-blue-700 bg-blue-950/40'
          : isSelected
            ? 'border-neutral-500 bg-neutral-900'
            : 'border-neutral-800 hover:bg-neutral-900'
      }`}
    >
      <MenuButton onOpen={onOpenMenu} />
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
      <span className="line-clamp-2 w-full wrap-break-word text-center text-xs text-neutral-300">
        {file.filename}
      </span>
    </button>
  )
}

interface GroupTileProps {
  group: ModelGroupRow
  members: FileRow[]
  width: number
  isSelected: boolean
  onSelect: () => void
  onOpenMenu: (event: React.MouseEvent) => void
}

function GroupTile({
  group,
  members,
  width,
  isSelected,
  onSelect,
  onOpenMenu
}: GroupTileProps): React.JSX.Element {
  const overflow = members.length > GROUP_TILE_MAX_THUMBS
  const shown = overflow
    ? members.slice(0, GROUP_TILE_MAX_THUMBS - 1)
    : members.slice(0, GROUP_TILE_MAX_THUMBS)
  const remaining = overflow ? members.length - shown.length : 0

  return (
    <button
      onClick={onSelect}
      onContextMenu={(event) => {
        event.preventDefault()
        onOpenMenu(event)
      }}
      style={{ width }}
      className={`relative flex shrink-0 flex-col items-center gap-2 rounded border p-2 text-left ${
        isSelected ? 'border-neutral-500 bg-neutral-900' : 'border-neutral-800 hover:bg-neutral-900'
      }`}
    >
      <span className="absolute left-2 top-2 z-10 rounded bg-neutral-950/80 px-1 text-[9px] text-neutral-300">
        ×{members.length}
      </span>
      <MenuButton onOpen={onOpenMenu} />
      <div className="grid h-28 w-full grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded bg-neutral-800">
        {shown.map((file) => (
          <div
            key={file.id}
            className="flex items-center justify-center overflow-hidden bg-neutral-900"
          >
            {file.thumbnail_status === 'done' ? (
              <img src={modelThumbnailUrl(file.id)} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-[8px] text-neutral-600">{file.ext.toUpperCase()}</span>
            )}
          </div>
        ))}
        {remaining > 0 && (
          <div className="flex items-center justify-center bg-neutral-900 text-xs font-medium text-neutral-300">
            +{remaining}
          </div>
        )}
      </div>
      <span className="line-clamp-2 w-full wrap-break-word text-center text-xs text-neutral-300">
        {group.name}
      </span>
    </button>
  )
}

type MenuTarget = { type: 'file'; file: FileRow } | { type: 'group'; group: ModelGroupRow }
type TrashTarget = { type: 'file'; file: FileRow } | { type: 'selected'; ids: number[] }

interface MenuAnchor {
  target: MenuTarget
  anchorEl: HTMLElement
  offsetX: number
  offsetY: number
}

export function FileGrid({ items }: { items: DisplayItem[] }): React.JSX.Element {
  const selection = useLibraryStore((state) => state.selection)
  const selectFile = useLibraryStore((state) => state.selectFile)
  const selectGroup = useLibraryStore((state) => state.selectGroup)
  const toggleFileSelection = useLibraryStore((state) => state.toggleFileSelection)
  const selectFileRange = useLibraryStore((state) => state.selectFileRange)
  const clearFileSelection = useLibraryStore((state) => state.clearFileSelection)
  const duplicateIds = useLibraryStore((state) => state.duplicateIds)
  const selectedFileIds = useLibraryStore((state) => state.selectedFileIds)
  const moveToTrash = useLibraryStore((state) => state.moveToTrash)
  const deleteGroup = useLibraryStore((state) => state.deleteGroup)
  const createGroup = useLibraryStore((state) => state.createGroup)
  const registerVisible = useVisibilityPriority()
  const [menu, setMenu] = useState<MenuAnchor | null>(null)
  const [groupDialogFor, setGroupDialogFor] = useState<number[] | null>(null)
  const [trashTarget, setTrashTarget] = useState<TrashTarget | null>(null)

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

  useEffect(() => {
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') clearFileSelection()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [clearFileSelection])

  const layout = computeLayout(contentWidth)
  const gridRows = useMemo(() => chunkIntoRows(items, layout.columns), [items, layout.columns])
  const orderedFileIds = useMemo(
    () => items.filter((item) => item.type === 'file').map((item) => item.file.id),
    [items]
  )

  const rowVirtualizer = useVirtualizer({
    count: gridRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 4
  })

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
      // Opening the menu (right-click or the ⋮ button) outside the current selection collapses
      // it to just this file, matching standard file-explorer behavior.
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
    <div ref={scrollRef} className="h-full overflow-y-auto p-4">
      {menu && (
        <ItemMenu
          anchorEl={menu.anchorEl}
          offsetX={menu.offsetX}
          offsetY={menu.offsetY}
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
      <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const row = gridRows[virtualRow.index]
          return (
            <div
              key={virtualRow.key}
              ref={rowVirtualizer.measureElement}
              data-index={virtualRow.index}
              className="flex pb-3"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                gap: GAP,
                transform: `translateY(${virtualRow.start}px)`
              }}
            >
              {row.map((item) =>
                item.type === 'file' ? (
                  <FileCard
                    key={item.file.id}
                    file={item.file}
                    width={layout.cardWidth}
                    isSelected={selection?.type === 'file' && selection.id === item.file.id}
                    isMultiSelected={selectedFileIds.has(item.file.id)}
                    isDuplicate={duplicateIds.has(item.file.id)}
                    onSelect={(event) => handleFileClick(event, item.file.id)}
                    onContextMenu={(event) => {
                      event.preventDefault()
                      openFileMenu(event, item.file)
                    }}
                    onOpenMenu={(event) => openFileMenu(event, item.file)}
                    registerVisible={registerVisible}
                  />
                ) : (
                  <GroupTile
                    key={`group-${item.group.id}`}
                    group={item.group}
                    members={item.members}
                    width={layout.cardWidth}
                    isSelected={selection?.type === 'group' && selection.id === item.group.id}
                    onSelect={() => selectGroup(item.group.id)}
                    onOpenMenu={(event) => openMenuAt(event, { type: 'group', group: item.group })}
                  />
                )
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
