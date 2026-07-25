import { useLibraryStore } from '../store/useLibraryStore'
import { TagCategorySidebar } from './TagCategorySidebar'

export function FolderSidebar(): React.JSX.Element {
  const folders = useLibraryStore((state) => state.folders)
  const scanProgress = useLibraryStore((state) => state.scanProgress)
  const addFolder = useLibraryStore((state) => state.addFolder)
  const removeFolder = useLibraryStore((state) => state.removeFolder)

  return (
    <aside className="flex w-64 shrink-0 flex-col overflow-y-auto border-r border-neutral-800 bg-neutral-900">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-semibold text-neutral-300">Watched folders</h2>
        <button
          onClick={() => void addFolder()}
          className="rounded bg-neutral-800 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-700"
        >
          + Add
        </button>
      </div>
      <ul className="px-2">
        {folders.length === 0 && (
          <li className="px-2 py-4 text-xs text-neutral-500">
            No folders yet. Add a folder to start indexing your STL/3MF files.
          </li>
        )}
        {folders.map((folder) => {
          const progress = scanProgress[folder.id]
          return (
            <li
              key={folder.id}
              title={folder.path}
              className="group flex items-center justify-between gap-2 rounded px-2 py-2 text-xs text-neutral-300 hover:bg-neutral-800"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate">{folder.path}</div>
                {progress && progress.phase === 'scanning' && (
                  <div className="text-[10px] text-amber-400">
                    Scanning… {progress.current} found
                  </div>
                )}
              </div>
              <button
                onClick={() => void removeFolder(folder.id)}
                aria-label="Remove folder"
                className="shrink-0 rounded px-1.5 py-0.5 text-neutral-500 opacity-0 hover:bg-neutral-700 hover:text-neutral-200 group-hover:opacity-100"
              >
                ✕
              </button>
            </li>
          )
        })}
      </ul>
      <TagCategorySidebar />
    </aside>
  )
}
