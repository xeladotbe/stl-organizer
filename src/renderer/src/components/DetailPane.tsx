import { useLibraryStore } from '../store/useLibraryStore'
import { ModelPreview } from './ModelPreview'
import { formatSize } from '../lib/format'

export function DetailPane(): React.JSX.Element | null {
  const file = useLibraryStore((state) => {
    if (state.selectedFileId == null) return null
    return (
      state.files.find((f) => f.id === state.selectedFileId) ??
      state.duplicates.find((f) => f.id === state.selectedFileId) ??
      null
    )
  })
  const selectFile = useLibraryStore((state) => state.selectFile)
  const tags = useLibraryStore((state) => state.tags)
  const categories = useLibraryStore((state) => state.categories)
  const fileTagIds = useLibraryStore((state) => state.fileTagIds)
  const setFileTags = useLibraryStore((state) => state.setFileTags)
  const setFileCategory = useLibraryStore((state) => state.setFileCategory)

  if (!file) return null

  const assignedTagIds = fileTagIds.get(file.id) ?? []

  const toggleTag = (tagId: number): void => {
    const next = assignedTagIds.includes(tagId)
      ? assignedTagIds.filter((id) => id !== tagId)
      : [...assignedTagIds, tagId]
    void setFileTags(file.id, next)
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-neutral-800 bg-neutral-900 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase text-neutral-500">Preview</span>
        <button
          onClick={() => selectFile(null)}
          aria-label="Close preview"
          className="rounded px-1.5 py-0.5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
        >
          ✕
        </button>
      </div>
      <ModelPreview file={file} />
      <div className="mt-3 space-y-1 text-sm">
        <div className="truncate font-medium text-neutral-100" title={file.filename}>
          {file.filename}
        </div>
        <div className="text-xs text-neutral-500">
          {formatSize(file.size)} · {file.ext.toUpperCase()}
        </div>
        <div className="truncate text-xs text-neutral-500" title={file.path}>
          {file.path}
        </div>
      </div>

      <div className="mt-4">
        <label className="mb-1 block text-xs font-semibold uppercase text-neutral-500">
          Category
        </label>
        <select
          value={file.category_id ?? ''}
          onChange={(event) =>
            void setFileCategory(
              file.id,
              event.target.value === '' ? null : Number(event.target.value)
            )
          }
          className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
        >
          <option value="">No category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4">
        <label className="mb-1 block text-xs font-semibold uppercase text-neutral-500">Tags</label>
        <div className="flex flex-wrap gap-1">
          {tags.length === 0 && (
            <span className="text-xs text-neutral-500">No tags yet — add one in the sidebar.</span>
          )}
          {tags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => toggleTag(tag.id)}
              className={`rounded px-2 py-0.5 text-xs ${
                assignedTagIds.includes(tag.id)
                  ? 'bg-blue-900/70 text-blue-200'
                  : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {tag.name}
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}
