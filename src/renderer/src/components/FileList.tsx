import { useEffect, useMemo, useState } from 'react'
import { useLibraryStore } from '../store/useLibraryStore'
import { FileTable } from './FileTable'
import { FileGrid } from './FileGrid'

type DisplayMode = 'list' | 'grid'

const DISPLAY_MODE_STORAGE_KEY = 'stl-organizer:displayMode'

function loadStoredDisplayMode(): DisplayMode {
  const stored = localStorage.getItem(DISPLAY_MODE_STORAGE_KEY)
  return stored === 'grid' ? 'grid' : 'list'
}

export function FileList(): React.JSX.Element {
  const files = useLibraryStore((state) => state.files)
  const filesLoading = useLibraryStore((state) => state.filesLoading)
  const tags = useLibraryStore((state) => state.tags)
  const categories = useLibraryStore((state) => state.categories)
  const activeTagIds = useLibraryStore((state) => state.activeTagIds)
  const activeCategoryId = useLibraryStore((state) => state.activeCategoryId)
  const toggleTagFilter = useLibraryStore((state) => state.toggleTagFilter)
  const setCategoryFilter = useLibraryStore((state) => state.setCategoryFilter)
  const [search, setSearch] = useState('')
  const [displayMode, setDisplayMode] = useState<DisplayMode>(loadStoredDisplayMode)

  useEffect(() => {
    localStorage.setItem(DISPLAY_MODE_STORAGE_KEY, displayMode)
  }, [displayMode])

  const tagById = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags])
  const activeCategory = categories.find((category) => category.id === activeCategoryId)

  const visibleFiles = useMemo(() => {
    if (!search.trim()) return files
    const needle = search.toLowerCase()
    return files.filter((file) => file.filename.toLowerCase().includes(needle))
  }, [files, search])

  const hasActiveFilters = activeTagIds.length > 0 || activeCategoryId !== undefined

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-neutral-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search files…"
            className="w-full max-w-sm rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
          />
          <div className="flex shrink-0 rounded border border-neutral-700 text-xs">
            <button
              onClick={() => setDisplayMode('list')}
              className={`px-2 py-1.5 ${
                displayMode === 'list'
                  ? 'bg-neutral-800 text-neutral-100'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              List
            </button>
            <button
              onClick={() => setDisplayMode('grid')}
              className={`border-l border-neutral-700 px-2 py-1.5 ${
                displayMode === 'grid'
                  ? 'bg-neutral-800 text-neutral-100'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              Grid
            </button>
          </div>
        </div>
        {hasActiveFilters && (
          <div className="mt-2 flex flex-wrap items-center gap-1 text-xs">
            <span className="text-neutral-500">Filters:</span>
            {activeCategory && (
              <button
                onClick={() => setCategoryFilter(undefined)}
                className="rounded bg-neutral-800 px-2 py-0.5 text-neutral-200 hover:bg-neutral-700"
              >
                {activeCategory.name} ✕
              </button>
            )}
            {activeTagIds.map((tagId) => (
              <button
                key={tagId}
                onClick={() => toggleTagFilter(tagId)}
                className="rounded bg-blue-900/70 px-2 py-0.5 text-blue-200 hover:bg-blue-900"
              >
                {tagById.get(tagId)?.name ?? tagId} ✕
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {filesLoading && files.length === 0 ? (
          <div className="p-6 text-sm text-neutral-500">Loading…</div>
        ) : visibleFiles.length === 0 ? (
          <div className="p-6 text-sm text-neutral-500">
            {hasActiveFilters
              ? 'No files match the current filters.'
              : 'No model files found yet. Add a watched folder to get started.'}
          </div>
        ) : displayMode === 'list' ? (
          <FileTable files={visibleFiles} />
        ) : (
          <FileGrid files={visibleFiles} />
        )}
      </div>
    </main>
  )
}
