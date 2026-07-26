import { useState } from 'react'
import { useLibraryStore } from '../store/useLibraryStore'
import { ModelPreview } from './ModelPreview'
import { formatSize } from '../lib/format'
import type { CategoryRow, TagRow } from '@shared/types'

/**
 * `key`-ed by the caller on the underlying id + value, so an external rename (or switching to a
 * different file/group) remounts this with fresh state instead of needing an effect to
 * resynchronize `draft` — see https://react.dev/learn/you-might-not-need-an-effect.
 */
function InlineRename({
  value,
  suffix,
  onCommit
}: {
  value: string
  suffix?: string
  onCommit: (newValue: string) => void
}): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  if (!editing) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="truncate font-medium text-neutral-100" title={`${value}${suffix ?? ''}`}>
          {value}
          {suffix}
        </span>
        <button
          onClick={() => setEditing(true)}
          aria-label="Rename"
          className="shrink-0 text-xs text-neutral-500 hover:text-neutral-200"
        >
          ✏️
        </button>
      </div>
    )
  }

  const commit = (): void => {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== value) onCommit(trimmed)
    else setDraft(value)
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        autoFocus
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit()
          if (event.key === 'Escape') {
            setDraft(value)
            setEditing(false)
          }
        }}
        className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-950 px-1.5 py-0.5 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
      />
      {suffix && <span className="shrink-0 text-xs text-neutral-500">{suffix}</span>}
    </div>
  )
}

function CategoryPicker({
  categories,
  value,
  onChange,
  onCreate
}: {
  categories: CategoryRow[]
  value: number | null
  onChange: (id: number | null) => void
  onCreate: (name: string) => Promise<CategoryRow | undefined>
}): React.JSX.Element {
  const [newName, setNewName] = useState('')

  const submit = async (): Promise<void> => {
    const name = newName.trim()
    if (!name) return
    const created = await onCreate(name)
    setNewName('')
    if (created) onChange(created.id)
  }

  return (
    <div>
      <select
        value={value ?? ''}
        onChange={(event) =>
          onChange(event.target.value === '' ? null : Number(event.target.value))
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
      <div className="mt-1 flex gap-1">
        <input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && void submit()}
          placeholder="+ New category…"
          className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
        />
        <button
          onClick={() => void submit()}
          className="shrink-0 rounded bg-neutral-800 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-700"
        >
          Add
        </button>
      </div>
    </div>
  )
}

function TagPicker({
  tags,
  assignedIds,
  onToggle,
  onCreate
}: {
  tags: TagRow[]
  assignedIds: number[]
  onToggle: (id: number) => void
  onCreate: (name: string) => Promise<TagRow | undefined>
}): React.JSX.Element {
  const [newName, setNewName] = useState('')

  const submit = async (): Promise<void> => {
    const name = newName.trim()
    if (!name) return
    const created = await onCreate(name)
    setNewName('')
    if (created && !assignedIds.includes(created.id)) onToggle(created.id)
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {tags.length === 0 && <span className="text-xs text-neutral-500">No tags yet.</span>}
        {tags.map((tag) => (
          <button
            key={tag.id}
            onClick={() => onToggle(tag.id)}
            className={`rounded px-2 py-0.5 text-xs ${
              assignedIds.includes(tag.id)
                ? 'bg-blue-900/70 text-blue-200'
                : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {tag.name}
          </button>
        ))}
      </div>
      <div className="mt-1 flex gap-1">
        <input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && void submit()}
          placeholder="+ New tag…"
          className="min-w-0 flex-1 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
        />
        <button
          onClick={() => void submit()}
          className="shrink-0 rounded bg-neutral-800 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-700"
        >
          Add
        </button>
      </div>
    </div>
  )
}

export function DetailPane(): React.JSX.Element | null {
  const selection = useLibraryStore((state) => state.selection)
  const files = useLibraryStore((state) => state.files)
  const duplicates = useLibraryStore((state) => state.duplicates)
  const groups = useLibraryStore((state) => state.groups)
  const categories = useLibraryStore((state) => state.categories)
  const tags = useLibraryStore((state) => state.tags)
  const fileTagIds = useLibraryStore((state) => state.fileTagIds)
  const selectFile = useLibraryStore((state) => state.selectFile)
  const selectGroup = useLibraryStore((state) => state.selectGroup)
  const setFileTags = useLibraryStore((state) => state.setFileTags)
  const setFileCategory = useLibraryStore((state) => state.setFileCategory)
  const renameFile = useLibraryStore((state) => state.renameFile)
  const renameGroup = useLibraryStore((state) => state.renameGroup)
  const setGroupCategory = useLibraryStore((state) => state.setGroupCategory)
  const addFilesToGroup = useLibraryStore((state) => state.addFilesToGroup)
  const removeFileFromGroup = useLibraryStore((state) => state.removeFileFromGroup)
  const deleteGroup = useLibraryStore((state) => state.deleteGroup)
  const createTag = useLibraryStore((state) => state.createTag)
  const createCategory = useLibraryStore((state) => state.createCategory)

  if (!selection) return null

  if (selection.type === 'group') {
    const group = groups.find((g) => g.id === selection.id)
    if (!group) return null
    const members = files.filter((f) => f.group_id === group.id)

    return (
      <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-neutral-800 bg-neutral-900 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase text-neutral-500">Model</span>
          <button
            onClick={() => selectFile(null)}
            aria-label="Close preview"
            className="rounded px-1.5 py-0.5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
          >
            ✕
          </button>
        </div>

        <InlineRename
          key={`${group.id}:${group.name}`}
          value={group.name}
          onCommit={(name) => void renameGroup(group.id, name)}
        />
        <div className="mt-1 text-xs text-neutral-500">
          {members.length} file{members.length === 1 ? '' : 's'}
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-semibold uppercase text-neutral-500">
            Category
          </label>
          <CategoryPicker
            categories={categories}
            value={group.category_id}
            onChange={(id) => void setGroupCategory(group.id, id)}
            onCreate={createCategory}
          />
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-semibold uppercase text-neutral-500">
            Files in this model
          </label>
          <ul className="space-y-1">
            {members.map((file) => (
              <li key={file.id} className="flex items-center justify-between gap-2 text-sm">
                <button
                  onClick={() => selectFile(file.id)}
                  className="min-w-0 flex-1 truncate text-left text-neutral-300 hover:text-neutral-100"
                  title={file.filename}
                >
                  {file.filename}
                </button>
                <button
                  onClick={() => void removeFileFromGroup(file.id)}
                  aria-label="Remove from group"
                  className="shrink-0 text-neutral-500 hover:text-red-400"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>

        <button
          onClick={() => void deleteGroup(group.id)}
          className="mt-4 self-start rounded px-2 py-1 text-xs text-red-400 hover:bg-red-950"
        >
          Dissolve group
        </button>
      </aside>
    )
  }

  const file =
    files.find((f) => f.id === selection.id) ?? duplicates.find((f) => f.id === selection.id)
  if (!file) return null

  const assignedTagIds = fileTagIds.get(file.id) ?? []
  const memberGroup = file.group_id != null ? groups.find((g) => g.id === file.group_id) : undefined
  const baseName = file.filename.slice(0, file.filename.length - file.ext.length - 1)

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
        <InlineRename
          key={`${file.id}:${baseName}`}
          value={baseName}
          suffix={`.${file.ext}`}
          onCommit={(name) => void renameFile(file.id, name)}
        />
        <div className="text-xs text-neutral-500">
          {formatSize(file.size)} · {file.ext.toUpperCase()}
        </div>
        <div className="truncate text-xs text-neutral-500" title={file.path}>
          {file.path}
        </div>
      </div>

      <div className="mt-4">
        <label className="mb-1 block text-xs font-semibold uppercase text-neutral-500">
          Model group
        </label>
        {memberGroup ? (
          <div className="flex items-center justify-between gap-2 text-sm">
            <button
              onClick={() => selectGroup(memberGroup.id)}
              className="truncate text-left text-neutral-300 hover:text-neutral-100"
              title={memberGroup.name}
            >
              Part of: {memberGroup.name}
            </button>
            <button
              onClick={() => void removeFileFromGroup(file.id)}
              className="shrink-0 rounded px-2 py-0.5 text-xs text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
            >
              Remove
            </button>
          </div>
        ) : groups.length === 0 ? (
          <span className="text-xs text-neutral-500">
            No models yet — select 2+ files in the list to create one.
          </span>
        ) : (
          <select
            value=""
            onChange={(event) => {
              if (!event.target.value) return
              void addFilesToGroup(Number(event.target.value), [file.id])
            }}
            className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
          >
            <option value="">Add to existing model…</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="mt-4">
        <label className="mb-1 block text-xs font-semibold uppercase text-neutral-500">
          Category
        </label>
        <CategoryPicker
          categories={categories}
          value={file.category_id}
          onChange={(id) => void setFileCategory(file.id, id)}
          onCreate={createCategory}
        />
      </div>

      <div className="mt-4">
        <label className="mb-1 block text-xs font-semibold uppercase text-neutral-500">Tags</label>
        <TagPicker
          tags={tags}
          assignedIds={assignedTagIds}
          onToggle={toggleTag}
          onCreate={createTag}
        />
      </div>
    </aside>
  )
}
