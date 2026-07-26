import { useState } from 'react'
import { useLibraryStore } from '../store/useLibraryStore'
import { ModelPreview } from './ModelPreview'
import { ConfirmDialog } from './ConfirmDialog'
import { ChipComboBox } from './ChipComboBox'
import { SelectField } from './SelectField'
import { formatSize } from '../lib/format'
import type { CategoryRow, FileRow, TagRow } from '@shared/types'

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
  const current = value != null ? categories.find((category) => category.id === value) : undefined
  const suggestions = categories.filter((category) => category.id !== value)

  const handleCreate = (name: string): void => {
    void (async (): Promise<void> => {
      const created = await onCreate(name)
      if (created) onChange(created.id)
    })()
  }

  return (
    <ChipComboBox
      chips={current ? [{ id: current.id, name: current.name }] : []}
      suggestions={suggestions}
      placeholder="Category…"
      chipClassName="bg-green-900/60 text-green-300"
      onRemove={() => onChange(null)}
      onSelectExisting={(id) => onChange(id)}
      onCreateNew={handleCreate}
    />
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
  // Chips follow `assignedIds`' own order (how the tags were actually added to this file), not
  // `tags`' alphabetical order - filtering the alphabetical list would re-sort the chips instead.
  const tagById = new Map(tags.map((tag) => [tag.id, tag]))
  const assigned = assignedIds.map((id) => tagById.get(id)).filter((tag): tag is TagRow => tag != null)
  const suggestions = tags.filter((tag) => !assignedIds.includes(tag.id))

  const handleCreate = (name: string): void => {
    void (async (): Promise<void> => {
      const created = await onCreate(name)
      if (created && !assignedIds.includes(created.id)) onToggle(created.id)
    })()
  }

  return (
    <ChipComboBox
      chips={assigned.map((tag) => ({ id: tag.id, name: tag.name }))}
      suggestions={suggestions}
      placeholder="Add tag…"
      chipClassName="bg-orange-900/60 text-orange-300"
      onRemove={onToggle}
      onSelectExisting={onToggle}
      onCreateNew={handleCreate}
    />
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
  const moveToTrash = useLibraryStore((state) => state.moveToTrash)
  const createTag = useLibraryStore((state) => state.createTag)
  const createCategory = useLibraryStore((state) => state.createCategory)

  const [trashTarget, setTrashTarget] = useState<FileRow | null>(null)

  if (!selection) return null

  if (selection.type === 'group') {
    const group = groups.find((g) => g.id === selection.id)
    if (!group) return null
    const members = files.filter((f) => f.group_id === group.id)

    return (
      <>
        <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-neutral-800 bg-neutral-900 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-neutral-500">Virtual</span>
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
              Files in this virtual file
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
                    onClick={() => setTrashTarget(file)}
                    aria-label="Move to Recycle Bin"
                    title="Move to Recycle Bin"
                    className="shrink-0 text-neutral-500 hover:text-red-400"
                  >
                    🗑
                  </button>
                  <button
                    onClick={() => void removeFileFromGroup(file.id)}
                    aria-label="Remove from group"
                    title="Remove from group"
                    className="shrink-0 text-neutral-500 hover:text-neutral-200"
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
        {trashTarget && (
          <ConfirmDialog
            title={`Move "${trashTarget.filename}" to the Recycle Bin?`}
            description={trashTarget.path}
            confirmLabel="Move to Recycle Bin"
            danger
            onCancel={() => setTrashTarget(null)}
            onConfirm={() => {
              void moveToTrash(trashTarget.id)
              setTrashTarget(null)
            }}
          />
        )}
      </>
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
          Virtual file
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
            No virtual files yet — select 2+ files in the list to create one.
          </span>
        ) : (
          <SelectField
            value={null}
            placeholder="Add to existing virtual file…"
            options={groups.map((group) => ({ value: String(group.id), label: group.name }))}
            onChange={(next) => {
              if (next) void addFilesToGroup(Number(next), [file.id])
            }}
          />
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
