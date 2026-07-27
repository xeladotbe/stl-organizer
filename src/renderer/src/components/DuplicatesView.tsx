import { useMemo, useState } from 'react';
import { useLibraryStore } from '../store/useLibraryStore';
import { ConfirmDialog } from './ConfirmDialog';
import { formatSize } from '../lib/format';
import type { FileRow } from '@shared/types';

type TrashTarget = { type: 'file'; file: FileRow } | { type: 'keepFirst'; group: FileRow[] };

export function DuplicatesView(): React.JSX.Element {
  const duplicates = useLibraryStore((state) => state.duplicates);
  const duplicatesLoading = useLibraryStore((state) => state.duplicatesLoading);
  const moveToTrash = useLibraryStore((state) => state.moveToTrash);
  const selectFile = useLibraryStore((state) => state.selectFile);
  const [trashTarget, setTrashTarget] = useState<TrashTarget | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, FileRow[]>();
    for (const file of duplicates) {
      if (!file.content_hash) continue;
      const list = map.get(file.content_hash) ?? [];
      list.push(file);
      map.set(file.content_hash, list);
    }
    return [...map.values()];
  }, [duplicates]);

  const handleTrash = (file: FileRow): void => setTrashTarget({ type: 'file', file });

  const handleKeepFirst = (group: FileRow[]): void => {
    if (group.length <= 1) return;
    setTrashTarget({ type: 'keepFirst', group });
  };

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-neutral-800 px-4 py-3 text-sm text-neutral-400">
        {duplicatesLoading && duplicates.length === 0
          ? 'Scanning for duplicates…'
          : groups.length === 0
            ? 'No exact duplicates found yet.'
            : `${groups.length} duplicate group${groups.length === 1 ? '' : 's'}`}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {groups.map((group) => (
          <div
            key={group[0].content_hash}
            className="mb-4 rounded border border-neutral-800 bg-neutral-900"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
              <div className="text-xs text-neutral-400">
                {group.length} copies · {formatSize(group[0].size)} each
              </div>
              <button
                onClick={() => handleKeepFirst(group)}
                className="rounded bg-neutral-800 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-700"
              >
                Keep first, trash rest
              </button>
            </div>
            <ul>
              {group.map((file) => (
                <li
                  key={file.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <div
                    onClick={() => selectFile(file.id)}
                    className="min-w-0 flex-1 cursor-pointer"
                  >
                    <div className="truncate text-neutral-200">{file.filename}</div>
                    <div className="truncate text-xs text-neutral-500" title={file.path}>
                      {file.path}
                    </div>
                  </div>
                  <button
                    onClick={() => handleTrash(file)}
                    className="shrink-0 rounded px-2 py-1 text-xs text-red-400 hover:bg-red-950"
                  >
                    Trash
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {trashTarget && (
        <ConfirmDialog
          title={
            trashTarget.type === 'file'
              ? `Move "${trashTarget.file.filename}" to the Recycle Bin?`
              : `Move ${trashTarget.group.length - 1} duplicate(s) to the Recycle Bin, keeping "${trashTarget.group[0].filename}"?`
          }
          description={trashTarget.type === 'file' ? trashTarget.file.path : undefined}
          confirmLabel="Move to Recycle Bin"
          danger
          onCancel={() => setTrashTarget(null)}
          onConfirm={() => {
            if (trashTarget.type === 'file') {
              void moveToTrash(trashTarget.file.id);
            } else {
              const [, ...rest] = trashTarget.group;
              for (const file of rest) void moveToTrash(file.id);
            }
            setTrashTarget(null);
          }}
        />
      )}
    </main>
  );
}
