import { useMemo } from 'react'
import { useLibraryStore } from '../store/useLibraryStore'
import { formatSize } from '../lib/format'
import type { FileRow } from '@shared/types'

export function DuplicatesView(): React.JSX.Element {
  const duplicates = useLibraryStore((state) => state.duplicates)
  const duplicatesLoading = useLibraryStore((state) => state.duplicatesLoading)
  const moveToTrash = useLibraryStore((state) => state.moveToTrash)
  const selectFile = useLibraryStore((state) => state.selectFile)

  const groups = useMemo(() => {
    const map = new Map<string, FileRow[]>()
    for (const file of duplicates) {
      if (!file.content_hash) continue
      const list = map.get(file.content_hash) ?? []
      list.push(file)
      map.set(file.content_hash, list)
    }
    return [...map.values()]
  }, [duplicates])

  const handleTrash = (file: FileRow): void => {
    if (!confirm(`Move "${file.filename}" to the Recycle Bin?\n${file.path}`)) return
    void moveToTrash(file.id)
  }

  const handleKeepFirst = async (group: FileRow[]): Promise<void> => {
    const [, ...rest] = group
    if (rest.length === 0) return
    if (
      !confirm(
        `Move ${rest.length} duplicate(s) to the Recycle Bin, keeping "${group[0].filename}"?`
      )
    ) {
      return
    }
    for (const file of rest) {
      await moveToTrash(file.id)
    }
  }

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-neutral-800 px-4 py-3 text-sm text-neutral-400">
        {duplicatesLoading && duplicates.length === 0
          ? 'Scanning for duplicates…'
          : groups.length === 0
            ? 'No exact duplicates found yet.'
            : `${groups.length} duplicate group${groups.length === 1 ? '' : 's'}`}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {groups.map((group) => (
          <div
            key={group[0].content_hash}
            className="mb-4 rounded border border-neutral-800 bg-neutral-900"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
              <div className="text-xs text-neutral-400">
                {group.length} copies · {formatSize(group[0].size)} each
              </div>
              <button
                onClick={() => void handleKeepFirst(group)}
                className="rounded bg-neutral-800 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-700"
              >
                Keep first, trash rest
              </button>
            </div>
            <ul>
              {group.map((file) => (
                <li
                  key={file.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <div
                    onClick={() => selectFile(file.id)}
                    className="min-w-0 flex-1 cursor-pointer"
                  >
                    <div className="truncate text-neutral-200">{file.filename}</div>
                    <div className="truncate text-xs text-neutral-500" title={file.path}>
                      {file.path}
                    </div>
                  </div>
                  <button
                    onClick={() => handleTrash(file)}
                    className="shrink-0 rounded px-2 py-1 text-xs text-red-400 hover:bg-red-950"
                  >
                    Trash
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </main>
  )
}
