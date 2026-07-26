import { useEffect, useMemo, useState } from 'react'
import { useLibraryStore } from '../store/useLibraryStore'
import { FileTable } from './FileTable'
import { FileGrid } from './FileGrid'
import { toDisplayItems } from '../lib/groupFiles'

type DisplayMode = 'list' | 'grid'

const DISPLAY_MODE_STORAGE_KEY = 'stl-organizer:displayMode'

function loadStoredDisplayMode(): DisplayMode {
  const stored = localStorage.getItem(DISPLAY_MODE_STORAGE_KEY)
  return stored === 'grid' ? 'grid' : 'list'
}

/** Splits a search query into plain filename/group-name tokens, `tag:name` and `category:name` tokens. */
function parseSearchQuery(query: string): {
  textTokens: string[]
  tagTokens: string[]
  categoryTokens: string[]
} {
  const textTokens: string[] = []
  const tagTokens: string[] = []
  const categoryTokens: string[] = []
  for (const token of query.trim().split(/\s+/).filter(Boolean)) {
    const tagMatch = /^tag:(.+)$/i.exec(token)
    const categoryMatch = /^category:(.+)$/i.exec(token)
    if (tagMatch) tagTokens.push(tagMatch[1].toLowerCase())
    else if (categoryMatch) categoryTokens.push(categoryMatch[1].toLowerCase())
    else textTokens.push(token.toLowerCase())
  }
  return { textTokens, tagTokens, categoryTokens }
}

export function FileList(): React.JSX.Element {
  const files = useLibraryStore((state) => state.files)
  const filesLoading = useLibraryStore((state) => state.filesLoading)
  const tags = useLibraryStore((state) => state.tags)
  const fileTagIds = useLibraryStore((state) => state.fileTagIds)
  const categories = useLibraryStore((state) => state.categories)
  const groups = useLibraryStore((state) => state.groups)
  const selectedFileIds = useLibraryStore((state) => state.selectedFileIds)
  const toggleFileSelection = useLibraryStore((state) => state.toggleFileSelection)
  const clearFileSelection = useLibraryStore((state) => state.clearFileSelection)
  const groupingMode = useLibraryStore((state) => state.groupingMode)
  const toggleGroupingMode = useLibraryStore((state) => state.toggleGroupingMode)
  const createGroup = useLibraryStore((state) => state.createGroup)
  const [search, setSearch] = useState('')
  const [displayMode, setDisplayMode] = useState<DisplayMode>(loadStoredDisplayMode)
  const [groupName, setGroupName] = useState('')

  useEffect(() => {
    localStorage.setItem(DISPLAY_MODE_STORAGE_KEY, displayMode)
  }, [displayMode])

  const groupById = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups])
  const fileById = useMemo(() => new Map(files.map((file) => [file.id, file])), [files])

  const visibleFiles = useMemo(() => {
    const { textTokens, tagTokens, categoryTokens } = parseSearchQuery(search)
    if (textTokens.length === 0 && tagTokens.length === 0 && categoryTokens.length === 0) {
      return files
    }

    const tagIdSetsByToken = tagTokens.map(
      (token) =>
        new Set(tags.filter((tag) => tag.name.toLowerCase().includes(token)).map((tag) => tag.id))
    )
    const categoryIdSetsByToken = categoryTokens.map(
      (token) =>
        new Set(
          categories
            .filter((category) => category.name.toLowerCase().includes(token))
            .map((category) => category.id)
        )
    )

    return files.filter((file) => {
      const group = file.group_id != null ? groupById.get(file.group_id) : undefined

      if (textTokens.length > 0) {
        const filenameLower = file.filename.toLowerCase()
        const groupNameLower = group?.name.toLowerCase() ?? ''
        const matchesText = textTokens.every(
          (token) => filenameLower.includes(token) || groupNameLower.includes(token)
        )
        if (!matchesText) return false
      }

      if (categoryIdSetsByToken.length > 0) {
        const matchesCategory = categoryIdSetsByToken.every(
          (idSet) =>
            (file.category_id != null && idSet.has(file.category_id)) ||
            (group?.category_id != null && idSet.has(group.category_id))
        )
        if (!matchesCategory) return false
      }

      if (tagIdSetsByToken.length > 0) {
        const fileTags = fileTagIds.get(file.id) ?? []
        const matchesTags = tagIdSetsByToken.every((idSet) =>
          fileTags.some((tagId) => idSet.has(tagId))
        )
        if (!matchesTags) return false
      }

      return true
    })
  }, [files, search, tags, categories, fileTagIds, groupById])

  const displayItems = useMemo(() => toDisplayItems(visibleFiles, groups), [visibleFiles, groups])

  const handleGroup = (): void => {
    const name = groupName.trim() || 'New model'
    void createGroup(name, [...selectedFileIds])
    setGroupName('')
  }

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-neutral-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search files… (tag:name, category:name)"
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
          <button
            onClick={toggleGroupingMode}
            className={`shrink-0 rounded border px-2 py-1.5 text-xs ${
              groupingMode
                ? 'border-blue-800 bg-blue-900/70 text-blue-200'
                : 'border-neutral-700 text-neutral-500 hover:text-neutral-300'
            }`}
          >
            Select
          </button>
        </div>
        {groupingMode && (
          <div className="mt-2 rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-neutral-300">{selectedFileIds.size} selected</span>
              <input
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && handleGroup()}
                placeholder="Model name…"
                disabled={selectedFileIds.size < 2}
                className="max-w-xs flex-1 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={handleGroup}
                disabled={selectedFileIds.size < 2}
                className="shrink-0 rounded bg-blue-900/70 px-2 py-1 text-blue-200 hover:bg-blue-900 disabled:pointer-events-none disabled:opacity-50"
              >
                Group into model
              </button>
              {selectedFileIds.size > 0 && (
                <button
                  onClick={clearFileSelection}
                  className="shrink-0 rounded px-2 py-1 text-neutral-500 hover:text-neutral-300"
                >
                  Clear
                </button>
              )}
            </div>
            {selectedFileIds.size > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {[...selectedFileIds].map((id) => (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded bg-neutral-800 px-2 py-0.5 text-neutral-300"
                  >
                    <span className="max-w-40 truncate">{fileById.get(id)?.filename ?? id}</span>
                    <button
                      onClick={() => toggleFileSelection(id)}
                      aria-label="Deselect"
                      className="text-neutral-500 hover:text-neutral-200"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-hidden">
        {filesLoading && files.length === 0 ? (
          <div className="p-6 text-sm text-neutral-500">Loading…</div>
        ) : displayItems.length === 0 ? (
          <div className="p-6 text-sm text-neutral-500">
            {search.trim()
              ? 'No files match your search.'
              : 'No model files found yet. Add a watched folder to get started.'}
          </div>
        ) : displayMode === 'list' ? (
          <FileTable items={displayItems} />
        ) : (
          <FileGrid items={displayItems} />
        )}
      </div>
    </main>
  )
}
