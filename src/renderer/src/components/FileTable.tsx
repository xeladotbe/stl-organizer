import { useEffect, useMemo, useState } from 'react'
import { useLibraryStore } from '../store/useLibraryStore'
import { useVisibilityPriority } from '../hooks/useVisibilityPriority'
import { formatSize } from '../lib/format'
import { modelThumbnailUrl } from '@shared/modelFileUrl'
import type { FileRow } from '@shared/types'

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
  { key: 'tags', label: 'Tags', defaultWidth: 160 },
  { key: 'type', label: 'Type', sortKey: 'ext', defaultWidth: 80 },
  { key: 'size', label: 'Size', sortKey: 'size', defaultWidth: 100 },
  { key: 'modified', label: 'Modified', sortKey: 'mtime_ms', defaultWidth: 120 }
]

const MIN_COLUMN_WIDTH = 60
const WIDTHS_STORAGE_KEY = 'stl-organizer:columnWidths'

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

export function FileTable({ files }: { files: FileRow[] }): React.JSX.Element {
  const selectedFileId = useLibraryStore((state) => state.selectedFileId)
  const selectFile = useLibraryStore((state) => state.selectFile)
  const duplicateIds = useLibraryStore((state) => state.duplicateIds)
  const tags = useLibraryStore((state) => state.tags)
  const fileTagIds = useLibraryStore((state) => state.fileTagIds)
  const registerVisible = useVisibilityPriority()

  const [widths, setWidths] = useState<Record<string, number>>(loadStoredWidths)
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection } | null>(null)

  useEffect(() => {
    localStorage.setItem(WIDTHS_STORAGE_KEY, JSON.stringify(widths))
  }, [widths])

  const tagById = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags])

  const sortedFiles = useMemo(() => {
    if (!sort) return files
    const factor = sort.direction === 'asc' ? 1 : -1
    return [...files].sort((a, b) => {
      const av = a[sort.key]
      const bv = b[sort.key]
      if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * factor
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor
      return 0
    })
  }, [files, sort])

  const toggleSort = (key: SortKey): void => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, direction: 'asc' }
      return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
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

  return (
    <table className="w-full text-left text-sm" style={{ tableLayout: 'fixed' }}>
      <colgroup>
        {COLUMNS.map((column) => (
          <col key={column.key} style={{ width: widths[column.key] }} />
        ))}
      </colgroup>
      <thead className="sticky top-0 bg-neutral-950 text-xs uppercase text-neutral-500">
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
        {sortedFiles.map((file) => (
          <tr
            key={file.id}
            ref={registerVisible(file)}
            onClick={() => selectFile(file.id)}
            className={`cursor-pointer border-t border-neutral-900 hover:bg-neutral-900 ${
              selectedFileId === file.id ? 'bg-neutral-900' : ''
            }`}
          >
            <td className="overflow-hidden px-4 py-2 text-neutral-200">
              <div className="flex items-center gap-2">
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
                <span className="truncate">
                  {file.filename}
                  {duplicateIds.has(file.id) && (
                    <span className="ml-2 rounded bg-amber-900/60 px-1.5 py-0.5 text-[10px] font-medium uppercase text-amber-300">
                      Dup
                    </span>
                  )}
                </span>
              </div>
            </td>
            <td className="overflow-hidden px-4 py-2">
              <div className="flex flex-wrap gap-1">
                {(fileTagIds.get(file.id) ?? []).map((tagId) => (
                  <span
                    key={tagId}
                    className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400"
                  >
                    {tagById.get(tagId)?.name ?? tagId}
                  </span>
                ))}
              </div>
            </td>
            <td className="overflow-hidden px-4 py-2 uppercase text-neutral-500">{file.ext}</td>
            <td className="overflow-hidden px-4 py-2 text-neutral-400">{formatSize(file.size)}</td>
            <td className="overflow-hidden px-4 py-2 text-neutral-400">
              {new Date(file.mtime_ms).toLocaleDateString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
