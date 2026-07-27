import { useRef, useState } from 'react';
import { Dialog } from 'radix-ui';

export function GroupNameDialog({
  count,
  onConfirm,
  onCancel
}: {
  count: number;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}): React.JSX.Element {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = (): void => onConfirm(name.trim() || 'New virtual file');

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-80 -translate-x-1/2 -translate-y-1/2 rounded border border-neutral-700 bg-neutral-900 p-4 shadow-lg focus:outline-none"
          onOpenAutoFocus={(event) => {
            // Focus the name input instead of Radix's default (the dialog content itself).
            event.preventDefault();
            inputRef.current?.focus();
          }}
        >
          <Dialog.Title className="mb-3 text-sm font-semibold text-neutral-200">
            Group {count} files into a virtual file
          </Dialog.Title>
          <input
            ref={inputRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && submit()}
            placeholder="Virtual file name…"
            className="w-full rounded border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
          />
          <div className="mt-3 flex justify-end gap-2 text-sm">
            <Dialog.Close asChild>
              <button className="rounded px-3 py-1.5 text-neutral-400 hover:text-neutral-200">
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={submit}
              className="rounded bg-blue-900/70 px-3 py-1.5 text-blue-200 hover:bg-blue-900"
            >
              Create
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
