import { useEffect, useMemo, useState } from 'react'
import { ToggleGroup } from 'radix-ui'
import { useLibraryStore } from '../store/useLibraryStore'
import { FileTable } from './FileTable'
import { FileGrid } from './FileGrid'
import { toDisplayItems } from '../lib/groupFiles'
import { parseSearchQuery, createTextMatcher } from '../lib/searchQuery'

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
  const fileTagIds = useLibraryStore((state) => state.fileTagIds)
  const categories = useLibraryStore((state) => state.categories)
  const groups = useLibraryStore((state) => state.groups)
  const [search, setSearch] = useState('')
  const [displayMode, setDisplayMode] = useState<DisplayMode>(loadStoredDisplayMode)

  useEffect(() => {
    localStorage.setItem(DISPLAY_MODE_STORAGE_KEY, displayMode)
  }, [displayMode])

  const groupById = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups])

  const visibleFiles = useMemo(() => {
    const { textTokens, tagTokens, categoryTokens, typeTokens } = parseSearchQuery(search)
    if (
      textTokens.length === 0 &&
      tagTokens.length === 0 &&
      categoryTokens.length === 0 &&
      typeTokens.length === 0
    ) {
      return files
    }

    const textMatchersByToken = textTokens.map((token) => createTextMatcher(token))
    const tagIdSetsByToken = tagTokens.map((token) => {
      const matches = createTextMatcher(token)
      return new Set(tags.filter((tag) => matches(tag.name.toLowerCase())).map((tag) => tag.id))
    })
    const categoryIdSetsByToken = categoryTokens.map((token) => {
      const matches = createTextMatcher(token)
      return new Set(
        categories.filter((category) => matches(category.name.toLowerCase())).map((category) => category.id)
      )
    })
    const typeMatchersByToken = typeTokens.map((token) => createTextMatcher(token))

    return files.filter((file) => {
      const group = file.group_id != null ? groupById.get(file.group_id) : undefined

      if (textMatchersByToken.length > 0) {
        const filenameLower = file.filename.toLowerCase()
        const groupNameLower = group?.name.toLowerCase() ?? ''
        const matchesText = textMatchersByToken.every(
          (matches) => matches(filenameLower) || matches(groupNameLower)
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

      if (typeMatchersByToken.length > 0) {
        const effectiveType = group != null ? 'virtual' : file.ext.toLowerCase()
        const matchesType = typeMatchersByToken.every((matches) => matches(effectiveType))
        if (!matchesType) return false
      }

      return true
    })
  }, [files, search, tags, categories, fileTagIds, groupById])

  const displayItems = useMemo(() => toDisplayItems(visibleFiles, groups), [visibleFiles, groups])

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-neutral-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="relative w-full max-w-sm">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search files…"
              className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 pr-7 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
            />
            {search.length > 0 && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear search"
                className="absolute inset-y-0 right-0 flex items-center px-2 text-neutral-500 hover:text-neutral-300"
              >
                ✕
              </button>
            )}
          </div>
          <ToggleGroup.Root
            type="single"
            value={displayMode}
            onValueChange={(next) => next && setDisplayMode(next as DisplayMode)}
            className="flex shrink-0 rounded border border-neutral-700 text-xs"
          >
            <ToggleGroup.Item
              value="list"
              className="px-2 py-1.5 text-neutral-500 hover:text-neutral-300 data-[state=on]:bg-neutral-800 data-[state=on]:text-neutral-100"
            >
              List
            </ToggleGroup.Item>
            <ToggleGroup.Item
              value="grid"
              className="border-l border-neutral-700 px-2 py-1.5 text-neutral-500 hover:text-neutral-300 data-[state=on]:bg-neutral-800 data-[state=on]:text-neutral-100"
            >
              Grid
            </ToggleGroup.Item>
          </ToggleGroup.Root>
        </div>
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
