import { useState } from 'react'

export function GroupNameDialog({
  count,
  onConfirm,
  onCancel
}: {
  count: number
  onConfirm: (name: string) => void
  onCancel: () => void
}): React.JSX.Element {
  const [name, setName] = useState('')

  const submit = (): void => onConfirm(name.trim() || 'New model')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onCancel}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-80 rounded border border-neutral-700 bg-neutral-900 p-4 shadow-lg"
      >
        <div className="mb-3 text-sm font-semibold text-neutral-200">
          Group {count} files into a model
        </div>
        <input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit()
            if (event.key === 'Escape') onCancel()
          }}
          placeholder="Model name…"
          className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
        />
        <div className="mt-3 flex justify-end gap-2 text-sm">
          <button
            onClick={onCancel}
            className="rounded px-3 py-1.5 text-neutral-400 hover:text-neutral-200"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="rounded bg-blue-900/70 px-3 py-1.5 text-blue-200 hover:bg-blue-900"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  )
}
