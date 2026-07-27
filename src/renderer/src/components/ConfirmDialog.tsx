import { AlertDialog } from 'radix-ui';

export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirm',
  danger,
  onConfirm,
  onCancel
}: {
  title: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}): React.JSX.Element {
  return (
    <AlertDialog.Root open onOpenChange={(open) => !open && onCancel()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-96 -translate-x-1/2 -translate-y-1/2 rounded border border-neutral-700 bg-neutral-900 p-4 shadow-lg focus:outline-none">
          <AlertDialog.Title className="text-sm font-semibold text-neutral-100">
            {title}
          </AlertDialog.Title>
          {description && (
            <AlertDialog.Description className="mt-2 whitespace-pre-line break-words text-xs text-neutral-400">
              {description}
            </AlertDialog.Description>
          )}
          <div className="mt-4 flex justify-end gap-2 text-sm">
            <AlertDialog.Cancel asChild>
              <button className="rounded px-3 py-1.5 text-neutral-400 hover:text-neutral-200">
                Cancel
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                onClick={onConfirm}
                className={`rounded px-3 py-1.5 ${
                  danger
                    ? 'bg-red-900/70 text-red-200 hover:bg-red-900'
                    : 'bg-blue-900/70 text-blue-200 hover:bg-blue-900'
                }`}
              >
                {confirmLabel}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
