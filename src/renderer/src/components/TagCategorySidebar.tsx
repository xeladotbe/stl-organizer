import { useState, type FormEvent } from 'react'
import { useLibraryStore } from '../store/useLibraryStore'

export function TagCategorySidebar(): React.JSX.Element {
  const tags = useLibraryStore((state) => state.tags)
  const categories = useLibraryStore((state) => state.categories)
  const activeTagIds = useLibraryStore((state) => state.activeTagIds)
  const activeCategoryId = useLibraryStore((state) => state.activeCategoryId)
  const toggleTagFilter = useLibraryStore((state) => state.toggleTagFilter)
  const setCategoryFilter = useLibraryStore((state) => state.setCategoryFilter)
  const createTag = useLibraryStore((state) => state.createTag)
  const deleteTag = useLibraryStore((state) => state.deleteTag)
  const createCategory = useLibraryStore((state) => state.createCategory)
  const deleteCategory = useLibraryStore((state) => state.deleteCategory)

  const [newTag, setNewTag] = useState('')
  const [newCategory, setNewCategory] = useState('')

  const submitTag = (event: FormEvent): void => {
    event.preventDefault()
    if (!newTag.trim()) return
    void createTag(newTag)
    setNewTag('')
  }

  const submitCategory = (event: FormEvent): void => {
    event.preventDefault()
    if (!newCategory.trim()) return
    void createCategory(newCategory)
    setNewCategory('')
  }

  return (
    <div className="mt-2 border-t border-neutral-800 px-2 py-3">
      <div className="mb-1 px-2 text-xs font-semibold uppercase text-neutral-500">Categories</div>
      <ul className="mb-2">
        <li>
          <button
            onClick={() => setCategoryFilter(undefined)}
            className={`w-full rounded px-2 py-1 text-left text-xs ${
              activeCategoryId === undefined
                ? 'bg-neutral-800 text-neutral-100'
                : 'text-neutral-400 hover:bg-neutral-800'
            }`}
          >
            All
          </button>
        </li>
        {categories.map((category) => (
          <li key={category.id} className="group flex items-center gap-1">
            <button
              onClick={() =>
                setCategoryFilter(activeCategoryId === category.id ? undefined : category.id)
              }
              className={`flex-1 truncate rounded px-2 py-1 text-left text-xs ${
                activeCategoryId === category.id
                  ? 'bg-neutral-800 text-neutral-100'
                  : 'text-neutral-400 hover:bg-neutral-800'
              }`}
            >
              {category.name}
            </button>
            <button
              onClick={() => void deleteCategory(category.id)}
              aria-label={`Delete category ${category.name}`}
              className="shrink-0 rounded px-1 text-neutral-600 opacity-0 hover:bg-neutral-700 hover:text-neutral-200 group-hover:opacity-100"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={submitCategory} className="mb-4 px-2">
        <input
          value={newCategory}
          onChange={(event) => setNewCategory(event.target.value)}
          placeholder="New category…"
          className="w-full min-w-0 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
        />
      </form>

      <div className="mb-1 px-2 text-xs font-semibold uppercase text-neutral-500">Tags</div>
      <div className="mb-2 flex flex-wrap gap-1 px-2">
        {tags.length === 0 && <span className="text-xs text-neutral-500">No tags yet.</span>}
        {tags.map((tag) => (
          <span key={tag.id} className="group inline-flex items-center gap-1">
            <button
              onClick={() => toggleTagFilter(tag.id)}
              className={`rounded px-2 py-0.5 text-xs ${
                activeTagIds.includes(tag.id)
                  ? 'bg-blue-900/70 text-blue-200'
                  : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {tag.name}
            </button>
            <button
              onClick={() => void deleteTag(tag.id)}
              aria-label={`Delete tag ${tag.name}`}
              className="hidden text-[10px] text-neutral-600 hover:text-neutral-200 group-hover:inline"
            >
              ✕
            </button>
          </span>
        ))}
      </div>
      <form onSubmit={submitTag} className="px-2">
        <input
          value={newTag}
          onChange={(event) => setNewTag(event.target.value)}
          placeholder="New tag…"
          className="w-full min-w-0 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
        />
      </form>
    </div>
  )
}
