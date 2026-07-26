import { useRef, useState } from 'react'
import { buildComboOptions } from '../lib/comboOptions'

export interface ChipComboBoxItem {
  id: number
  name: string
}

/**
 * A typeahead input backed by chips: currently-assigned items render as removable chips inside
 * the input's own border (like a mail client's "To:" field), with the text cursor continuing
 * after them. Typing filters existing `suggestions` in a dropdown and offers to create the typed
 * text when it doesn't exactly match anything. Backspace on an empty input removes the last chip
 * (standard tag-input convention). Used for both the (single-chip) category picker and the
 * (multi-chip) tag picker in the detail pane - the caller decides what counts as "already
 * assigned" and what "select"/"remove" mean for its data.
 */
export function ChipComboBox({
  chips,
  suggestions,
  placeholder,
  chipClassName = 'bg-neutral-800 text-neutral-300',
  onRemove,
  onSelectExisting,
  onCreateNew
}: {
  chips: ChipComboBoxItem[]
  suggestions: ChipComboBoxItem[]
  placeholder: string
  chipClassName?: string
  onRemove: (id: number) => void
  onSelectExisting: (id: number) => void
  onCreateNew: (name: string) => void
}): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const options = buildComboOptions(suggestions, query)

  const selectAt = (index: number): void => {
    const option = options[index]
    if (!option) return
    if (option.type === 'create') onCreateNew(option.name)
    else onSelectExisting(option.id)
    setQuery('')
    setHighlightIndex(0)
    setOpen(false)
  }

  return (
    <div className="relative">
      <div
        onClick={() => inputRef.current?.focus()}
        className="flex flex-wrap items-center gap-1 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 focus-within:border-neutral-500"
      >
        {chips.map((chip) => (
          <span
            key={chip.id}
            className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${chipClassName}`}
          >
            {chip.name}
            <button
              onClick={(event) => {
                event.stopPropagation()
                onRemove(chip.id)
              }}
              aria-label={`Remove ${chip.name}`}
              className="text-current opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setHighlightIndex(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setOpen(true)
              setHighlightIndex((index) => Math.min(index + 1, options.length - 1))
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              setHighlightIndex((index) => Math.max(index - 1, 0))
            } else if (event.key === 'Enter') {
              event.preventDefault()
              if (options.length > 0) selectAt(highlightIndex)
            } else if (event.key === 'Escape') {
              setOpen(false)
            } else if (event.key === 'Backspace' && query === '' && chips.length > 0) {
              onRemove(chips[chips.length - 1].id)
            }
          }}
          placeholder={chips.length === 0 ? placeholder : ''}
          className="min-w-16 flex-1 bg-transparent text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none"
        />
      </div>
      {open && options.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded border border-neutral-700 bg-neutral-900 shadow-lg">
          {options.map((option, index) => (
            <li key={option.type === 'create' ? '__create__' : option.id}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  selectAt(index)
                  inputRef.current?.focus()
                }}
                className={`block w-full truncate px-2 py-1 text-left text-xs ${
                  index === highlightIndex
                    ? 'bg-neutral-800 text-neutral-100'
                    : 'text-neutral-300 hover:bg-neutral-800'
                }`}
              >
                {option.type === 'create' ? `+ Create "${option.name}"` : option.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
