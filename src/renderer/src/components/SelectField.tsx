import { Select } from 'radix-ui'

// Radix Select disallows an empty-string item value (it's reserved to mean "no selection"), so
// the placeholder/"none" state is represented by this sentinel and mapped back to null here.
const NONE = '__none__'

export function SelectField({
  value,
  placeholder,
  options,
  onChange
}: {
  value: string | null
  placeholder: string
  options: { value: string; label: string }[]
  onChange: (value: string | null) => void
}): React.JSX.Element {
  return (
    <Select.Root
      value={value ?? NONE}
      onValueChange={(next) => onChange(next === NONE ? null : next)}
    >
      <Select.Trigger className="flex w-full items-center justify-between gap-2 rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none data-[placeholder]:text-neutral-500">
        <Select.Value placeholder={placeholder} />
        <Select.Icon className="shrink-0 text-neutral-500">▾</Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={4}
          className="z-50 max-h-64 overflow-hidden rounded border border-neutral-700 bg-neutral-900 shadow-lg"
          style={{ width: 'var(--radix-select-trigger-width)' }}
        >
          <Select.Viewport className="p-1">
            <Select.Item
              value={NONE}
              className="cursor-pointer rounded px-2 py-1.5 text-sm text-neutral-500 outline-none data-[highlighted]:bg-neutral-800 data-[highlighted]:text-neutral-200"
            >
              <Select.ItemText>{placeholder}</Select.ItemText>
            </Select.Item>
            {options.map((option) => (
              <Select.Item
                key={option.value}
                value={option.value}
                className="cursor-pointer rounded px-2 py-1.5 text-sm text-neutral-200 outline-none data-[highlighted]:bg-neutral-800 data-[highlighted]:text-neutral-100"
              >
                <Select.ItemText>{option.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}
