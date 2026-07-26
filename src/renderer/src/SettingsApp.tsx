import { useEffect, useState } from 'react'
import type { WatchedFolderRow } from '@shared/types'

export function SettingsApp(): React.JSX.Element {
  const [folders, setFolders] = useState<WatchedFolderRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    void window.api.folders.list().then((result) => {
      if (cancelled) return
      setFolders(result)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const reload = async (): Promise<void> => {
    setFolders(await window.api.folders.list())
    setLoading(false)
  }

  const handleAdd = async (): Promise<void> => {
    const folder = await window.api.folders.add()
    if (folder) await reload()
  }

  const handleRemove = async (id: number): Promise<void> => {
    await window.api.folders.remove(id)
    await reload()
  }

  return (
    <div className="flex h-full flex-col bg-neutral-950 text-neutral-100">
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-neutral-300">Watched folders</h1>
        <button
          onClick={() => void handleAdd()}
          className="rounded bg-neutral-800 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-700"
        >
          + Add
        </button>
      </div>
      <ul className="flex-1 overflow-y-auto px-2 py-2">
        {loading ? (
          <li className="px-2 py-4 text-xs text-neutral-500">Loading…</li>
        ) : folders.length === 0 ? (
          <li className="px-2 py-4 text-xs text-neutral-500">
            No folders yet. Add a folder to start indexing your STL/3MF files.
          </li>
        ) : (
          folders.map((folder) => (
            <li
              key={folder.id}
              title={folder.path}
              className="group flex items-center justify-between gap-2 rounded px-2 py-2 text-sm text-neutral-300 hover:bg-neutral-900"
            >
              <span className="min-w-0 flex-1 truncate">{folder.path}</span>
              <button
                onClick={() => void handleRemove(folder.id)}
                aria-label="Remove folder"
                className="shrink-0 rounded px-1.5 py-0.5 text-neutral-500 opacity-0 hover:bg-neutral-800 hover:text-neutral-200 group-hover:opacity-100"
              >
                ✕
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
